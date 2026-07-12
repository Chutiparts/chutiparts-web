'use client'
// app/ops-x7k2m9/daily-brief/DailyBriefClient.tsx — Command Center P0 (อ่านล้วน + copy/export)
// รวมงานเช้าจาก Lead & Follow-up + Task Ops มาหน้าเดียว: ต้องตาม/ต้องทำ/เกินกำหนด/ไม่มีเจ้าของ/ตัดสินใจ/เสี่ยง
// rule-based ล้วน (ไม่มี AI จริง) · ไม่ส่งข้อความ/แจ้งเตือนจริง · ไม่ลบ/แก้ข้อมูล · map สถานะให้ตรงกับ 2 โมดูลเดิม
import { useMemo, useState } from 'react'

type Row = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

// ===== Lead status (ตรงกับ PartsDeskClient) =====
const LEAD_STATUS: Record<string, string> = {
  new: 'ใหม่', quoted: 'ส่งรูป/ราคาแล้ว', deciding: 'รอตัดสินใจ', to_follow: 'ต้องตาม', won: 'ปิดการขาย ✓', lost: 'ไม่ซื้อ',
}
const LEGACY: Record<string, string> = { contacted: 'quoted', waiting: 'deciding' }
const normStatus = (s?: string) => { const k = LEGACY[s || ''] || s || 'new'; return LEAD_STATUS[k] ? k : 'new' }
const leadStatusTh = (l: Row) => LEAD_STATUS[normStatus(l.status)]

// ===== Task status/priority (ตรงกับ TaskOps) =====
const TASK_STATUS: Record<string, string> = {
  todo: 'ยังไม่เริ่ม', doing: 'กำลังทำ', waiting: 'รอข้อมูล/ลูกค้า', done: 'เสร็จแล้ว ✓', cancelled: 'ยกเลิก',
}
const TASK_PRIORITY: Record<string, { th: string; bg: string; fg: string }> = {
  high: { th: 'ด่วน', bg: '#FCEBEB', fg: '#A32D2D' },
  medium: { th: 'ปกติ', bg: '#FAEEDA', fg: '#854F0B' },
  low: { th: 'ต่ำ', bg: '#F1EFE8', fg: '#5F5E5A' },
}

const todayStr = () => new Date().toISOString().slice(0, 10)
function shiftStr(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
function daysSince(d?: string | null) { if (!d) return 999; return Math.floor((Date.now() - new Date(d).getTime()) / 86400000) }
function fmtDate(d?: string | null) { if (!d) return '-'; const x = new Date(d); return `${x.getDate()}/${x.getMonth() + 1}` }

// ----- lead helpers -----
const leadOpen = (l: Row) => !['won', 'lost'].includes(normStatus(l.status))
const leadOverdue = (l: Row) => leadOpen(l) && !!l.follow_due && l.follow_due < todayStr()
const leadDueToday = (l: Row) => leadOpen(l) && l.follow_due === todayStr()
const leadNoOwner = (l: Row) => leadOpen(l) && (!l.owner || !String(l.owner).trim())
const partOf = (l: Row) => l.part_wanted || l.part_number || 'อะไหล่'
const contactOf = (l: Row) => l.line_id || l.phone || l.contact_value || '-'
function followMsgTH(l: Row) {
  return `สวัสดีครับ ขออนุญาตติดตามเรื่องอะไหล่ Mercedes-Benz ที่สอบถามไว้ครับ\nรายการ: ${partOf(l)}\nรุ่นรถ: ${l.car_model || '-'}\nหากยังสนใจอยู่ ผมช่วยเช็กของ/รูป/ราคาให้ต่อได้ครับ`
}

// ----- task helpers -----
const taskOpen = (t: Row) => !['done', 'cancelled'].includes(t.status || 'todo')
const taskOverdue = (t: Row) => taskOpen(t) && !!t.due_date && t.due_date < todayStr()
const taskDueToday = (t: Row) => taskOpen(t) && t.due_date === todayStr()
const taskNoOwner = (t: Row) => taskOpen(t) && (!t.owner || !String(t.owner).trim())

// ----- reorder helpers (สรุปย่อจาก Stock Source · เกณฑ์ default: ย้อนหลัง 90 วัน · ขายดี ≥2 · เหลือน้อย ≤1) -----
const rNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }
const rNorm = (s?: any) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const rKey = (part: any, model: any) => rNorm(part) + '|' + rNorm(model)
function reorderSignals(sales: Row[], stock: Row[]): Row[] {
  const cutoff = shiftStr(-90)
  const left: Record<string, number> = {}
  stock.forEach((s) => { if (String(s.status || 'in_stock') === 'in_stock') { const k = rKey(s.part_name, s.car_model); left[k] = (left[k] || 0) + 1 } })
  const g: Record<string, any> = {}
  sales.forEach((r) => {
    if (!r.sale_date || r.sale_date < cutoff) return
    const k = rKey(r.part_sold, r.car_model)
    if (!g[k]) g[k] = { key: k, part: r.part_sold || '(ไม่ระบุ)', model: r.car_model || '', sold: 0, sumProfit: 0 }
    g[k].sold += 1; g[k].sumProfit += rNum(r.sale_price) - rNum(r.cost)
  })
  return Object.values(g)
    .map((x: any) => ({ ...x, left: left[x.key] || 0 }))
    .filter((x: any) => x.left <= 1)
    .map((x: any) => ({ ...x, urgent: x.left === 0 && x.sold >= 2 }))
    .sort((a: any, b: any) => (a.urgent === b.urgent ? b.sold - a.sold : a.urgent ? -1 : 1))
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 8, padding: '9px 11px', marginBottom: 6 }
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }

