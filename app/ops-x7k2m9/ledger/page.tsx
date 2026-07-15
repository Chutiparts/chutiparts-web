// app/ops-x7k2m9/ledger/page.tsx — ChutiBenz Core Ledger P0 (ฐานข้อมูลกลาง)
// บันทึก Sales Record + Stock Record จริง → ให้ CRM/Profit/Stock/Risk Guard อ่านต้นทุน/กำไร/สต็อก
// pattern เดิม: svc() + authed() (cookie ops_admin) + server actions · ไม่ลบ (ใช้ status) · ไม่แตะโมดูลอื่น
// P3.3: รับ field "source" (แหล่งซื้อ) ทั้ง addStock + updateStock
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import LedgerClient from './LedgerClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/ledger'

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

const s = (fd: FormData, k: string) => { const v = fd.get(k); return v === null || String(v) === '' ? null : String(v) }
const num = (fd: FormData, k: string) => { const v = fd.get(k); if (v === null || String(v) === '') return null; const n = Number(v); return isNaN(n) ? null : n }

// ===== Sales Record =====
async function addSale(formData: FormData) {
  'use server'
  if (!(await authed())) return
  await svc().from('sales_records').insert({
    customer: s(formData, 'customer'), car_model: s(formData, 'car_model'), part_sold: s(formData, 'part_sold'),
    sale_date: s(formData, 'sale_date'), sale_price: num(formData, 'sale_price'), cost: num(formData, 'cost'),
    payment_status: s(formData, 'payment_status') || 'unpaid', delivery_status: s(formData, 'delivery_status') || 'pending',
    tracking_no: s(formData, 'tracking_no'), note: s(formData, 'note'), linked_lead_id: s(formData, 'linked_lead_id'),
  })
  revalidatePath(PATH)
}
async function updateSale(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || ''); if (!id) return
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of ['customer', 'car_model', 'part_sold', 'sale_date', 'payment_status', 'delivery_status', 'tracking_no', 'note']) {
    const v = formData.get(f); if (v !== null) patch[f] = String(v) === '' ? null : String(v)
  }
  for (const f of ['sale_price', 'cost']) {
    const v = formData.get(f); if (v !== null) patch[f] = String(v) === '' ? null : Number(v)
  }
  await svc().from('sales_records').update(patch).eq('id', id)
  revalidatePath(PATH)
}

// ===== Stock Record =====
async function addStock(formData: FormData) {
  'use server'
  if (!(await authed())) return
  await svc().from('stock_records').insert({
    part_name: s(formData, 'part_name'), car_model: s(formData, 'car_model'), date_in: s(formData, 'date_in'),
    cost: num(formData, 'cost'), set_price: num(formData, 'set_price'), status: s(formData, 'status') || 'in_stock',
    location: s(formData, 'location'), has_image: formData.get('has_image') === 'true', sku: s(formData, 'sku'), note: s(formData, 'note'),
    source: s(formData, 'source'),
  })
  revalidatePath(PATH)
}
async function updateStock(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || ''); if (!id) return
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of ['part_name', 'car_model', 'date_in', 'status', 'location', 'sku', 'note', 'source']) {
    const v = formData.get(f); if (v !== null) patch[f] = String(v) === '' ? null : String(v)
  }
  for (const f of ['cost', 'set_price']) {
    const v = formData.get(f); if (v !== null) patch[f] = String(v) === '' ? null : Number(v)
  }
  const hi = formData.get('has_image'); if (hi !== null) patch.has_image = String(hi) === 'true'
  await svc().from('stock_records').update(patch).eq('id', id)
  revalidatePath(PATH)
}

// Level B: Finance Lite (finance_entries) — reuse pattern จาก finance เดิม (เงินเข้า-ออกพื้นฐาน · ไม่ทำบัญชีเต็ม)
async function addEntry(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const type = String(formData.get('type') || '')
  const amount = parseFloat(String(formData.get('amount') || '0'))
  if (!['income', 'expense'].includes(type) || !(amount > 0)) return
  await svc().from('finance_entries').insert({
    type, amount,
    category: String(formData.get('category') || '') || null,
    note: String(formData.get('note') || '') || null,
    ref: String(formData.get('ref') || '') || null,
    entry_date: String(formData.get('entry_date') || '') || undefined,
  })
  revalidatePath(PATH)
}
async function deleteEntry(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  await svc().from('finance_entries').delete().eq('id', id)
  revalidatePath(PATH)
}

export default async function LedgerPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>Core Ledger</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  const [salesRes, stockRes, financeRes] = await Promise.all([
    svc().from('sales_records').select('*').order('sale_date', { ascending: false }).limit(1000),
    svc().from('stock_records').select('*').order('date_in', { ascending: false }).limit(2000),
    svc().from('finance_entries').select('*').order('entry_date', { ascending: false }).order('id', { ascending: false }).limit(1000),
  ])

  return <LedgerClient
    sales={salesRes.data || []} stock={stockRes.data || []} entries={financeRes.data || []}
    addSale={addSale} updateSale={updateSale} addStock={addStock} updateStock={updateStock}
    addEntry={addEntry} deleteEntry={deleteEntry} />
}
