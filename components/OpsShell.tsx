'use client'
// components/OpsShell.tsx — Mini ERP shell (เมนู navigation)
// โครง (reorg): 5 section headers · Daily Brief บนสุด · hub accordion เดิม (สต็อก&Sourcing/สินค้า/เอกสาร)
//   Section = { header?, entries: (Item|Hub)[] } · entry = link เดี่ยว หรือ hub พับได้
// RBAC: พนักงาน docbrief (reviewer/operator/viewer) เห็นเฉพาะเมนูเอกสาร · owner เห็นครบ · team เห็นทั่วไป
//   role flag (doc/docOwner/ownerOnly) ติดกับ item เดิมแม้ย้ายกลุ่ม · canSee logic ไม่แตะพฤติกรรม
// badges: prop count-only จาก layout (tasks/lowstock) → pill ท้าย label · read-only
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const BASE = '/ops-x7k2m9'
// href? = ไม่มี = soon placeholder (กดไม่ได้) · doc/docOwner/ownerOnly/hidden = RBAC เดิม · badgeKey → pill
type Item = { href?: string; label: string; icon: string; match?: string; badgeKey?: string; soon?: boolean; doc?: boolean; docOwner?: boolean; ownerOnly?: boolean; hidden?: boolean }
type Hub = { key: string; label: string; icon: string; items: Item[] }
type Section = { header?: string; entries: (Item | Hub)[] }

const isHub = (e: Item | Hub): e is Hub => 'items' in e
const BADGE_TONE: Record<string, 'red' | 'amber'> = { tasks: 'amber', lowstock: 'red' }

