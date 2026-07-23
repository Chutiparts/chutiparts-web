'use client'
// components/OpsShell.tsx — Mini ERP Command Center shell (navigation layer เท่านั้น)
// Desktop = เมนูซ้าย · Mobile = แท็บล่าง · ห่อทุกหน้า ops ผ่าน layout · ไม่แตะ logic/data/URL เดิม
// เมนูเป็นแค่ลิงก์ไปหน้าเดิม (แต่ละหน้ายังโหลดข้อมูลตัวเอง) — รู้สึกเหมือนแอปเดียว
// PathB: เพิ่มเมนู "🔄 Sync สต็อก" (/sync-stock) ใต้กลุ่มเงิน&สต็อก
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const BASE = '/ops-x7k2m9'
type Item = { href: string; label: string; icon: string; match?: string; ownerOnly?: boolean }
// P0.2 Lean: regroup เป็น Lean 8 · Daily Brief = home · ซ่อนเมนูเดี่ยว CRM/RiskGuard/Finance/ProfitGuard
// (หน้าเดิมยังเปิดได้ตรง URL — แค่ไม่อยู่ top-level · Level B ค่อยรวมเนื้อหาเข้าโมดูลแม่)
// #7 AI Search = หน้า public /search (ไม่อยู่เมนู ops · roadmap เดือน 3) · WebChecker → System Monitor (#8)
type Group = { title: string; items: Item[] }
const GROUPS: Group[] = [
  { title: 'หลัก', items: [
    { href: `${BASE}/daily-brief`, label: 'Daily Brief', icon: '☀️', ownerOnly: true },
    { href: `${BASE}/parts-desk`, label: 'Leads', icon: '📇' },
    { href: `${BASE}/parts-desk?tab=tasks`, label: 'Tasks', icon: '🗂️', match: `${BASE}/parts-desk` },
  ]},
  { title: 'เงิน & สต็อก', items: [
    { href: `${BASE}/ledger`, label: 'Ledger', icon: '📒', ownerOnly: true },
    { href: `${BASE}/landed-cost`, label: 'Landed Cost', icon: '🧮', ownerOnly: true },
    { href: `${BASE}/stock-source`, label: 'Stock', icon: '📦', ownerOnly: true },
    { href: `${BASE}/sync-stock`, label: 'Sync สต็อก', icon: '🔄' },
    { href: `${BASE}/sourcing`, label: 'หาของ', icon: '🔧' },
    { href: `${BASE}/sell`, label: 'ขายออก', icon: '🧾' },
    { href: `${BASE}/documents`, label: 'เอกสาร', icon: '📄', ownerOnly: true },
  ]},
  { title: 'ระบบ', items: [
    { href: `${BASE}/web-checker`, label: 'Monitor', icon: '🩺', ownerOnly: true },
  ]},
]
const ITEMS: Item[] = GROUPS.flatMap((g) => g.items)
// mobile: Daily Brief ขึ้นแท็บแรก (หน้าที่เปิดบ่อยสุด — ไม่ต้องเลื่อนหา) ที่เหลือเรียงตามกลุ่ม
const MOBILE_ITEMS: Item[] = [...ITEMS.filter((i) => i.label === 'Daily Brief'), ...ITEMS.filter((i) => i.label !== 'Daily Brief')]

const CSS = `
.opsx-shell{--w:210px}
.opsx-side{position:fixed;top:0;left:0;bottom:0;width:var(--w);background:#17301F;border-right:1px solid rgba(255,255,255,.1);padding:14px 10px;overflow-y:auto;z-index:100;display:flex;flex-direction:column;gap:4px;box-sizing:border-box}
.opsx-brand{color:#C9A961;font-family:Georgia,serif;font-weight:700;font-size:16px;padding:4px 10px 12px;line-height:1.2}
.opsx-brand small{display:block;color:#8fae99;font-family:-apple-system,sans-serif;font-size:10.5px;font-weight:400;margin-top:2px}
.opsx-link{display:flex;align-items:center;gap:9px;text-decoration:none;border-radius:10px;padding:10px 12px;font-size:14px;font-weight:600;color:#e8efe9;border:1px solid transparent}
.opsx-link:hover{background:rgba(255,255,255,.07)}
.opsx-link.active{background:#C9A961;color:#17301F}
.opsx-ghead{color:#8fae99;font-size:10.5px;font-weight:700;letter-spacing:.08em;padding:12px 12px 3px;user-select:none}
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

export default function OpsShell({ children, role = 'owner' }: { children: React.ReactNode; role?: string }) {
  const path = usePathname() || ''
  // role-access: team เห็นเฉพาะเมนูที่ไม่ ownerOnly (ซ่อน Daily Brief/Ledger/Landed Cost/Monitor) · owner เห็นครบ
  const canSee = (it: Item) => role === 'owner' || !it.ownerOnly
  const visGroups = GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter((g) => g.items.length > 0)
  const visMobile = MOBILE_ITEMS.filter(canSee)
  // ไฮไลต์ทีละปุ่มเดียว: parts-desk แยก Leads/Tasks ด้วย ?tab=tasks · หน้าอื่นเทียบ pathname ตรง ๆ
  const [search, setSearch] = useState('')
  useEffect(() => { setSearch(typeof window !== 'undefined' ? window.location.search : '') }, [path])
  const activeHref = (() => {
    const pd = `${BASE}/parts-desk`
    if (path === pd || path.startsWith(pd + '/')) return search.includes('tab=tasks') ? `${pd}?tab=tasks` : pd
    const hit = ITEMS.find((it) => { const b = it.href.split('?')[0]; return path === b || path.startsWith(b + '/') })
    return hit ? hit.href : ''
  })()
  const isActive = (it: Item) => it.href === activeHref
  return (
    <div className="opsx-shell">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Desktop = เมนูซ้าย */}
      <aside className="opsx-side">
        <div className="opsx-brand">ChutiBenz<small>Mini ERP · Command Center</small></div>
        {visGroups.map((g) => (
          <div key={g.title}>
            <div className="opsx-ghead">{g.title}</div>
            {g.items.map((it) => (
              <a key={it.label} href={it.href} target={it.href.endsWith('.html') ? '_blank' : undefined} rel={it.href.endsWith('.html') ? 'noopener' : undefined} className={`opsx-link${isActive(it) ? ' active' : ''}`}>
                <span>{it.icon}</span><span>{it.label}</span>
              </a>
            ))}
          </div>
        ))}
      </aside>

      {/* Mobile = แท็บล่าง */}
      <nav className="opsx-bottom">
        {visMobile.map((it) => (
          <a key={it.label} href={it.href} target={it.href.endsWith('.html') ? '_blank' : undefined} rel={it.href.endsWith('.html') ? 'noopener' : undefined} className={`opsx-blink${isActive(it) ? ' active' : ''}`}>
            <span className="opsx-bicon">{it.icon}</span><span>{it.label}</span>
          </a>
        ))}
      </nav>

      <main className="opsx-main">{children}</main>
    </div>
  )
}
