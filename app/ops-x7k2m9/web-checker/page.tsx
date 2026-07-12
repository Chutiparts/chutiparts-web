// app/ops-x7k2m9/web-checker/page.tsx — ChutiBenz Web Checker (P0)
// ตรวจสถานะเว็บ/ฟีเจอร์แบบ read-only → PASS/WARN/FAIL · pattern เดียวกับ ops อื่น
// ห้าม: แก้ UI ลูกค้า / เปลี่ยน logic เดิม / เขียนข้อมูลจริง (มีแค่ dry-run lead ที่ลบทันที)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import WebCheckerClient from './WebCheckerClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/web-checker'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://chutibenz.com'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}
async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false
  return (await cookies()).get(COOKIE)?.value === secret
}
async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    ;(await cookies()).set(COOKIE, secret, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  }
  revalidatePath(PATH)
}

type Status = 'PASS' | 'WARN' | 'FAIL'
type Check = { key: string; label: string; status: Status; detail: string; ms: number }

async function grab(path: string): Promise<{ status: number; ok: boolean; body: string; ms: number; err?: string }> {
  const t0 = Date.now()
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 9000)
  try {
    const r = await fetch(SITE + path, { cache: 'no-store', signal: ctrl.signal, headers: { 'user-agent': 'ChutiBenz-WebChecker/1.0' } })
    const body = await r.text().catch(() => '')
    return { status: r.status, ok: r.status >= 200 && r.status < 300, body, ms: Date.now() - t0 }
  } catch (e) {
    return { status: 0, ok: false, body: '', ms: Date.now() - t0, err: (e as Error)?.message || 'fetch_error' }
  } finally {
    clearTimeout(to)
  }
}