export default function DailyBriefClient({ leads, tasks, sales = [], stock = [] }: { leads: Row[]; tasks: Row[]; sales?: Row[]; stock?: Row[] }) {
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600) }
  const copy = (text: string, m = 'คัดลอกแล้ว') => navigator.clipboard?.writeText(text).then(() => flash(m))

  const leadName = (id?: string) => { if (!id) return ''; const l = leads.find((x) => x.id === id); return l ? (l.name || '(lead)') : '' }
  const leadModelPart = (id?: string) => { const l = leads.find((x) => x.id === id); return l ? `${partOf(l)}${l.car_model ? ` (${l.car_model})` : ''}` : '' }

  // ===== buckets =====
  const B = useMemo(() => {
    const todayFollow = leads.filter(leadDueToday)
    const overdueLeads = leads.filter(leadOverdue)
    const todayTasks = tasks.filter(taskDueToday)
    const overdueTasks = tasks.filter(taskOverdue)
    const unassignedLeads = leads.filter(leadNoOwner)
    const unassignedTasks = tasks.filter(taskNoOwner)

    // Decision Needed — rule-based
    const decide: { key: string; label: string; reason: string }[] = []
    const cut2 = shiftStr(-2) // เกินกำหนด "มากกว่า 2 วัน" = follow_due/due_date < วันนี้-2
    leads.forEach((l) => {
      if (leadOpen(l) && normStatus(l.status) === 'deciding' && daysSince(l.last_activity_at || l.created_at) > 3)
        decide.push({ key: 'L' + l.id, label: `${l.name || '(ไม่ระบุ)'} — ${partOf(l)}${l.car_model ? ` (${l.car_model})` : ''}`, reason: 'ลูกค้ารอตัดสินใจ > 3 วัน' })
      else if (leadOverdue(l) && l.follow_due < cut2)
        decide.push({ key: 'L' + l.id, label: `${l.name || '(ไม่ระบุ)'} — ${partOf(l)}`, reason: `Lead เกินกำหนดตาม > 2 วัน (${fmtDate(l.follow_due)})` })
    })
    tasks.forEach((t) => {
      if (taskOpen(t) && (t.priority || 'medium') === 'high')
        decide.push({ key: 'T' + t.id, label: `${t.title || '(ไม่มีชื่องาน)'}${t.owner ? ` · ${t.owner}` : ''}`, reason: 'งานด่วน (high) ยังไม่เสร็จ' })
      else if (taskOverdue(t) && t.due_date < cut2)
        decide.push({ key: 'T' + t.id, label: `${t.title || '(ไม่มีชื่องาน)'}`, reason: `Task เกินกำหนด > 2 วัน (${fmtDate(t.due_date)})` })
    })

    return { todayFollow, overdueLeads, todayTasks, overdueTasks, unassignedLeads, unassignedTasks, decide }
  }, [leads, tasks])

  const unassignedCount = B.unassignedLeads.length + B.unassignedTasks.length
  const reorder = useMemo(() => reorderSignals(sales, stock), [sales, stock])
  const reorderUrgent = reorder.filter((x) => x.urgent).length

  // ===== Copy Daily Brief (รูปแบบตามสเปก) =====
  function briefText() {
    const fl = B.todayFollow.length
      ? B.todayFollow.map((l) => `- ${l.name || '(ไม่ระบุ)'} / ${l.car_model || '-'} / ${partOf(l)} / เจ้าของ: ${l.owner || 'ยังไม่มี'}`).join('\n')
      : '- ไม่มีรายการ'
    const tk = B.todayTasks.length
      ? B.todayTasks.map((t) => `- ${t.title || '(ไม่มีชื่องาน)'} / เจ้าของ: ${t.owner || 'ยังไม่มี'} / ความสำคัญ: ${TASK_PRIORITY[t.priority || 'medium'].th}`).join('\n')
      : '- ไม่มีรายการ'
    const dc = B.decide.length ? B.decide.map((d) => `- ${d.label} (${d.reason})`).join('\n') : '- ไม่มีรายการ'
    const ro = reorder.length
      ? reorder.slice(0, 5).map((x) => `- ${x.part}${x.model ? ` (${x.model})` : ''} — ขาย ${x.sold} ครั้ง/90วัน เหลือ ${x.left}${x.urgent ? ' 🔴 ควรหาด่วน' : ''}`).join('\n')
      : '- ไม่มีรายการ'
    return [
      `สรุปงาน ChutiBenz วันนี้ (${new Date().toLocaleDateString('th-TH')})`, '',
      '1) ลูกค้าที่ต้องตามวันนี้', fl, '',
      '2) งานที่ต้องทำวันนี้', tk, '',
      '3) เกินกำหนด', `- Lead overdue: ${B.overdueLeads.length}`, `- Task overdue: ${B.overdueTasks.length}`, '',
      '4) งานยังไม่มีเจ้าของ', `- ${unassignedCount} รายการ`, '',
      '5) เรื่องที่ควรตัดสินใจ', dc, '',
      '6) ของควรหา/สั่งเพิ่ม', ro, '',
      'หมายเหตุ: AI ช่วยสรุป เจ้าของเป็นผู้ตัดสินใจ',
    ].join('\n')
  }

  // ===== Exports =====
  function dl(name: string, text: string, type: string) {
    const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u)
  }
  function exportTxt() { dl(`daily-brief-${todayStr()}.txt`, '\uFEFF' + briefText(), 'text/plain;charset=utf-8') }
  function briefData() {
    return {
      generated_at: new Date().toISOString(),
      counts: {
        today_follow_ups: B.todayFollow.length, overdue_leads: B.overdueLeads.length,
        today_tasks: B.todayTasks.length, overdue_tasks: B.overdueTasks.length,
        unassigned: unassignedCount, decision_needed: B.decide.length,
      },
      today_follow_ups: B.todayFollow.map((l) => ({ name: l.name || null, channel: contactOf(l), car_model: l.car_model || null, part: partOf(l), owner: l.owner || null, follow_due: l.follow_due || null, status: normStatus(l.status) })),
      overdue_leads: B.overdueLeads.map((l) => ({ name: l.name || null, part: partOf(l), car_model: l.car_model || null, owner: l.owner || null, follow_due: l.follow_due || null, status: normStatus(l.status) })),
      today_tasks: B.todayTasks.map((t) => ({ title: t.title || null, owner: t.owner || null, due_date: t.due_date || null, priority: t.priority || 'medium', status: t.status || 'todo', linked_lead: leadName(t.linked_lead_id) || null })),
      overdue_tasks: B.overdueTasks.map((t) => ({ title: t.title || null, owner: t.owner || null, due_date: t.due_date || null, priority: t.priority || 'medium', status: t.status || 'todo' })),
      unassigned_work: [
        ...B.unassignedLeads.map((l) => ({ type: 'lead', name: l.name || null, detail: partOf(l), status: normStatus(l.status) })),
        ...B.unassignedTasks.map((t) => ({ type: 'task', name: t.title || null, detail: t.task_type || null, status: t.status || 'todo' })),
      ],
      decision_needed: B.decide.map((d) => ({ item: d.label, reason: d.reason })),
    }
  }
  function exportJson() { dl(`daily-brief-${todayStr()}.json`, JSON.stringify(briefData(), null, 2), 'application/json') }
  function exportCsv() {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows: string[][] = [['section', 'name/title', 'owner', 'due', 'status', 'detail']]
    B.todayFollow.forEach((l) => rows.push(['today_follow', l.name || '', l.owner || '', l.follow_due || '', leadStatusTh(l), partOf(l)]))
    B.overdueLeads.forEach((l) => rows.push(['overdue_lead', l.name || '', l.owner || '', l.follow_due || '', leadStatusTh(l), partOf(l)]))
    B.todayTasks.forEach((t) => rows.push(['today_task', t.title || '', t.owner || '', t.due_date || '', TASK_STATUS[t.status || 'todo'], TASK_PRIORITY[t.priority || 'medium'].th]))
    B.overdueTasks.forEach((t) => rows.push(['overdue_task', t.title || '', t.owner || '', t.due_date || '', TASK_STATUS[t.status || 'todo'], TASK_PRIORITY[t.priority || 'medium'].th]))
    dl(`daily-brief-${todayStr()}.csv`, '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }

  // ===== Risk / Reminder =====
  const risks: string[] = []
  if (B.overdueLeads.length) risks.push(`🔴 Lead เกินกำหนดตาม ${B.overdueLeads.length} รายการ`)
  if (B.overdueTasks.length) risks.push(`🔴 งานเกินกำหนด ${B.overdueTasks.length} รายการ`)
  if (unassignedCount) risks.push(`⚠️ งาน/ลูกค้ายังไม่มีเจ้าของ ${unassignedCount} รายการ`)
  if (B.decide.length) risks.push(`🧭 รอการตัดสินใจ ${B.decide.length} รายการ`)
  if (reorderUrgent) risks.push(`🛒 ของขายดีแต่หมดสต็อก ${reorderUrgent} รายการ — ควรหาเพิ่ม`)

  const stat = (label: string, val: number, color: string) => (
    <div style={{ flex: 1, minWidth: 88, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
      <div style={{ fontSize: 11, color: '#777' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>☀️ Daily Brief — Command Center</div>
            <div style={{ fontSize: 12, color: '#cbd8cf' }}>สรุปเช้า ChutiBenz · เปิดหน้าเดียวรู้ว่าต้องทำอะไรวันนี้ · {new Date().toLocaleDateString('th-TH')}</div>
          </div>
          <a href="/ops-x7k2m9/parts-desk" style={{ ...qbtn, textDecoration: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>→ ไป Parts Desk (จัดการ)</a>
        </div>
      </div>

      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {/* stat strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {stat('ตามวันนี้', B.todayFollow.length, '#0C447C')}
          {stat('งานวันนี้', B.todayTasks.length, GREEN)}
          {stat('Lead เกิน', B.overdueLeads.length, '#A32D2D')}
          {stat('Task เกิน', B.overdueTasks.length, '#A32D2D')}
          {stat('ไม่มีเจ้าของ', unassignedCount, '#854F0B')}
          {stat('ต้องตัดสินใจ', B.decide.length, '#3C3489')}
        </div>

        {/* quick actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => copy(briefText(), 'คัดลอกสรุปวันนี้แล้ว')} style={{ flex: 1, minWidth: 160, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>📋 คัดลอกสรุปวันนี้</button>
          <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
          <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
          <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
        </div>

        {/* 7) Risk / Reminder — ขึ้นบนสุดให้เห็นก่อน */}
        <Section title="⚠️ ความเสี่ยง / เตือนความจำ" count={risks.length}>
          {risks.length === 0
            ? <div style={{ ...card, color: '#0F6E56' }}>✅ ยังไม่มีสัญญาณเตือนสำคัญ</div>
            : risks.map((r, i) => <div key={i} style={{ ...card, fontSize: 13.5 }}>{r}</div>)}
        </Section>

        {/* 1) Today Follow-ups */}
        <Section title="📅 ลูกค้าที่ต้องตามวันนี้" count={B.todayFollow.length}>
          {B.todayFollow.length === 0 ? <Empty /> : B.todayFollow.map((l) => (
            <div key={l.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 14 }}>{l.name || '(ไม่ระบุชื่อ)'}</b>
                <Badge label={leadStatusTh(l)} bg="#E6F1FB" fg="#0C447C" />
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>{partOf(l)} · {l.car_model || 'รุ่น —'} · {contactOf(l)}</div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: leadNoOwner(l) ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>{leadNoOwner(l) ? 'ยังไม่มีเจ้าของ' : `👤 ${l.owner}`}</span>
                <span style={{ color: '#0C447C' }}>📅 ตาม {fmtDate(l.follow_due)}</span>
                <button onClick={() => copy(followMsgTH(l), 'คัดลอกข้อความตาม (ไทย)')} style={{ ...qbtn, padding: '3px 9px', fontSize: 11.5 }}>คัดลอก follow-up</button>
              </div>
            </div>
          ))}
        </Section>

        {/* 2) Overdue Leads */}
        <Section title="🔴 Lead เกินกำหนดตาม" count={B.overdueLeads.length}>
          {B.overdueLeads.length === 0 ? <Empty /> : B.overdueLeads.map((l) => (
            <div key={l.id} style={{ ...card, borderLeft: '4px solid #A32D2D' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 14 }}>{l.name || '(ไม่ระบุชื่อ)'}</b>
                <Badge label={`เลย ${fmtDate(l.follow_due)}`} bg="#FCEBEB" fg="#A32D2D" />
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>{partOf(l)} · {l.car_model || '—'} · {contactOf(l)}</div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: leadNoOwner(l) ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>{leadNoOwner(l) ? 'ยังไม่มีเจ้าของ' : `👤 ${l.owner}`}</span>
                <Badge label={leadStatusTh(l)} bg="#F1EFE8" fg="#5F5E5A" />
                <button onClick={() => copy(followMsgTH(l), 'คัดลอกข้อความตาม (ไทย)')} style={{ ...qbtn, padding: '3px 9px', fontSize: 11.5 }}>คัดลอก follow-up</button>
              </div>
            </div>
          ))}
        </Section>

        {/* 3) Today Tasks */}
        <Section title="🗂️ งานที่ต้องทำวันนี้" count={B.todayTasks.length}>
          {B.todayTasks.length === 0 ? <Empty /> : B.todayTasks.map((t) => <TaskRow key={t.id} t={t} leadModelPart={leadModelPart} />)}
        </Section>

        {/* 4) Overdue Tasks */}
        <Section title="🔴 งานเกินกำหนด" count={B.overdueTasks.length}>
          {B.overdueTasks.length === 0 ? <Empty /> : B.overdueTasks.map((t) => <TaskRow key={t.id} t={t} overdue leadModelPart={leadModelPart} />)}
        </Section>

        {/* 5) Unassigned Work */}
        <Section title="🧑‍🔧 งานยังไม่มีเจ้าของ" count={unassignedCount}>
          {unassignedCount === 0 ? <Empty /> : (
            <>
              {B.unassignedLeads.map((l) => (
                <div key={'ul' + l.id} style={card}>
                  <span style={{ fontSize: 11, color: '#0C447C', fontWeight: 700 }}>LEAD</span> <b style={{ fontSize: 13.5 }}>{l.name || '(ไม่ระบุ)'}</b>
                  <span style={{ fontSize: 12.5, color: '#555' }}> — {partOf(l)}{l.car_model ? ` (${l.car_model})` : ''} · {leadStatusTh(l)}</span>
                </div>
              ))}
              {B.unassignedTasks.map((t) => (
                <div key={'ut' + t.id} style={card}>
                  <span style={{ fontSize: 11, color: BRASS, fontWeight: 700 }}>TASK</span> <b style={{ fontSize: 13.5 }}>{t.title || '(ไม่มีชื่องาน)'}</b>
                  <span style={{ fontSize: 12.5, color: '#555' }}> — {t.task_type || 'งาน'} · {TASK_STATUS[t.status || 'todo']}</span>
                </div>
              ))}
            </>
          )}
        </Section>

        {/* 6) Decision Needed */}
        <Section title="🧭 เรื่องที่ควรตัดสินใจวันนี้" count={B.decide.length}>
          {B.decide.length === 0 ? <Empty /> : B.decide.map((d) => (
            <div key={d.key} style={{ ...card, borderLeft: '4px solid #3C3489' }}>
              <b style={{ fontSize: 13.5 }}>{d.label}</b>
              <div style={{ fontSize: 11.5, color: '#3C3489', marginTop: 2 }}>เหตุผล: {d.reason}</div>
            </div>
          ))}
        </Section>

        {/* 7) ควรสั่งเพิ่ม (จาก Stock Source) */}
        <Section title="🛒 ของควรหา/สั่งเพิ่ม" count={reorder.length}>
          {reorder.length === 0 ? <Empty /> : (
            <>
              {reorder.slice(0, 5).map((x) => (
                <div key={x.key} style={{ ...card, borderLeft: `4px solid ${x.urgent ? '#A32D2D' : '#854F0B'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <b style={{ fontSize: 13.5 }}>{x.part}{x.model ? ` · ${x.model}` : ''}</b>
                    <Badge label={x.urgent ? '🔴 ขายดี ของหมด' : '🟡 เหลือน้อย'} bg={x.urgent ? '#FCEBEB' : '#FAEEDA'} fg={x.urgent ? '#A32D2D' : '#854F0B'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: '#555', marginTop: 2 }}>ขาย {x.sold} ครั้ง/90วัน · เหลือ {x.left} ชิ้น{x.sold > 0 && x.sumProfit > 0 ? ` · กำไรเฉลี่ย ฿${Math.round(x.sumProfit / x.sold).toLocaleString()}/ชิ้น` : ''}</div>
                </div>
              ))}
              <a href="/ops-x7k2m9/stock-source" style={{ ...qbtn, display: 'inline-block', textDecoration: 'none', marginTop: 2 }}>→ ดูทั้งหมดที่ Stock Source</a>
            </>
          )}
        </Section>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '10px 0 30px' }}>
          AI ช่วยสรุป · เจ้าของเป็นผู้ตัดสินใจ · หน้านี้อ่านอย่างเดียว จัดการงานจริงที่ Parts Desk
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: GREEN, marginBottom: 6 }}>{title} <span style={{ color: '#999', fontWeight: 400 }}>({count})</span></div>
      {children}
    </div>
  )
}
function Empty() { return <div style={{ ...card, color: '#aaa', fontSize: 12.5 }}>— ไม่มีรายการ —</div> }

function TaskRow({ t, overdue, leadModelPart }: { t: Row; overdue?: boolean; leadModelPart: (id?: string) => string }) {
  const pr = TASK_PRIORITY[t.priority || 'medium']
  const link = t.linked_lead_id ? leadModelPart(t.linked_lead_id) : ''
  return (
    <div style={{ ...card, borderLeft: overdue ? '4px solid #A32D2D' : '4px solid ' + BRASS }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <b style={{ fontSize: 14 }}>{t.title || '(ไม่มีชื่องาน)'}</b>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={pr.th} bg={pr.bg} fg={pr.fg} />
          <Badge label={TASK_STATUS[t.status || 'todo']} bg="#EEF0F3" fg="#455" />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {t.task_type && <span>{t.task_type}</span>}
        <span style={{ color: (!t.owner || !String(t.owner).trim()) ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>{(!t.owner || !String(t.owner).trim()) ? 'ยังไม่มีเจ้าของ' : `👤 ${t.owner}`}</span>
        <span style={{ color: overdue ? '#A32D2D' : '#0C447C' }}>📅 {fmtDate(t.due_date)}{overdue ? ' (เกิน)' : ''}</span>
        {link && <span style={{ color: BRASS }}>🔗 {link}</span>}
      </div>
    </div>
  )
}
