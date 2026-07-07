// app/ops-x7k2m9/layout.tsx — Mini ERP Command Center shell (navigation layer)
// ห่อทุกหน้าใต้ /ops-x7k2m9/* ด้วยเมนู (desktop ซ้าย · mobile ล่าง) — ไม่แตะ page.tsx เดิม
// URL เดิมยังเปิดได้ปกติ · logic/data เดิมใช้ต่อทั้งหมด
import OpsShell from '@/components/OpsShell'

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <OpsShell>{children}</OpsShell>
}
