// app/ops-x7k2m9/layout.tsx — Mini ERP Command Center shell (navigation layer)
// ห่อทุกหน้าใต้ /ops-x7k2m9/* ด้วยเมนู (desktop ซ้าย · mobile ล่าง) — ไม่แตะ page.tsx เดิม
// role-access: อ่าน cookie ครั้งเดียว → ส่ง role เข้า OpsShell (team ซ่อนเมนูการเงิน/ระบบ)
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import OpsShell from '@/components/OpsShell'
import { opsRole } from '@/lib/ops-auth'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

// นับ badge แบบ count-only (head:true · ไม่ดึงแถว) · read-only
// นิยามตรงกับ Daily Brief: taskOpen = status ไม่ใช่ done/cancelled (null = เปิด) · lowStock = qty<=1
// fetch เฉพาะ role ที่เห็นเมนูนั้นจริง (owner/team) เพื่อไม่ให้ทุก page-load ยิง query เปล่า
// query fail รายตัว → ข้าม (badge หายเฉยๆ · เมนูห้ามล่ม)
async function fetchBadges(role: string): Promise<Record<string, number>> {
  const badges: Record<string, number> = {}
  if (role !== 'owner' && role !== 'team') return badges // staff docbrief/guest ไม่เห็น Tasks/Stock
  const db = svc()
  try {
    const { count } = await db.from('ops_tasks').select('id', { head: true, count: 'exact' })
      .or('status.is.null,status.not.in.(done,cancelled)')
    if (typeof count === 'number') badges.tasks = count
  } catch { /* badge หาย เมนูไม่ล่ม */ }
  if (role === 'owner') { // เมนู Stock = ownerOnly → นับเฉพาะ owner
    try {
      const { count } = await db.from('stock_records').select('id', { head: true, count: 'exact' })
        .lte('qty', 1).is('deleted_at', null)
      if (typeof count === 'number') badges.lowstock = count
    } catch { /* */ }
  }
  return badges
}

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // RBAC docbrief: owner/reviewer/operator/viewer (จาก cookie ops_admin ตามรหัสที่ตรง)
  const docRole = await opsRole()
  const c = await cookies()
  // 'team' เดิม (cookie ops_team) — ใช้กับเมนูการเงิน/CRM (ไม่ใช่ docbrief)
  const isTeam = !docRole && !!process.env.TEAM_OPS_SECRET && c.get('ops_team')?.value === process.env.TEAM_OPS_SECRET
  const role = docRole ?? (isTeam ? 'team' : 'guest')
  const badges = await fetchBadges(role)
  return <OpsShell role={role} badges={badges}>{children}</OpsShell>
}
