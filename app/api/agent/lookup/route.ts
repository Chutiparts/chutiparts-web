// app/api/agent/lookup/route.ts
// Voice-agent product lookup (Pilot v1.2) — READ-ONLY · scoped key (X-Agent-Key) · ไม่คืน PII
// ต่อยอดของเดิม: service client + rate-limit(rate_limits) + search_aliases + live stock (stock_records.qty)
//   แบบเดียวกับหน้า /search — ไม่สร้าง auth/rate-limit/table ซ้ำซ้อน (ไม่บวม)
// คืน 5 ฟิลด์ที่ล็อกในสเปค: name, price, qty, compatible_models, call_for_price
// สถานะ: found (1) / multiple (สูงสุด 3) / not_found — agent อ่านสถานะแล้วทำตาม guardrails
import { type NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { resolveAliases, scoreMatch } from '@/lib/search-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'sin1' // co-locate กับ Supabase ap-southeast-1 (Singapore) — ลด latency query

const noStore = { 'Cache-Control': 'no-store' as const }
const j = (body: unknown, status = 200) =>
  NextResponse.json(body as Record<string, unknown>, { status, headers: noStore })

// service-role client (server-only — คีย์นี้ห้ามหลุดไปถึง voice worker)
function svc(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// scoped auth: X-Agent-Key === AGENT_LOOKUP_KEY (แยกจาก AI_TOOL_TOKEN → เข้าถึงได้แค่ lookup นี้ ไม่แตะ lead/PII)
function keyOk(req: NextRequest): boolean {
  const expected = process.env.AGENT_LOOKUP_KEY
  if (!expected) return false
  const got = req.headers.get('x-agent-key') || ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

type Product = Record<string, unknown>

// interpolate เข้า .or() ได้ปลอดภัย: ตัดอักขระที่เป็น syntax ของ PostgREST filter (, ( ) )
const clean = (s: string) => s.replace(/[,()]/g, ' ').trim()

function shape(p: Product, qty: number) {
  const price = p.price != null ? Number(p.price) : 0
  let compatible: string[] = []
  const cm = p.compatible_models
  if (Array.isArray(cm)) compatible = cm.map((x) => String(x))
  else if (typeof cm === 'string' && cm.trim()) compatible = cm.split(/[,\s]+/).filter(Boolean)
  return {
    name: (p.name as string) ?? null,
    price: price > 0 ? price : null,
    qty,
    compatible_models: compatible,
    call_for_price: !(price > 0), // กฎเดียว: price<=0 → true (ตรงกับ "สอบถามราคา" บนเว็บ) · guardrail #5
  }
}

// live on-hand จาก stock_records (trigger คุม qty หลัง cutover) — sum ต่อ sku · ตัด soft-deleted
async function liveQty(sb: SupabaseClient, skus: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  const list = skus.filter(Boolean)
  if (!list.length) return m
  const { data } = await sb.from('stock_records').select('sku, qty').in('sku', list).is('deleted_at', null)
  for (const r of (data || []) as Array<{ sku?: string; qty?: number }>) {
    const k = String(r.sku ?? '')
    if (k) m.set(k, (m.get(k) || 0) + (Number(r.qty) || 0))
  }
  return m
}

// log ทุก query (รวม not_found) ลง search_queries channel=voice-agent → ได้สถิติ §9 โดยไม่ต้องมีตารางใหม่
async function logQuery(sb: SupabaseClient, text: string, resolved: string, count: number) {
  try {
    await sb.from('search_queries').insert({
      query_text: text.slice(0, 200),
      resolved: resolved.slice(0, 200),
      model: null,
      channel: 'voice-agent',
      result_count: count,
      had_results: count > 0,
    })
  } catch { /* best-effort · ห้ามทำให้ lookup ล้ม */ }
}

export async function GET(req: NextRequest) {
  if (!keyOk(req)) return j({ error: 'unauthorized' }, 401)

  const ip = clientIp(req)
  const allowed = await rateLimit(`agent-lookup:${ip}`, 30, 60) // 30 req/min ต่อ IP
  if (!allowed) return j({ error: 'rate_limited', retry_after: 60 }, 429)

  const sb = svc()
  if (!sb) return j({ error: 'server_misconfig' }, 500)

  const { searchParams } = new URL(req.url)
  const sku = (searchParams.get('sku') || '').trim().slice(0, 40)
  const q = (searchParams.get('q') || '').trim().slice(0, 80)

  // ---------- โหมด SKU: ค้นตรง ----------
  if (sku) {
    const skuNorm = sku.replace(/[^a-zA-Z0-9]/g, '')
    const { data } = await sb
      .from('products').select('*').eq('is_published', true)
      // ต้องครอบคลุม 3 อย่าง ไม่ใช่แค่ SKU ปัจจุบัน: (1) SKU ร้าน (2) เลข OEM ที่ปั๊มบนตัวของ
      // ซึ่งลูกค้าอ่านให้ทางโทรศัพท์ (3) รหัสเดิมของชิ้นที่เคยเปลี่ยน SKU (alt_part_numbers)
      .or(
        `part_number.ilike.%${clean(sku)}%` +
        (skuNorm ? `,part_number_norm.ilike.%${skuNorm}%,oem_number_norm.ilike.%${skuNorm}%` : '') +
        `,alt_part_numbers.cs.{"${clean(sku)}"}`,
      )
      .limit(5)
    const rows = (data || []) as Product[]
    if (!rows.length) { await logQuery(sb, sku, sku, 0); return j({ status: 'not_found', query: sku }) }
    const qtyMap = await liveQty(sb, rows.map((r) => String(r.part_number ?? '')))
    const nrm = (v: unknown) => String(v ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const exact =
      rows.find((r) => nrm(r.part_number) === skuNorm.toLowerCase()) ||
      rows.find((r) => nrm((r as { oem_number?: string }).oem_number) === skuNorm.toLowerCase())
    const pick = exact || rows[0]
    await logQuery(sb, sku, sku, 1)
    return j({ status: 'found', query: sku, result: shape(pick, qtyMap.get(String(pick.part_number ?? '')) || 0) })
  }

  // ---------- โหมดคำพูด: alias + ค้นชื่อ (แบบเดียวกับหน้า /search) ----------
  if (!q) return j({ status: 'not_found', query: '', note: 'ต้องส่ง ?sku= หรือ ?q=' })

  const resolved = await resolveAliases(q, sb)          // ทั้งประโยค: ปลาวาฬ → W140
  const searchQuery = resolved.canonical || q
  // แยก alias ทีละคำเหมือนหน้า /search: "ไฟท้าย ปลาวาฬ" → ["ไฟท้าย","W140"] (เจอตั้งแต่รอบแรก)
  const rawTokens = searchQuery.split(/\s+/).filter((t) => t.length >= 2)
  let tokens = rawTokens
  if (rawTokens.length >= 2) {
    const { data: tokenAliases } = await sb
      .from('search_aliases').select('alias, canonical').eq('active', true)
      .in('alias', rawTokens.map((t) => t.toLowerCase()))
    const aliasMap: Record<string, string> = {}
    for (const r of (tokenAliases || []) as Array<{ alias: string; canonical: string }>) {
      aliasMap[String(r.alias).toLowerCase()] = String(r.canonical)
    }
    tokens = rawTokens.map((t) => aliasMap[t.toLowerCase()] || t)
  }

  let pq = sb.from('products').select('*').eq('is_published', true).limit(20)
  if (tokens.length >= 2) {
    // ทุกคำต้องเจอ (AND) — .or() ที่เรียกซ้ำ = AND ระหว่างกลุ่ม (แบบเดียวกับหน้า /search)
    for (const tok of tokens) {
      const t = clean(tok)
      const tNorm = tok.replace(/[^a-zA-Z0-9]/g, '')
      const parts = [`name.ilike.%${t}%`, `description.ilike.%${t}%`, `part_number.ilike.%${t}%`, `oem_number.ilike.%${t}%`]
      if (tNorm) parts.push(`part_number_norm.ilike.%${tNorm}%`, `oem_number_norm.ilike.%${tNorm}%`)
      pq = pq.or(parts.join(','))
    }
  } else {
    const safe = clean(searchQuery)
    const qNorm = searchQuery.replace(/[^a-zA-Z0-9]/g, '')
    const orParts = [`name.ilike.%${safe}%`, `description.ilike.%${safe}%`, `part_number.ilike.%${safe}%`, `oem_number.ilike.%${safe}%`]
    if (qNorm) orParts.push(`part_number_norm.ilike.%${qNorm}%`, `oem_number_norm.ilike.%${qNorm}%`)
    pq = pq.or(orParts.join(','))
  }
  const { data } = await pq
  let rows = (data || []) as Product[]

  if (!rows.length) { await logQuery(sb, q, searchQuery, 0); return j({ status: 'not_found', query: q }) }

  // จัดอันดับด้วยความใกล้เคียงชื่อ/รหัส แล้วตัด 3 อันดับแรก
  rows = rows
    .map((r) => ({
      r,
      s: Math.max(scoreMatch(searchQuery, String(r.name ?? '')), scoreMatch(searchQuery, String(r.part_number ?? ''))),
    }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r)

  const qtyMap = await liveQty(sb, rows.map((r) => String(r.part_number ?? '')))

  if (rows.length === 1) {
    const p = rows[0]
    await logQuery(sb, q, searchQuery, 1)
    return j({ status: 'found', query: q, result: shape(p, qtyMap.get(String(p.part_number ?? '')) || 0) })
  }

  await logQuery(sb, q, searchQuery, rows.length)
  const top = rows.slice(0, 3).map((p) => shape(p, qtyMap.get(String(p.part_number ?? '')) || 0))
  return j({ status: 'multiple', query: q, count: rows.length, results: top })
}
