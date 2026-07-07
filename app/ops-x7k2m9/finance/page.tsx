// app/ops-x7k2m9/finance/page.tsx — Finance เบา (บันทึกรับ-จ่าย) · tracking เท่านั้น ไม่ใช่บัญชี/ภาษี
// pattern เดียวกับ ops: svc() + authed() (cookie ops_admin) + server actions · service_role
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import FinanceClient from './FinanceClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/finance'

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
    ;(await cookies()).set(COOKIE, secret, { httpOnly: true,secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  }
  revalidatePath(PATH)
}
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

export default async function FinancePage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>Finance</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600 }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  // เช็คสวิตช์ finance (โมดูลปิดได้จาก Control Panel)
  const { data: flagRow } = await svc().from('site_settings').select('enabled').eq('key', 'finance').maybeSingle()
  if (flagRow && flagRow.enabled === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4EFE4', color: '#5F5E5A', fontSize: 15 }}>
        โมดูล Finance ปิดอยู่ — เปิดได้ที่ Control Panel (/ops-x7k2m9/settings)
      </div>
    )
  }

  const { data } = await svc().from('finance_entries').select('*').order('entry_date', { ascending: false }).order('id', { ascending: false }).limit(1000)
  return <FinanceClient entries={data || []} addEntry={addEntry} deleteEntry={deleteEntry} />
}
