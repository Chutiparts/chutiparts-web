// app/ops-x7k2m9/sell/page.tsx — Team Sales Entry (พนักงานลงขาย · team-safe)
// ทีมกรอกแค่ SKU + จำนวน + ลูกค้า + ผู้ขาย · ราคา+ต้นทุน "server ดึงจาก stock เอง" (ทีมแก้ราคาไม่ได้ · ไม่เห็นทุน/กำไร)
// insert sales_records(qty, sold_by · sale_price/cost = ยอดรวม ×qty) → Path B ตัดสต็อกอัตโนมัติ · owner เห็นกำไรใน Ledger
// auth: owner(ops_admin) หรือ team(ops_team) · หน้านี้อยู่ใน TEAM_ALLOWED (middleware)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import SellClient from './SellClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/sell'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}
async function authed(): Promise<boolean> {
  const c = await cookies()
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && c.get(COOKIE)?.value === secret) return true
  const team = process.env.TEAM_OPS_SECRET
  return !!team && c.get('ops_team')?.value === team
}
async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  const team = process.env.TEAM_OPS_SECRET
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }
  if (secret && pw === secret) { (await cookies()).set(COOKIE, secret, opts); (await cookies()).delete('ops_team') }
  else if (team && pw === team) { (await cookies()).set('ops_team', team, opts); (await cookies()).delete(COOKIE) }
  revalidatePath(PATH)
}

// team-safe: ราคา+ต้นทุน server ดึงจาก stock (ไม่รับจาก client) · คืนแค่ ok/msg (ไม่มีทุน/กำไร)
async function addTeamSale(formData: FormData): Promise<{ ok: boolean; msg: string }> {
  'use server'
  if (!(await authed())) return { ok: false, msg: 'unauthorized' }
  const sku = String(formData.get('sku') || '').trim()
  const qty = Math.max(1, Math.floor(Number(formData.get('qty') || 1)))
  const customer = String(formData.get('customer') || '').trim() || null
  const sold_by = String(formData.get('sold_by') || '').trim() || null
  const payment = String(formData.get('payment_status') || 'paid') === 'unpaid' ? 'unpaid' : 'paid'
  if (!sku) return { ok: false, msg: 'กรุณาเลือก SKU' }
  if (!Number.isFinite(qty) || qty < 1) return { ok: false, msg: 'จำนวนไม่ถูกต้อง' }
  if (payment === 'unpaid' && !sold_by) return { ok: false, msg: 'ค้างชำระต้องระบุผู้ขาย' }
  const db = svc()
  // ราคา/ต้นทุน/ชื่อ ดึงจาก stock ตาม sku (server-side · ทีมแก้ไม่ได้)
  const { data: st } = await db.from('stock_records').select('sku,part_name,car_model,cost,set_price').ilike('sku', sku).limit(1)
  const s: any = st && st[0]
  if (!s) return { ok: false, msg: 'ไม่พบ SKU นี้ในสต็อก' }
  const unit = s.set_price != null ? Number(s.set_price) : 0
  if (!(unit > 0)) return { ok: false, msg: 'สินค้านี้ยังไม่ตั้งราคา — แจ้งเจ้าของ' }
  const unitCost = s.cost != null ? Number(s.cost) : null
  const { error } = await db.from('sales_records').insert({
    sku: String(s.sku), part_sold: s.part_name || null, car_model: s.car_model || null,
    sale_date: new Date().toISOString().slice(0, 10),
    sale_price: unit * qty,                         // ยอดรวม (ราคา/ชิ้น × จำนวน)
    cost: unitCost != null ? unitCost * qty : null, // ต้นทุนรวม (server · ทีมไม่เห็น)
    qty, sold_by, customer,
    payment_status: payment, delivery_status: 'delivered',
  })
  if (error) return { ok: false, msg: 'บันทึกไม่สำเร็จ: ' + error.message }
  revalidatePath(PATH)
  revalidatePath('/ops-x7k2m9/ledger')
  return { ok: true, msg: 'บันทึกการขายแล้ว ✓' }
}

export default async function SellPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>🧾 ขายออก</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }
  const [stockRes, salesRes] = await Promise.all([
    svc().from('stock_records').select('sku,part_name,car_model,set_price,qty').limit(5000),
    svc().from('sales_records').select('sku,part_sold,car_model,customer,qty,sale_price,sold_by,payment_status,sale_date').order('sale_date', { ascending: false }).limit(400),
  ])
  // คงเหลือ Path B (sum qty) เพื่อโชว์ให้ทีมเห็นของเหลือ
  const soldBySku: Record<string, number> = {}
  ;(salesRes.data || []).forEach((r: any) => { const k = String(r.sku || '').trim().toUpperCase(); if (k) soldBySku[k] = (soldBySku[k] || 0) + Number(r.qty || 1) })
  const stockOpts = (stockRes.data || []).filter((s: any) => s.sku).map((s: any) => ({
    sku: String(s.sku).trim(), part_name: s.part_name || '', car_model: s.car_model || '',
    set_price: s.set_price != null ? Number(s.set_price) : null,
    left: (Number(s.qty) || 0) - (soldBySku[String(s.sku).trim().toUpperCase()] || 0),
  }))
  const today = new Date().toISOString().slice(0, 10)
  // team-safe: ไม่ส่ง cost/profit ไป client เลย
  const todaySales = (salesRes.data || []).filter((r: any) => r.sale_date === today).map((r: any) => ({
    part_sold: r.part_sold, car_model: r.car_model, customer: r.customer, qty: Number(r.qty || 1),
    total: Number(r.sale_price || 0), sold_by: r.sold_by, payment_status: r.payment_status,
  }))
  return <SellClient stockOpts={stockOpts} todaySales={todaySales} addTeamSale={addTeamSale} />
}
