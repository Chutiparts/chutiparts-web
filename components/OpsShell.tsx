'use client'
// components/OpsShell.tsx — Mini ERP shell (เมนู navigation)
// โครงใหม่: หลัก · ปฏิบัติการ (3 hub แบบ accordion: การเงิน/สต็อก/เอกสาร) · ระบบ
// RBAC: พนักงาน docbrief (reviewer/operator/viewer) เห็นเฉพาะเมนูเอกสารที่จำเป็น
//   owner เห็นครบ · team (parts-desk) เห็นเมนูทั่วไป · ซ่อน (hidden) = ไม่โชว์ แต่โค้ด+URL ยังอยู่
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const BASE = '/ops-x7k2m9'
// doc = เมนู docbrief (พนักงาน+owner เห็น) · docOwner = docbrief แต่ owner เท่านั้น
// ownerOnly = การเงิน/ระบบ (owner) · hidden = ไม่โชว์ (เก็บโค้ดไว้) · plain = ทั่วไป (team เห็น)
type Item = { href: string; label: string; icon: string; match?: string; doc?: boolean; docOwner?: boolean; ownerOnly?: boolean; hidden?: boolean; badgeKey?: string; badgeTone?: 'red' | 'amber' }
type Hub = { key: string; label: string; icon: string; items: Item[] }

const MAIN: Item[] = [
  { href: `${BASE}/daily-brief`, label: 'Daily Brief', icon: '☀️', ownerOnly: true },
  { href: `${BASE}/parts-desk`, label: 'Leads', icon: '📇' },
  { href: `${BASE}/parts-desk?tab=tasks`, label: 'Tasks', icon: '🗂️', match: `${BASE}/parts-desk`, badgeKey: 'tasks', badgeTone: 'amber' },
]
const HUBS: Hub[] = [
  { key: 'finance', label: 'การเงิน', icon: '💰', items: [
    { href: `${BASE}/ledger`, label: 'Ledger', icon: '📒', ownerOnly: true },
    { href: `${BASE}/sell`, label: 'ขายออก', icon: '🧾' },
    { href: `${BASE}/landed-cost`, label: 'Landed Cost', icon: '🧮', ownerOnly: true },
  ]},
  { key: 'stock', label: 'สต็อก', icon: '📦', items: [
    { href: `${BASE}/stock-source`, label: 'Stock', icon: '📦', ownerOnly: true, badgeKey: 'lowstock', badgeTone: 'red' },
    { href: `${BASE}/sourcing`, label: 'หาของ', icon: '🔧' },
    { href: `${BASE}/add-part`, label: 'เพิ่มสินค้า', icon: '➕' },
    { href: `${BASE}/photo`, label: 'อัพรูป', icon: '📷' },
    { href: `${BASE}/sync-stock`, label: 'Sync สต็อก', icon: '🔄', ownerOnly: true, hidden: true }, // แทนด้วย "รับเข้าสต็อก" แล้ว
  ]},
  { key: 'docs', label: 'เอกสาร', icon: '📄', items: [
    { href: `${BASE}/inbox`, label: 'กล่องงาน', icon: '📥', doc: true },
    { href: `${BASE}/documents`, label: 'บัญชี', icon: '📄', doc: true },
    { href: `${BASE}/stock-intake`, label: 'รับเข้าสต็อก', icon: '📦', doc: true },
    { href: `${BASE}/repository`, label: 'คลังเอกสาร', icon: '🗂️', doc: true },
    { href: `${BASE}/doc-metrics`, label: 'ต้นทุน AI', icon: '📊', docOwner: true },
    { href: `${BASE}/trash`, label: 'ถังทิ้ง', icon: '🗑', docOwner: true },
  ]},
]
const SYSTEM: Item[] = [
  { href: `${BASE}/garages`, label: 'อู่เบนซ์ (directory)', icon: '🔧', ownerOnly: true },
  { href: `${BASE}/web-checker`, label: 'Monitor', icon: '🩺', ownerOnly: true },
]
const ALL_ITEMS: Item[] = [...MAIN, ...HUBS.flatMap((h) => h.items), ...SYSTEM]

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', reviewer: 'ผู้ตรวจ', operator: 'ผู้ปฏิบัติงาน', viewer: 'ผู้ดู', team: 'ทีม' }

