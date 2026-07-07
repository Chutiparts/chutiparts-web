// app/ops-x7k2m9/risk-guard/page.tsx — ChutiBenz Stock / Risk Guard P0
// เตือน: สินค้าค้างนาน · ไม่อัปเดตนาน · ข้อมูลไม่ครบ · lead/task เกินกำหนด
// อ่านล้วน (read-only) จาก products + contact_leads + ops_tasks ด้วย service_role (ข้าม RLS)
// pattern เดียวกับ ops เดิม: svc() + authed() (cookie ops_admin) + loginOps · ไม่มี mutation · ไม่แตะ margin (P1)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import RiskGuardClient from './RiskGuardClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/risk-guard'

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

export default async function RiskGuardPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>Stock / Risk Guard</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  // อ่านล้วน — products (limit 2000 พอสำหรับสต็อกปัจจุบัน ~100) + leads/tasks สำหรับ overdue
  const [prodRes, leadsRes, tasksRes] = await Promise.all([
    svc().from('products').select('*').limit(2000),
    svc().from('contact_leads').select('*').order('created_at', { ascending: false }).limit(500),
    svc().from('ops_tasks').select('*').order('created_at', { ascending: false }).limit(500),
  ])

  return <RiskGuardClient products={prodRes.data || []} leads={leadsRes.data || []} tasks={tasksRes.data || []} />
}
