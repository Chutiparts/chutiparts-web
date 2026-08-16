// app/api/radar-daily/route.ts — Daily LINE Radar (Phase 1)
// 2026-08-16 · รวมสัญญาณ demand ที่มีอยู่ → Top 3 actionable → push LINE (reuse pattern notify-lead)
// สัญญาณ: (1) ขายได้แต่หมด [sales+stock] (2) ลูกค้าถามแต่ไม่มี [contact_leads] (3) ค้นไม่เจอ [search_queries]
// อ่านล้วน · ไม่มีตารางใหม่ · ยิงเฉพาะเมื่อมี actionable (กันสแปม) · auth = Bearer CRON_SECRET เหมือน sync-stock
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9ก-๙]/g, '')
const keyOf = (part: unknown, model: unknown) => norm(part) + '|' + norm(model)
const ageDays = (iso: string, now: number) => { const t = Date.parse(iso); return isNaN(t) ? 1e9 : (now - t) / 86400000 }

const CFG = { windowDays: 90, minSold: 2, searchDays: 30, minNotFound: 3 }
const CLOSED_LEAD = ['won', 'lost']
const TIER_ICON: Record<number, string> = { 1: '🔴', 2: '🟠', 3: '🔵' }

type Item = { tier: number; part: string; model: string; metric: string; action: string; score: number }

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function pushLine(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const to = process.env.LINE_ADMIN_TO
  if (!token || !to) return { ok: false, error: 'missing LINE env (LINE_CHANNEL_ACCESS_TOKEN / LINE_ADMIN_TO)' }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return { ok: false, error: `line_${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? 'push_error' }
  }
}

async function computeItems(): Promise<Item[]> {
  const db = svc()
  const now = Date.now()
  const [salesR, stockR, leadsR, searchR] = await Promise.all([
    db.from('sales_records').select('part_sold, car_model, sale_date').order('sale_date', { ascending: false }).limit(2000),
    db.from('stock_records').select('part_name, car_model, qty, status, deleted_at').limit(3000),
    db.from('contact_leads').select('part_wanted, part_number, car_model, status, created_at').order('created_at', { ascending: false }).limit(1000),
    db.from('search_queries').select('query_text, had_results, created_at').order('created_at', { ascending: false }).limit(3000),
  ])
  const sales = salesR.data ?? []
  const stock = stockR.data ?? []
  const leads = leadsR.data ?? []
  const searches = searchR.data ?? []

  // in-stock keys (active row · qty>0)
  const inStock = new Set<string>()
  for (const s of stock as Record<string, unknown>[]) {
    if (s.deleted_at) continue
    if (String(s.status ?? 'in_stock') !== 'in_stock') continue
    if (Number(s.qty) > 0) inStock.add(keyOf(s.part_name, s.car_model))
  }

  const items: Item[] = []

  // TIER 1 — ขายได้แต่หมด (mirror buildDemand: urgent = sold>=minSold && left===0)
  const soldBy: Record<string, { part: string; model: string; n: number }> = {}
  for (const r of sales as Record<string, unknown>[]) {
    if (ageDays(String(r.sale_date ?? ''), now) > CFG.windowDays) continue
    const k = keyOf(r.part_sold, r.car_model)
    if (k === '|') continue
    if (!soldBy[k]) soldBy[k] = { part: String(r.part_sold ?? '(ไม่ระบุ)'), model: String(r.car_model ?? ''), n: 0 }
    soldBy[k].n++
  }
  for (const [k, v] of Object.entries(soldBy)) {
    if (v.n >= CFG.minSold && !inStock.has(k)) {
      items.push({ tier: 1, part: v.part, model: v.model, metric: `ขายได้ ${v.n} ครั้ง/${CFG.windowDays}วัน · ของหมด`, action: 'หาเข้าด่วน', score: v.n })
    }
  }

  // TIER 2 — ลูกค้าถามแต่ไม่มี (mirror buildAsks: wanted = left===0)
  const askBy: Record<string, { part: string; model: string; n: number }> = {}
  for (const l of leads as Record<string, unknown>[]) {
    if (CLOSED_LEAD.includes(String(l.status ?? 'new'))) continue
    const part = (l.part_wanted || l.part_number) as unknown
    if (!part) continue
    if (ageDays(String(l.created_at ?? ''), now) > CFG.windowDays) continue
    const k = keyOf(part, l.car_model)
    if (!askBy[k]) askBy[k] = { part: String(part), model: String(l.car_model ?? ''), n: 0 }
    askBy[k].n++
  }
  for (const [k, v] of Object.entries(askBy)) {
    if (!inStock.has(k)) {
      items.push({ tier: 2, part: v.part, model: v.model, metric: `ลูกค้าถาม ${v.n} ครั้ง · ไม่มีของ`, action: 'ติดต่อหา/เสนอลูกค้า', score: v.n })
    }
  }

  // TIER 3 — ค้นไม่เจอบ่อย (search_queries had_results=false)
  const sBy: Record<string, { q: string; nf: number }> = {}
  for (const r of searches as Record<string, unknown>[]) {
    if (ageDays(String(r.created_at ?? ''), now) > CFG.searchDays) continue
    const had = r.had_results === true || r.had_results === 'true'
    if (had) continue
    const q = norm(r.query_text)
    if (!q) continue
    if (!sBy[q]) sBy[q] = { q: String(r.query_text ?? q), nf: 0 }
    sBy[q].nf++
  }
  for (const v of Object.values(sBy)) {
    if (v.nf >= CFG.minNotFound) {
      items.push({ tier: 3, part: `"${v.q}"`, model: '', metric: `ลูกค้าค้น ${v.nf} ครั้งใน ${CFG.searchDays}วัน · ไม่เจอในเว็บ`, action: 'พิจารณารับเข้า', score: v.nf })
    }
  }

  items.sort((a, b) => a.tier - b.tier || b.score - a.score)
  return items
}

function formatMessage(items: Item[]): string {
  const d = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })
  const body = items.slice(0, 3).map((x) => `${TIER_ICON[x.tier]} ${x.part}${x.model ? ` (${x.model})` : ''}\n   ${x.metric} → ${x.action}`).join('\n\n')
  return `🛰️ ChutiBenz Radar · ${d}\n\n${body}\n\n(สัญญาณจาก ยอดขาย · ลูกค้าถาม · ค้นไม่เจอ)`
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ ok: false, error: 'no_cron_secret' }, { status: 500 })
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const items = await computeItems()
  if (items.length === 0) return NextResponse.json({ ok: true, sent: false, reason: 'nothing_actionable', count: 0 })
  const message = formatMessage(items)
  if (dry) return NextResponse.json({ ok: true, sent: false, dry: true, count: items.length, top: items.slice(0, 3), message })
  const push = await pushLine(message)
  return NextResponse.json({ ok: push.ok, sent: push.ok, error: push.error, count: items.length, top: items.slice(0, 3), message })
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
