// app/ops-x7k2m9/layout.tsx — Mini ERP Command Center shell (navigation layer)
// ห่อทุกหน้าใต้ /ops-x7k2m9/* ด้วยเมนู (desktop ซ้าย · mobile ล่าง) — ไม่แตะ page.tsx เดิม
// role-access: อ่าน cookie ครั้งเดียว → ส่ง role เข้า OpsShell (team ซ่อนเมนูการเงิน/ระบบ)
import { cookies } from 'next/headers'
import OpsShell from '@/components/OpsShell'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies()
  const isOwner = c.get('ops_admin')?.value === process.env.ADMIN_OPS_SECRET
  const isTeam = !isOwner && !!process.env.TEAM_OPS_SECRET && c.get('ops_team')?.value === process.env.TEAM_OPS_SECRET
  const role = isOwner ? 'owner' : isTeam ? 'team' : 'guest'
  return <OpsShell role={role}>{children}</OpsShell>
}