const SECTIONS: Section[] = [
  // บนสุด (ไม่มี header)
  { entries: [
    { href: `${BASE}/daily-brief`, label: 'Daily Brief', icon: '☀️', ownerOnly: true },
    { href: `${BASE}/radar`, label: 'Demand Radar', icon: '🛰️', ownerOnly: true },
  ] },
  { header: 'ลูกค้า & งาน', entries: [
    { href: `${BASE}/parts-desk`, label: 'Leads & Follow-up', icon: '📇', badgeKey: 'tasks' }, // รวม Leads+Tasks (Tasks = แท็บในหน้า)
    { label: 'Voice / AI Conversations', icon: '🎙️', soon: true }, // plain · เร็วๆ นี้
  ] },
  { header: 'การเงิน', entries: [
    { href: `${BASE}/sell`, label: 'ขายออก', icon: '🧾' },
    { href: `${BASE}/ledger`, label: 'Ledger', icon: '📒', ownerOnly: true },
    { label: 'รายเดือน', icon: '📅', ownerOnly: true, soon: true }, // เร็วๆ นี้
    { href: `${BASE}/landed-cost`, label: 'Landed Cost', icon: '🧮', ownerOnly: true },
  ] },
  { header: 'สต็อก & สินค้า', entries: [
    { key: 'stock', label: 'สต็อก & Sourcing', icon: '📦', items: [
      { href: `${BASE}/stock-source`, label: 'สต็อก', icon: '📦', ownerOnly: true, badgeKey: 'lowstock' },
      { href: `${BASE}/sourcing`, label: 'หาของ', icon: '🔧' },
      { href: `${BASE}/stock-intake`, label: 'รับเข้าสต็อก', icon: '🚚', doc: true }, // ย้ายมาจากกลุ่มเอกสาร
      { href: `${BASE}/sync-stock`, label: 'Sync สต็อก', icon: '🔄', ownerOnly: true, hidden: true }, // เก็บ URL · ไม่ render
    ] },
    { key: 'goods', label: 'สินค้า', icon: '🏷️', items: [
      { href: `${BASE}/add-part`, label: 'เพิ่มสินค้า', icon: '➕' },
      { href: `${BASE}/photo`, label: 'อัพรูป', icon: '📷' },
      { href: `${BASE}/stock-in`, label: 'รับเข้า+ขึ้นเว็บ', icon: '🚚', ownerOnly: true },
      { href: `${BASE}/sync-now`, label: 'Sync ขึ้นเว็บ', icon: '🔄', ownerOnly: true },
    ] },
  ] },
  { header: 'เอกสาร', entries: [
    { key: 'docs', label: 'เอกสาร', icon: '📄', items: [
      { href: `${BASE}/inbox`, label: 'กล่องงาน', icon: '📥', doc: true },
      { href: `${BASE}/documents`, label: 'บัญชี', icon: '📄', doc: true },
      { href: `${BASE}/repository`, label: 'คลังเอกสาร', icon: '🗂️', doc: true },
    ] },
  ] },
  { header: 'ระบบ', entries: [
    { href: `${BASE}/doc-metrics`, label: 'ต้นทุน AI', icon: '📊', docOwner: true }, // ย้ายมาจากเอกสาร
    { href: `${BASE}/web-checker`, label: 'Monitor', icon: '🩺', ownerOnly: true },
    { href: `${BASE}/garages`, label: 'Directory / อู่เบนซ์', icon: '🔧', ownerOnly: true },
    { href: `${BASE}/trash`, label: 'ถังขยะ', icon: '🗑', docOwner: true }, // ท้ายสุด
  ] },
]
const ALL_ITEMS: Item[] = SECTIONS.flatMap((s) => s.entries.flatMap((e) => (isHub(e) ? e.items : [e])))

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
.opsx-soon{opacity:.5;cursor:default}
.opsx-soon:hover{background:none}
.opsx-soon-tag{margin-left:auto;font-size:9px;font-weight:700;background:#eee;color:#999;border-radius:6px;padding:1px 6px;white-space:nowrap}
.opsx-pill{border-radius:999px;font-size:11px;font-weight:700;padding:1px 7px;line-height:1.6;white-space:nowrap}
.opsx-bdot{position:absolute;top:-5px;right:-9px;min-width:15px;height:15px;line-height:15px;border-radius:999px;font-size:9px;font-weight:700;color:#fff;padding:0 3px;text-align:center;box-sizing:border-box}
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

export default function OpsShell({ children, role = 'owner', badges = {} }: { children: React.ReactNode; role?: string; badges?: Record<string, number> }) {
  const path = usePathname() || ''
  const TONE: Record<'red' | 'amber', { bg: string; fg: string }> = { red: { bg: '#FCEBEB', fg: '#A32D2D' }, amber: { bg: '#FAEEDA', fg: '#854F0B' } }
  // badge จาก prop (count-only จาก layout) · tone มาจาก badgeKey · 0/undefined = ไม่โชว์
  const badgeOf = (it: Item): { n: number; tone: 'red' | 'amber' } | null => {
    if (!it.badgeKey) return null
    const n = badges[it.badgeKey] || 0
    return n > 0 ? { n, tone: BADGE_TONE[it.badgeKey] || 'amber' } : null
  }
  // ผลรวม badge ของ hub (โชว์ที่หัวเมื่อ hub ปิด) · tone แดงชนะ
  const hubBadge = (h: Hub): { n: number; tone: 'red' | 'amber' } | null => {
    let n = 0; let tone: 'red' | 'amber' = 'amber'
    for (const it of h.items) { const b = badgeOf(it); if (b) { n += b.n; if (b.tone === 'red') tone = 'red' } }
    return n > 0 ? { n, tone } : null
  }
  const Pill = ({ n, tone }: { n: number; tone: 'red' | 'amber' }) => (
    <span className="opsx-pill" style={{ background: TONE[tone].bg, color: TONE[tone].fg }}>{n}</span>
  )

  // RBAC — คงเดิมทุกบรรทัด (ไม่แตะ behavior)
  const DOC_ROLES = new Set(['owner', 'reviewer', 'operator', 'viewer'])
  const isDocStaff = role === 'reviewer' || role === 'operator' || role === 'viewer'
  const canSee = (it: Item) => {
    if (it.hidden) return false
    if (it.docOwner) return role === 'owner'          // เมนู docbrief เฉพาะ owner (ต้นทุน AI / ถังขยะ)
    if (it.doc) return DOC_ROLES.has(role)            // เมนู docbrief พนักงานเห็น
    if (isDocStaff) return false                       // พนักงาน docbrief → เห็นเฉพาะเมนูเอกสาร
    if (it.ownerOnly) return role === 'owner'          // การเงิน/ระบบ
    return true                                        // ทั่วไป (team เห็น)
  }

  const linkTarget = (h: string) => (h.endsWith('.html') ? { target: '_blank', rel: 'noopener' } : {})
  const activeHref = (() => {
    const pd = `${BASE}/parts-desk`
    if (path === pd || path.startsWith(pd + '/')) return pd // Leads & Follow-up ครอบทุก tab
    const hit = ALL_ITEMS.find((it) => { if (!it.href) return false; const b = it.href.split('?')[0]; return path === b || path.startsWith(b + '/') })
    return hit ? hit.href : ''
  })()
  const isActive = (it: Item) => !!it.href && it.href === activeHref

  // hide-empty: กรอง item ตาม canSee → hub/section ที่ไม่เหลือ item = ไม่ render (header หายด้วย)
  const visSections = SECTIONS.map((sec) => {
    const entries = sec.entries.reduce<(Item | Hub)[]>((acc, e) => {
      if (isHub(e)) { const items = e.items.filter(canSee); if (items.length) acc.push({ ...e, items }) }
      else if (canSee(e)) acc.push(e)
      return acc
    }, [])
    return { header: sec.header, entries }
  }).filter((sec) => sec.entries.length > 0)
  // mobile: ทุก item ที่ role เห็น (แบน hub) · ตัด soon (กดไม่ได้)
  const visMobile = visSections.flatMap((s) => s.entries.flatMap((e) => (isHub(e) ? e.items : [e]))).filter((it) => !it.soon && it.href)

  // accordion: ค่าเริ่มต้น = เปิด hub ที่มีหน้าปัจจุบัน · ผู้ใช้กดเปิด/ปิดเองได้
  const activeHubKey = SECTIONS.flatMap((s) => s.entries).filter(isHub).find((h) => h.items.some((it) => it.href === activeHref))?.key ?? ''
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isHubOpen = (key: string) => toggled[key] ?? (key === activeHubKey)

  const Link = ({ it, sub }: { it: Item; sub?: boolean }) => {
    if (it.soon) return (
      <div className={`opsx-link opsx-soon${sub ? ' opsx-sub' : ''}`}><span>{it.icon}</span><span>{it.label}</span><span className="opsx-soon-tag">เร็วๆ นี้</span></div>
    )
    const b = badgeOf(it)
    return (
      <a href={it.href} {...linkTarget(it.href || '')} className={`opsx-link${sub ? ' opsx-sub' : ''}${isActive(it) ? ' active' : ''}`}>
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
        {visSections.map((sec, i) => (
          <div key={sec.header || `sec-${i}`}>
            {sec.header && <div className="opsx-ghead">{sec.header}</div>}
            {sec.entries.map((e) => {
              if (!isHub(e)) return <Link key={e.label} it={e} />
              const open = isHubOpen(e.key)
              const hasActive = e.key === activeHubKey
              return (
                <div key={e.key}>
                  <button type="button" className={`opsx-hub${hasActive ? ' has-active' : ''}`} onClick={() => setToggled((t) => ({ ...t, [e.key]: !open }))}>
                    <span>{e.icon}</span><span>{e.label}</span>
                    {!open && (() => { const hb = hubBadge(e); return hb ? <Pill n={hb.n} tone={hb.tone} /> : null })()}
                    <span className={`opsx-caret${open ? ' open' : ''}`}>▶</span>
                  </button>
                  {open && e.items.map((it) => <Link key={it.label} it={it} sub />)}
                </div>
              )
            })}
          </div>
        ))}
      </aside>

      <nav className="opsx-bottom">
        {visMobile.map((it) => {
          const b = badgeOf(it)
          return (
            <a key={it.label} href={it.href} {...linkTarget(it.href || '')} className={`opsx-blink${isActive(it) ? ' active' : ''}`}>
              <span className="opsx-bicon" style={{ position: 'relative' }}>{it.icon}{b && <span className="opsx-bdot" style={{ background: TONE[b.tone].fg }}>{b.n > 99 ? '99+' : b.n}</span>}</span><span>{it.label}</span>
            </a>
          )
        })}
      </nav>

      <main className="opsx-main">{children}</main>
    </div>
  )
}
