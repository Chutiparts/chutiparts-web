'use client'
// components/OpsShell.tsx — Mini ERP Command Center shell (navigation layer เท่านั้น)
// Desktop = เมนูซ้าย · Mobile = แท็บล่าง · ห่อทุกหน้า ops ผ่าน layout · ไม่แตะ logic/data/URL เดิม
// เมนูเป็นแค่ลิงก์ไปหน้าเดิม (แต่ละหน้ายังโหลดข้อมูลตัวเอง) — รู้สึกเหมือนแอปเดียว
import { usePathname } from 'next/navigation'

const BASE = '/ops-x7k2m9'
type Item = { href: string; label: string; icon: string; match?: string }
const ITEMS: Item[] = [
  { href: `${BASE}/daily-brief`,  label: 'Daily Brief',  icon: '☀️' },
  { href: `${BASE}/parts-desk`,   label: 'Leads',        icon: '📇' },
  { href: `${BASE}/parts-desk?tab=tasks`, label: 'Tasks', icon: '🗂️', match: `${BASE}/parts-desk` },
  { href: `${BASE}/risk-guard`,   label: 'Risk Guard',   icon: '🛡️' },
  { href: `${BASE}/profit-guard`, label: 'Profit Guard', icon: '📊' },
  { href: `${BASE}/finance`,      label: 'Finance',      icon: '💰' },
  { href: `${BASE}/web-checker`,  label: 'Web Checker',  icon: '✅' },
]

const CSS = `
.opsx-shell{--w:210px}
.opsx-side{position:fixed;top:0;left:0;bottom:0;width:var(--w);background:#17301F;border-right:1px solid rgba(255,255,255,.1);padding:14px 10px;overflow-y:auto;z-index:100;display:flex;flex-direction:column;gap:4px;box-sizing:border-box}
.opsx-brand{color:#C9A961;font-family:Georgia,serif;font-weight:700;font-size:16px;padding:4px 10px 12px;line-height:1.2}
.opsx-brand small{display:block;color:#8fae99;font-family:-apple-system,sans-serif;font-size:10.5px;font-weight:400;margin-top:2px}
.opsx-link{display:flex;align-items:center;gap:9px;text-decoration:none;border-radius:10px;padding:10px 12px;font-size:14px;font-weight:600;color:#e8efe9;border:1px solid transparent}
.opsx-link:hover{background:rgba(255,255,255,.07)}
.opsx-link.active{background:#C9A961;color:#17301F}
.opsx-main{margin-left:var(--w);min-height:100vh}
.opsx-bottom{display:none}
@media (max-width:768px){
 .opsx-side{display:none}
 .opsx-main{margin-left:0;padding-bottom:66px}
 .opsx-bottom{display:flex;position:fixed;left:0;right:0;bottom:0;background:#17301F;border-top:1px solid rgba(255,255,255,.14);z-index:100;overflow-x:auto}
 .opsx-blink{flex:1 0 auto;min-width:62px;display:flex;flex-direction:column;align-items:center;gap:2px;text-decoration:none;padding:7px 6px;font-size:10px;font-weight:600;color:#cfe0d4;border-top:3px solid transparent;white-space:nowrap}
 .opsx-blink.active{color:#C9A961;border-top-color:#C9A961}
 .opsx-bicon{font-size:17px;line-height:1}
}
`

export default function OpsShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || ''
  const isActive = (it: Item) => { const m = it.match || it.href.split('?')[0]; return path === m || path.startsWith(m + '/') }
  return (
    <div className="opsx-shell">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Desktop = เมนูซ้าย */}
      <aside className="opsx-side">
        <div className="opsx-brand">ChutiBenz<small>Mini ERP · Command Center</small></div>
        {ITEMS.map((it) => (
          <a key={it.label} href={it.href} className={`opsx-link${isActive(it) ? ' active' : ''}`}>
            <span>{it.icon}</span><span>{it.label}</span>
          </a>
        ))}
      </aside>

      {/* Mobile = แท็บล่าง */}
      <nav className="opsx-bottom">
        {ITEMS.map((it) => (
          <a key={it.label} href={it.href} className={`opsx-blink${isActive(it) ? ' active' : ''}`}>
            <span className="opsx-bicon">{it.icon}</span><span>{it.label}</span>
          </a>
        ))}
      </nav>

      <main className="opsx-main">{children}</main>
    </div>
  )
}
