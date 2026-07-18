// app/ops-x7k2m9/sync-stock/page.tsx — Sheet(Stock tab) → stock_records.qty (จำนวนคงเหลือ)
// อ่าน stock_records (read-only) มาให้ client ทำ diff · เขียนเฉพาะตอน owner กดยืนยัน
// KEY = sku · เขียน qty (คงเหลือ = รับเข้า−ขายออก จากชีต) + part_name/car_model/cost/set_price/location
// SAFETY: owner-only · เขียนเฉพาะ stock_records (ไม่แตะ products/sales) · dry-run + preview + backup · upsert by sku (re-sync ทับ qty สะอาด)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import StockSyncClient from './StockSyncClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/sync-stock'

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

type StockRow = { id?: string | null; sku: string; qty: number; part_name?: string | null; car_model?: string | null; cost?: number | null; set_price?: number | null; location?: string | null }

async function applyStockSync(rows: StockRow[]): Promise<{ ok: boolean; added: number; updated: number; errors: { sku: string; msg: string }[]; batchId: string; at: string }> {
  'use server'
  const at = new Date().toISOString()
  const batchId = 'stocksync-' + at.replace(/[^0-9]/g, '').slice(0, 14)
  if (!(await authed())) return { ok: false, added: 0, updated: 0, errors: [{ sku: '-', msg: 'unauthorized' }], batchId, at }
  const db = svc()
  let added = 0, updated = 0
  const errors: { sku: string; msg: string }[] = []
  for (const r of Array.isArray(rows) ? rows : []) {
    const sku = String(r.sku || '').trim()
    if (!sku) { errors.push({ sku: '-', msg: 'SKU ว่าง (ข้าม)' }); continue }
    const qty = Number(r.qty); if (isNaN(qty)) { errors.push({ sku, msg: 'คงเหลือไม่ใช่ตัวเลข' }); continue }
    const status = qty > 0 ? 'in_stock' : 'sold'
    const base: Record<string, unknown> = { qty, status, updated_at: at }
    if (r.part_name != null && String(r.part_name).trim() !== '') base.part_name = String(r.part_name).trim()
    if (r.car_model != null && String(r.car_model).trim() !== '') base.car_model = String(r.car_model).trim()
    if (r.cost != null && !isNaN(Number(r.cost))) base.cost = Number(r.cost)
    if (r.set_price != null && !isNaN(Number(r.set_price))) base.set_price = Number(r.set_price)
    if (r.location != null && String(r.location).trim() !== '') base.location = String(r.location).trim()
    try {
      if (r.id) {
        const { error } = await db.from('stock_records').update(base).eq('id', r.id)
        if (error) errors.push({ sku, msg: error.message }); else updated++
      } else {
        const { error } = await db.from('stock_records').insert({ sku, ...base })
        if (error) errors.push({ sku, msg: error.message }); else added++
      }
    } catch (e: any) { errors.push({ sku, msg: String(e?.message || e) }) }
  }
  revalidatePath(PATH)
  return { ok: errors.length === 0, added, updated, errors, batchId, at }
}

export default async function SyncStockPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>Stock Sync — Owner only</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }
  const res = await svc().from('stock_records').select('*').limit(5000)
  return <StockSyncClient stock={res.data || []} applyStockSync={applyStockSync} />
}
