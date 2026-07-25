// app/ops-x7k2m9/layout.tsx — Mini ERP Command Center shell (navigation layer)
// ห่อทุกหน้าใต้ /ops-x7k2m9/* ด้วยเมนู (desktop ซ้าย · mobile ล่าง) — ไม่แตะ page.tsx เดิม
// role-access: อ่าน cookie ครั้งเดียว → ส่ง role เข้า OpsShell (team ซ่อนเมนูการเงิน/ระบบ)
import { cookies } from 'next/headers'
import OpsShell from '@/components/OpsShell'
import { opsRole } from '@/lib/ops-auth'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // RBAC docbrief: owner/reviewer/operator/viewer (จาก cookie ops_admin ตามรหัสที่ตรง)
  const docRole = await opsRole()
  const c = await cookies()
  // 'team' เดิม (cookie ops_team) — ใช้กับเมนูการเงิน/CRM (ไม่ใช่ docbrief)
  const isTeam = !docRole && !!process.env.TEAM_OPS_SECRET && c.get('ops_team')?.value === process.env.TEAM_OPS_SECRET
  const role = docRole ?? (isTeam ? 'team' : 'guest')
  return <OpsShell role={role}>{children}</OpsShell>
}