// ── server action: รันเช็คทั้งหมด (read-only + dry-run lead ที่ลบทันที) ──
async function runChecks() {
  'use server'
  if (!(await authed())) return { error: 'unauthorized' as const }
  const results: Check[] = []
  const push = (c: Check) => results.push(c)

  // 1-3) หน้าเว็บ public เปิดได้
  for (const [key, label, path] of [
    ['home', 'หน้าเว็บหลักเปิดได้', '/'],
    ['ebooks', '/ebooks เปิดได้', '/ebooks'],
    ['ask', '/ask เปิดได้', '/ask'],
  ] as const) {
    const r = await grab(path)
    push({ key, label, status: r.ok ? 'PASS' : 'FAIL', detail: r.ok ? `HTTP ${r.status}` : `HTTP ${r.status}${r.err ? ' · ' + r.err : ''}`, ms: r.ms })
  }

  // 4) AI Sales Chat โหลดได้ (flag + marker ในหน้าแรก)
  {
    const t0 = Date.now()
    let status: Status = 'PASS'
    let detail = ''
    try {
      const { data } = await svc().from('site_settings').select('enabled').eq('key', 'sales_chat').maybeSingle()
      const flagOn = !data || data.enabled !== false
      const home = await grab('/')
      const marker = /แชตหาอะไหล่|Find parts|ChutiBenz Parts Assistant/.test(home.body)
      if (!flagOn) { status = 'WARN'; detail = 'flag sales_chat ปิดจาก Control Panel' }
      else if (marker) { status = 'PASS'; detail = 'flag on + เจอปุ่มแชตในหน้าแรก' }
      else { status = 'WARN'; detail = 'flag on แต่ไม่เจอ marker (อาจ client-render)' }
    } catch (e) { status = 'FAIL'; detail = (e as Error)?.message || 'error' }
    push({ key: 'sales_chat', label: 'AI Sales Chat โหลดได้', status, detail, ms: Date.now() - t0 })
  }

  // 5) ปุ่ม LINE / WhatsApp prefill ยังทำงาน (มีลิงก์ในหน้า /ask)
  {
    const r = await grab('/ask')
    const hasWA = r.body.includes('wa.me/66818285855')
    const hasLINE = r.body.includes('%40440ifncj') || r.body.includes('line.me/R/oaMessage')
    let status: Status = 'FAIL'; let detail = 'ไม่พบลิงก์ทั้งคู่'
    if (hasWA && hasLINE) { status = 'PASS'; detail = 'พบ WhatsApp + LINE prefill ครบ' }
    else if (hasWA || hasLINE) { status = 'WARN'; detail = `พบแค่ ${hasWA ? 'WhatsApp' : 'LINE'} (อีกอันหาย)` }
    push({ key: 'quick_links', label: 'ปุ่ม LINE / WhatsApp prefill', status, detail, ms: r.ms })
  }

  // 6) หน้า ops สำคัญเปิดได้ (route ตอบ 200 = login form, ไม่ 404/500)
  {
    const t0 = Date.now()
    // ครอบคลุมทุกเมนู Command Center + settings (P0.1: เพิ่ม ledger/landed-cost/stock-source/daily-brief/crm/risk-guard)
    const pages = [
      '/ops-x7k2m9/daily-brief', '/ops-x7k2m9/parts-desk', '/ops-x7k2m9/crm-retention',
      '/ops-x7k2m9/risk-guard', '/ops-x7k2m9/profit-guard', '/ops-x7k2m9/ledger',
      '/ops-x7k2m9/landed-cost', '/ops-x7k2m9/stock-source', '/ops-x7k2m9/finance',
      '/ops-x7k2m9/settings', '/ops-x7k2m9/web-checker',
    ]
      const bad: string[] = []
    for (const p of pages) { const r = await grab(p); if (!r.ok) bad.push(`${p.split('/').pop()}:${r.status}`) }
    push({ key: 'ops_routes', label: `หน้า ops สำคัญเปิดได้ (${pages.length})`, status: bad.length ? 'FAIL' : 'PASS', detail: bad.length ? `ผิดปกติ: ${bad.join(', ')}` : 'ทุกหน้า 200 (login gate)', ms: Date.now() - t0 })
  }

  // 7) products query อ่านได้
  {
    const t0 = Date.now()
    try {
      const { count, error } = await svc().from('products').select('id', { count: 'exact', head: true }).eq('is_published', true)
      if (error) push({ key: 'products_read', label: 'products query อ่านได้', status: 'FAIL', detail: error.message, ms: Date.now() - t0 })
      else push({ key: 'products_read', label: 'products query อ่านได้', status: (count || 0) > 0 ? 'PASS' : 'WARN', detail: `published = ${count ?? 0} ชิ้น`, ms: Date.now() - t0 })
    } catch (e) { push({ key: 'products_read', label: 'products query อ่านได้', status: 'FAIL', detail: (e as Error)?.message || 'error', ms: Date.now() - t0 }) }
  }

  // 8) contact lead submit ได้ (DRY-RUN: insert test record → ลบทันที · ไม่แจ้งลูกค้า/ทีม)
  {
    const t0 = Date.now()
    const sb = svc()
    let insertedId: string | null = null
    try {
      const testRow = {
        status: 'new', topic: 'general', source: 'direct', consent: true,
        name: '🧪 WEB-CHECKER TEST (auto-deleted)',
        detail: `web-checker dry-run ${new Date().toISOString()}`,
        contact_value: 'web-checker-test',
      }
      const { data, error } = await sb.from('contact_leads').insert(testRow).select('id').single()
      if (error || !data) throw new Error(error?.message || 'insert_failed')
      insertedId = data.id
      const { error: delErr } = await sb.from('contact_leads').delete().eq('id', insertedId)
      if (delErr) push({ key: 'lead_dryrun', label: 'contact lead submit (dry-run)', status: 'WARN', detail: `insert OK แต่ลบไม่สำเร็จ — ลบมือ id=${insertedId}`, ms: Date.now() - t0 })
      else push({ key: 'lead_dryrun', label: 'contact lead submit (dry-run)', status: 'PASS', detail: 'insert + delete สำเร็จ (test record ลบแล้ว)', ms: Date.now() - t0 })
    } catch (e) {
      // เผื่อ insert ผ่านแต่ throw ตอน select — พยายามลบทิ้ง
      if (insertedId) { try { await sb.from('contact_leads').delete().eq('id', insertedId) } catch {} }
      push({ key: 'lead_dryrun', label: 'contact lead submit (dry-run)', status: 'FAIL', detail: (e as Error)?.message || 'error', ms: Date.now() - t0 })
    }
  }

  // 9) finance / profit-guard ไม่ error
  {
    const t0 = Date.now()
    try {
      const { count, error } = await svc().from('finance_entries').select('id', { count: 'exact', head: true })
      if (error) push({ key: 'finance_read', label: 'finance query ไม่ error', status: 'FAIL', detail: error.message, ms: Date.now() - t0 })
      else push({ key: 'finance_read', label: 'finance query ไม่ error', status: 'PASS', detail: `query ok · ${count ?? 0} รายการ`, ms: Date.now() - t0 })
    } catch (e) { push({ key: 'finance_read', label: 'finance query ไม่ error', status: 'FAIL', detail: (e as Error)?.message || 'error', ms: Date.now() - t0 }) }
    // profit-guard = เครื่องคิดเลขล้วน ไม่มี DB → เช็ก route แล้วในข้อ 6
    push({ key: 'profit_guard', label: 'profit-guard (calc-only, no DB)', status: 'PASS', detail: 'ไม่มี DB write · route เช็กในข้อ ops', ms: 0 })
  }

  const summary = {
    pass: results.filter((r) => r.status === 'PASS').length,
    warn: results.filter((r) => r.status === 'WARN').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
  }
  const overall: Status = summary.fail ? 'FAIL' : summary.warn ? 'WARN' : 'PASS'
  return { ranAt: new Date().toISOString(), site: SITE, overall, summary, results }
}

export default async function WebCheckerPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>Web Checker</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600 }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  // เช็คสวิตช์ web_checker (ถ้าไม่มีแถว = แสดงปกติ)
  const { data: flagRow } = await svc().from('site_settings').select('enabled').eq('key', 'web_checker').maybeSingle()
  if (flagRow && flagRow.enabled === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4EFE4', color: '#5F5E5A', fontSize: 15 }}>
        โมดูล Web Checker ปิดอยู่ — เปิดได้ที่ Control Panel (/ops-x7k2m9/settings)
      </div>
    )
  }

  return <WebCheckerClient runChecks={runChecks} site={SITE} />
}
