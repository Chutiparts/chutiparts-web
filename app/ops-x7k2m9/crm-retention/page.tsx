// app/ops-x7k2m9/crm-retention/page.tsx — ChutiBenz CRM & Retention P0
// ดึงลูกค้าเก่ากลับมาซื้อซ้ำ · จัดกลุ่มลูกค้าจาก contact_leads เดิม (ไม่มี table ใหม่)
// pattern เดียวกับ ops เดิม: svc() + authed() (cookie ops_admin) + server actions (reuse updateLead/addTask)
// ⚠️ ไม่ส่งข้อความจริง · ไม่ลบข้อมูล · ไม่แตะ logic โมดูลอื่น (มี server action ของตัวเอง แต่ pattern เดิม)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import CrmClient from './CrmClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/crm-retention'

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

// อัปเดต lead (owner/สถานะ/วันตาม) — pattern เดียวกับ parts-desk · service_role ข้าม RLS · ไม่ลบ
async function updateLead(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { last_activity_at: now, updated_at: now }
  const fields = ['status', 'priority', 'next_action', 'follow_due', 'last_note', 'owner']
  for (const f of fields) {
    const v = formData.get(f)
    if (v !== null) patch[f] = String(v) === '' ? null : String(v)
  }
  await svc().from('contact_leads').update(patch).eq('id', id)
  revalidatePath(PATH)
}

// สร้าง task จากลูกค้า/lead — insert ops_tasks (ห้ามลบ · pattern เดิม)
async function addTask(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const title = String(formData.get('title') || '').trim()
  if (!title) return
  const s = (k: string) => { const v = formData.get(k); return v === null || String(v) === '' ? null : String(v) }
  await svc().from('ops_tasks').insert({
    title,
    owner: s('owner'),
    status: s('status') || 'todo',
    priority: s('priority') || 'medium',
    due_date: s('due_date'),
    task_type: s('task_type') || 'ตามโอน',
    note: s('note'),
    linked_lead_id: s('linked_lead_id'),
  })
  revalidatePath(PATH)
}

export default async function CrmPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>CRM / ลูกค้าเก่า</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  const leadsRes = await svc().from('contact_leads').select('*').order('created_at', { ascending: false }).limit(1000)

  return <CrmClient leads={leadsRes.data || []} updateLead={updateLead} addTask={addTask} />
}