const CSS = `
.opsx-shell{--w:210px}
.opsx-side{position:fixed;top:0;left:0;bottom:0;width:var(--w);background:#17301F;border-right:1px solid rgba(255,255,255,.1);padding:14px 10px;overflow-y:auto;z-index:100;display:flex;flex-direction:column;gap:2px;box-sizing:border-box}
.opsx-brand{color:#C9A961;font-family:Georgia,serif;font-weight:700;font-size:16px;padding:4px 10px 12px;line-height:1.2}
.opsx-brand small{display:block;color:#8fae99;font-family:-apple-system,sans-serif;font-size:10.5px;font-weight:400;margin-top:2px}
.opsx-link{display:flex;align-items:center;gap:9px;text-decoration:none;border-radius:10px;padding:9px 12px;font-size:14px;font-weight:600;color:#e8efe9;border:1px solid transparent}
.opsx-link:hover{background:rgba(255,255,255,.07)}
.opsx-link.active{background:#C9A961;color:#17301F}
.opsx-sub{padding-left:20px;font-size:13.5px}
.opsx-ghead{color:#8fae99;font-size:10.5px;font-weight:700;letter-spacing:.08em;padding:12px 12px 3px;user-select:none}
.opsx-hub{display:flex;align-items:center;gap:9px;width:100%;background:none;border:1px solid transparent;border-radius:10px;padding:9px 12px;font-size:14px;font-weight:600;color:#e8efe9;cursor:pointer;text-align:left}
.opsx-hub:hover{background:rgba(255,255,255,.07)}
.opsx-hub.has-active{color:#C9A961}
.opsx-caret{margin-left:auto;font-size:10px;opacity:.7;transition:transform .15s}
.opsx-caret.open{transform:rotate(90deg)}
.opsx-main{margin-left:var(--w);min-height:100vh}
.opsx-pill{border-radius:999px;font-size:11px;font-weight:700;padding:1px 7px;line-height:1.6;white-space:nowrap}
.opsx-bdot{position:absolute;top:-5px;right:-9px;min-width:15px;height:15px;line-height:15px;border-radius:999px;font-size:9px;font-weight:700;color:#fff;padding:0 3px;text-align:center;box-sizing:border-box}
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

export default function OpsShell({ children, role = 'owner', badges = {} }: { children: React.ReactNode; role?: string; badges?: Record<string, number> }) {
  const path = usePathname() || ''
  const TONE: Record<'red' | 'amber', { bg: string; fg: string }> = { red: { bg: '#FCEBEB', fg: '#A32D2D' }, amber: { bg: '#FAEEDA', fg: '#854F0B' } }
  // badge จาก prop (count-only จาก layout) → เลข + tone · 0/undefined = ไม่โชว์
  const badgeOf = (it: Item): { n: number; tone: 'red' | 'amber' } | null => {
    if (!it.badgeKey) return null
    const n = badges[it.badgeKey] || 0
    return n > 0 ? { n, tone: it.badgeTone || 'amber' } : null
  }
  // ผลรวม badge ของ hub (โชว์ที่หัวเมื่อ hub ปิด) · tone แดงชนะ (เร่งกว่า)
  const hubBadge = (h: Hub): { n: number; tone: 'red' | 'amber' } | null => {
    let n = 0; let tone: 'red' | 'amber' = 'amber'
    for (const it of h.items) { const b = badgeOf(it); if (b) { n += b.n; if (b.tone === 'red') tone = 'red' } }
    return n > 0 ? { n, tone } : null
  }
  const Pill = ({ n, tone }: { n: number; tone: 'red' | 'amber' }) => (
    <span className="opsx-pill" style={{ background: TONE[tone].bg, color: TONE[tone].fg }}>{n}</span>
  )
  const DOC_ROLES = new Set(['owner', 'reviewer', 'operator', 'viewer'])
  const isDocStaff = role === 'reviewer' || role === 'operator' || role === 'viewer'
  const canSee = (it: Item) => {
    if (it.hidden) return false
    if (it.docOwner) return role === 'owner'          // เมนู docbrief เฉพาะ owner (ต้นทุน AI / ถังทิ้ง)
    if (it.doc) return DOC_ROLES.has(role)            // เมนู docbrief พนักงานเห็น
    if (isDocStaff) return false                       // พนักงาน docbrief → เห็นเฉพาะเมนูเอกสาร
    if (it.ownerOnly) return role === 'owner'          // การเงิน/ระบบ
    return true                                        // ทั่วไป (team เห็น)
  }

  const linkTarget = (h: string) => (h.endsWith('.html') ? { target: '_blank', rel: 'noopener' } : {})
  const sp = useSearchParams()
  const activeHref = (() => {
    const pd = `${BASE}/parts-desk`
    if (path === pd || path.startsWith(pd + '/')) return sp?.get('tab') === 'tasks' ? `${pd}?tab=tasks` : pd
    const hit = ALL_ITEMS.find((it) => { const b = it.href.split('?')[0]; return path === b || path.startsWith(b + '/') })
    return hit ? hit.href : ''
  })()
  const isActive = (it: Item) => it.href === activeHref
  const activeHubKey = HUBS.find((h) => h.items.some((it) => it.href === activeHref))?.key ?? ''

  // accordion: ค่าเริ่มต้น = เปิด hub ที่มีหน้าปัจจุบัน · ผู้ใช้กดเปิด/ปิดเองได้
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isHubOpen = (key: string) => toggled[key] ?? (key === activeHubKey)

  const visMain = MAIN.filter(canSee)
  const visHubs = HUBS.map((h) => ({ ...h, items: h.items.filter(canSee) })).filter((h) => h.items.length > 0)
  const visSystem = SYSTEM.filter(canSee)
  const visMobile = [...visMain, ...visHubs.flatMap((h) => h.items), ...visSystem]

  const Link = ({ it, sub }: { it: Item; sub?: boolean }) => {
    const b = badgeOf(it)
    return (
      <a href={it.href} {...linkTarget(it.href)} className={`opsx-link${sub ? ' opsx-sub' : ''}${isActive(it) ? ' active' : ''}`}>
        <span>{it.icon}</span><span>{it.label}</span>
        {b && <Pill n={b.n} tone={b.tone} />}
      </a>
    )
  }

  return (
    <div className="opsx-shell">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <aside className="opsx-side">
        <div className="opsx-brand">ChutiBenz<small>Mini ERP · {ROLE_LABEL[role] || 'Command Center'}</small></div>

        {visMain.length > 0 && <><div className="opsx-ghead">หลัก</div>{visMain.map((it) => <Link key={it.label} it={it} />)}</>}

        {visHubs.length > 0 && (
          <>
            <div className="opsx-ghead">ปฏิบัติการ</div>
            {visHubs.map((h) => {
              const open = isHubOpen(h.key)
              const hasActive = h.key === activeHubKey
              return (
                <div key={h.key}>
                  <button type="button" className={`opsx-hub${hasActive ? ' has-active' : ''}`} onClick={() => setToggled((t) => ({ ...t, [h.key]: !open }))}>
                    <span>{h.icon}</span><span>{h.label}</span>
                    {!open && (() => { const hb = hubBadge(h); return hb ? <Pill n={hb.n} tone={hb.tone} /> : null })()}
                    <span className={`opsx-caret${open ? ' open' : ''}`}>▶</span>
                  </button>
                  {open && h.items.map((it) => <Link key={it.label} it={it} sub />)}
                </div>
              )
            })}
          </>
        )}

        {visSystem.length > 0 && <><div className="opsx-ghead">ระบบ</div>{visSystem.map((it) => <Link key={it.label} it={it} />)}</>}
      </aside>

      <nav className="opsx-bottom">
        {visMobile.map((it) => {
          const b = badgeOf(it)
          return (
            <a key={it.label} href={it.href} {...linkTarget(it.href)} className={`opsx-blink${isActive(it) ? ' active' : ''}`}>
              <span className="opsx-bicon" style={{ position: 'relative' }}>{it.icon}{b && <span className="opsx-bdot" style={{ background: TONE[b.tone].fg }}>{b.n > 99 ? '99+' : b.n}</span>}</span><span>{it.label}</span>
            </a>
          )
        })}
      </nav>

      <main className="opsx-main">{children}</main>
    </div>
  )
}
