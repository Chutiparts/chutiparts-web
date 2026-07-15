'use client'
// app/ops-x7k2m9/parts-desk/PartsDeskClient.tsx — Lead & Follow-up Log P0 (Parts Desk Upgrade)
// 3 module: Lead Desk · Follow-up Control · Daily Brief · ทำงานบน contact_leads (service_role ผ่าน page.tsx)
// P0 (7 ก.ค.): status 6 มาตรฐาน · filter (วันนี้ต้องตาม/เกินกำหนด/ใหม่/ยังไม่มีเจ้าของ/status/รุ่น) ·
//   แก้ owner/part/รุ่น · quick action · copy follow-up (TH/EN) · export CSV/TXT/JSON · ห้ามลบ/ห้ามส่งจริง
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import TaskOps from './TaskOps'
import CrmClient from '../crm-retention/CrmClient' // Level B: reuse CRM เป็นแท็บในหน้านี้

type Lead = Record<string, any>
const LINE_OA = 'https://line.me/R/ti/p/%40440ifncj'

// สถานะมาตรฐาน 6 แบบ (เก็บ key อังกฤษใน DB · แสดงไทย) — map ค่าเก่า contacted/waiting ให้เข้ากับใหม่
const STATUS: Record<string, { th: string; bg: string; fg: string }> = {
  new:       { th: 'ใหม่',            bg: '#E6F1FB', fg: '#0C447C' },
  quoted:    { th: 'ส่งรูป/ราคาแล้ว',  bg: '#FAEEDA', fg: '#854F0B' },
  deciding:  { th: 'รอตัดสินใจ',       bg: '#EEEDFE', fg: '#3C3489' },
  to_follow: { th: 'ต้องตาม',          bg: '#FDE4CC', fg: '#9A4A00' },
  won:       { th: 'ปิดการขาย ✓',      bg: '#E1F5EE', fg: '#0F6E56' },
  lost:      { th: 'ไม่ซื้อ',           bg: '#F1EFE8', fg: '#5F5E5A' },
}
const STATUS_ORDER = ['new', 'quoted', 'deciding', 'to_follow', 'won', 'lost']
const LEGACY: Record<string, string> = { contacted: 'quoted', waiting: 'deciding' }
const normStatus = (s?: string) => {
  const k = LEGACY[s || ''] || s || 'new'
  return STATUS[k] ? k : 'new'
}
const PRIORITY: Record<string, { th: string; bg: string; fg: string }> = {
  hot:  { th: '🔥 ร้อน', bg: '#FCEBEB', fg: '#A32D2D' },
  warm: { th: 'อุ่น',    bg: '#FAEEDA', fg: '#854F0B' },
  cold: { th: 'เย็น',    bg: '#F1EFE8', fg: '#5F5E5A' },
}
const NEXT_ACTIONS = ['รอตอบราคา', 'รอส่งรูป', 'รอเอกสาร', 'รอโอน', 'รอนัดหมาย', 'รอตัดสินใจ', 'ต้องโทรกลับ', 'ต้องเช็กของ']
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

const todayStr = () => new Date().toISOString().slice(0, 10)
function daysSince(d?: string | null) {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}
function fmtDate(d?: string | null) {
  if (!d) return '-'
  const x = new Date(d)
  return `${x.getDate()}/${x.getMonth() + 1}`
}
const isOpen = (l: Lead) => !['won', 'lost'].includes(normStatus(l.status))
const isSilent = (l: Lead) => isOpen(l) && daysSince(l.last_activity_at || l.created_at) >= 3
const isOverdue = (l: Lead) => isOpen(l) && l.follow_due && l.follow_due < todayStr()
const isDueToday = (l: Lead) => isOpen(l) && l.follow_due === todayStr()
const noOwner = (l: Lead) => !l.owner || !String(l.owner).trim()
const contactOf = (l: Lead) => l.line_id || l.phone || l.contact_value || '-'
const partOf = (l: Lead) => l.part_wanted || l.part_number || 'อะไหล่'
function missingInfo(l: Lead) {
  const miss: string[] = []
  if (!l.car_model) miss.push('รุ่น')
  if (!l.part_wanted && !l.part_number) miss.push('อะไหล่')
  if (!l.phone && !l.line_id && !l.contact_value) miss.push('ช่องทาง')
  return miss
}
// ข้อความทักภายใน (สั้น) — ปุ่มคัดลอกเดิม
function draftMsg(l: Lead) {
  const model = l.car_model ? `รุ่น ${l.car_model}` : ''
  return `สวัสดีครับคุณ${l.name || ''} ChutiBenz ตามเรื่อง ${partOf(l)} ${model} ที่สอบถามไว้นะครับ ยังสนใจอยู่ไหมครับ 🙏`
}
// ข้อความ follow-up มาตรฐาน (สเปก P0) — คัดลอกเท่านั้น ห้ามส่งอัตโนมัติ
function followMsgTH(l: Lead) {
  return `สวัสดีครับ ขออนุญาตติดตามเรื่องอะไหล่ Mercedes-Benz ที่สอบถามไว้ครับ\nรายการ: ${partOf(l)}\nรุ่นรถ: ${l.car_model || '-'}\nหากยังสนใจอยู่ ผมช่วยเช็กของ/รูป/ราคาให้ต่อได้ครับ`
}
function followMsgEN(l: Lead) {
  return `Hello, I'm following up on the Mercedes-Benz part you asked about.\nPart: ${partOf(l)}\nModel: ${l.car_model || '-'}\nIf you are still interested, I can help check availability, photos, and price.`
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}

export default function PartsDeskClient({ leads, tasks = [], updateLead, addTask, updateTask }:
  { leads: Lead[]; tasks?: Lead[]; updateLead: (fd: FormData) => Promise<void>; addTask?: (fd: FormData) => Promise<void>; updateTask?: (fd: FormData) => Promise<void> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [tab, setTab] = useState<'desk' | 'follow' | 'brief' | 'tasks' | 'crm'>('desk')
  const [q, setQ] = useState('')
  const [quick, setQuick] = useState<'' | 'due_today' | 'overdue' | 'new' | 'no_owner'>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [carFilter, setCarFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  function patch(id: string, obj: Record<string, string>) {
    const fd = new FormData()
    fd.set('id', id)
    Object.entries(obj).forEach(([k, v]) => fd.set(k, v))
    start(async () => { await updateLead(fd); router.refresh() })
  }
  function copy(text: string, msg = 'คัดลอกแล้ว') {
    navigator.clipboard?.writeText(text).then(() => { setToast(msg); setTimeout(() => setToast(''), 1500) })
  }
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 1600) }
  // สร้าง task จาก lead — เติม title/linked_lead_id อัตโนมัติ (link from lead · P0)
  function createTaskFromLead(l: Lead) {
    if (!addTask) return
    const fd = new FormData()
    fd.set('title', `ตามลูกค้าเรื่อง ${l.part_wanted || l.part_number || 'อะไหล่'}${l.car_model ? ` (${l.car_model})` : ''}`)
    fd.set('owner', l.owner || ''); fd.set('priority', 'medium'); fd.set('status', 'todo')
    fd.set('task_type', 'ส่งรูป/ราคาให้ลูกค้า'); fd.set('linked_lead_id', l.id)
    const d = new Date(); d.setDate(d.getDate() + 1); fd.set('due_date', d.toISOString().slice(0, 10))
    start(async () => { await addTask(fd); router.refresh(); flash('สร้างงานจาก lead แล้ว → ดูแท็บ Task Ops') })
  }
  const openTasks = tasks.filter((t) => !['done', 'cancelled'].includes(t.status || 'todo')).length

  const carModels = useMemo(() => Array.from(new Set(leads.map((l) => l.car_model).filter(Boolean))).sort(), [leads])

  // ===== Export (CSV / TXT-BOM / JSON) =====
  const EXPORT_COLS = ['created_at', 'name', 'source', 'phone', 'line_id', 'contact_value', 'car_model', 'car_year', 'part_wanted', 'part_number', 'status', 'owner', 'priority', 'next_action', 'follow_due', 'last_note', 'last_activity_at', 'updated_at', 'detail']
  function dl(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }
  function exportCsv() {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = leads.map((l) => EXPORT_COLS.map((c) => esc(c === 'status' ? STATUS[normStatus(l.status)].th : l[c])).join(','))
    dl(`parts-leads-${todayStr()}.csv`, '﻿' + [EXPORT_COLS.join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8')
  }
  function exportTxt() {
    const lines = leads.map((l) =>
      `▪ ${l.name || '(ไม่ระบุชื่อ)'} · ${STATUS[normStatus(l.status)].th}${l.owner ? ` · เจ้าของ: ${l.owner}` : ' · (ยังไม่มีเจ้าของ)'}\n   ${partOf(l)} · ${l.car_model || 'รุ่น -'}${l.car_year ? ` (${l.car_year})` : ''} · ${contactOf(l)}\n   เข้า ${fmtDate(l.created_at)} · ตาม ${l.follow_due || '-'}${l.last_note ? `\n   โน้ต: ${l.last_note}` : ''}`)
    const txt = `ChutiBenz — Lead & Follow-up Log\nวันที่ออก: ${new Date().toLocaleString('th-TH')} · ทั้งหมด ${leads.length} รายการ\n${'─'.repeat(40)}\n` + lines.join('\n\n')
    dl(`parts-leads-${todayStr()}.txt`, '﻿' + txt, 'text/plain;charset=utf-8')
  }
  function exportJson() {
    const data = leads.map((l) => { const o: Record<string, any> = {}; EXPORT_COLS.forEach((c) => (o[c] = c === 'status' ? normStatus(l.status) : (l[c] ?? null))); return o })
    dl(`parts-leads-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json')
  }

  // ===== Lead Desk filter =====
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return leads.filter((l) => {
      if (quick === 'due_today' && !isDueToday(l)) return false
      if (quick === 'overdue' && !isOverdue(l)) return false
      if (quick === 'new' && normStatus(l.status) !== 'new') return false
      if (quick === 'no_owner' && !(noOwner(l) && isOpen(l))) return false
      if (statusFilter && normStatus(l.status) !== statusFilter) return false
      if (carFilter && l.car_model !== carFilter) return false
      if (!kw) return true
      return [l.name, l.car_model, l.part_wanted, l.part_number, l.phone, l.line_id, l.owner, l.detail]
        .filter(Boolean).join(' ').toLowerCase().includes(kw)
    })
  }, [leads, q, quick, statusFilter, carFilter])

  const openLeads = leads.filter(isOpen)
  const followList = useMemo(() =>
    [...openLeads].sort((a, b) => {
      const rank = (l: Lead) => (isOverdue(l) ? 0 : isDueToday(l) ? 1 : l.follow_due ? 2 : isSilent(l) ? 3 : 4)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      return (a.follow_due || '9999').localeCompare(b.follow_due || '9999')
    }), [leads])

  // Daily brief buckets
  const dueToday = openLeads.filter(isDueToday)
  const overdue = openLeads.filter(isOverdue)
  const hot = openLeads.filter((l) => l.priority === 'hot')
  const silent = openLeads.filter(isSilent)
  const decide = openLeads.filter((l) => normStatus(l.status) === 'deciding' || /ราคา|เช็กของ|ตัดสินใจ/.test(l.next_action || ''))
  const newToday = leads.filter((l) => (l.created_at || '').slice(0, 10) === todayStr())
  const wonWeek = leads.filter((l) => normStatus(l.status) === 'won' && daysSince(l.created_at) <= 7)

  function briefText() {
    const line = (l: Lead) => `• ${l.name || '(ไม่ระบุชื่อ)'} — ${partOf(l)} ${l.car_model || ''} · ${contactOf(l)}${l.owner ? ` · @${l.owner}` : ''}${l.next_action ? ` · ${l.next_action}` : ''}`
    return [
      `☀️ Parts OpsBrief — ${new Date().toLocaleDateString('th-TH')}`, ``,
      `📊 ใหม่วันนี้ ${newToday.length} · เปิดอยู่ ${openLeads.length} · ปิดได้ 7 วัน ${wonWeek.length}`, ``,
      `🔴 เกินกำหนด (${overdue.length})`, ...overdue.map(line), ``,
      `📅 ต้องตามวันนี้ (${dueToday.length})`, ...dueToday.map(line), ``,
      `🔥 lead ร้อน (${hot.length})`, ...hot.map(line), ``,
      `😶 เงียบเสี่ยงหลุด (${silent.length})`, ...silent.map(line),
    ].join('\n')
  }

  const TABS = [
    { k: 'desk', label: `Lead Desk (${leads.length})` },
    { k: 'follow', label: `Follow-up (${openLeads.length})` },
    { k: 'brief', label: 'Daily Brief' },
    { k: 'tasks', label: `Task Ops (${openTasks})` },
    { k: 'crm', label: '🤝 ลูกค้าเก่า/CRM' },
  ] as const

  const QUICK = [
    { k: '', label: 'ทั้งหมด' },
    { k: 'due_today', label: `วันนี้ต้องตาม (${dueToday.length})` },
    { k: 'overdue', label: `เกินกำหนด (${overdue.length})` },
    { k: 'new', label: 'lead ใหม่' },
    { k: 'no_owner', label: 'ยังไม่มีเจ้าของ' },
  ] as const

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Parts OpsBrief — Lead &amp; Follow-up Log</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>ศูนย์กลาง lead เดียว · ไม่ให้ลูกค้าหลุด · ทุก lead มีสถานะ/เจ้าของ/วันตาม</div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e7e3d8', position: 'sticky', top: 0, zIndex: 5, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ border: `1px solid ${tab === t.k ? GREEN : '#ddd'}`, background: tab === t.k ? GREEN : '#fff', color: tab === t.k ? '#fff' : GREEN,
              borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t.label}</button>
        ))}
        {pending && <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>กำลังบันทึก…</span>}
      </div>

      <div style={{ padding: 12, maxWidth: 940, margin: '0 auto' }}>
        {/* ===== LEAD DESK ===== */}
        {tab === 'desk' && (
          <>
            {/* quick filters */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {QUICK.map((f) => (
                <button key={f.k} onClick={() => setQuick(f.k as any)}
                  style={{ border: `1px solid ${quick === f.k ? BRASS : '#ddd'}`, background: quick === f.k ? BRASS : '#fff', color: quick === f.k ? '#fff' : '#555',
                    borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{f.label}</button>
              ))}
            </div>
            {/* search + selects + export */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ/รุ่น/อะไหล่/เบอร์/เจ้าของ"
                style={{ flex: 1, minWidth: 170, padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={sel}>
                <option value="">ทุกสถานะ</option>
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].th}</option>)}
              </select>
              <select value={carFilter} onChange={(e) => setCarFilter(e.target.value)} style={sel}>
                <option value="">ทุกรุ่น</option>
                {carModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
              <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
              <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>แสดง {filtered.length} / {leads.length} รายการ</div>
            {filtered.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: 30 }}>ไม่มี lead ตามเงื่อนไข</div>}
            {filtered.map((l) => {
              const sk = normStatus(l.status), st = STATUS[sk]
              const miss = missingInfo(l)
              const open = openId === l.id
              return (
                <div key={l.id} style={{ background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                  <div onClick={() => setOpenId(open ? null : l.id)} style={{ padding: '10px 12px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name || '(ไม่ระบุชื่อ)'}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {l.priority && <Badge label={PRIORITY[l.priority]?.th || l.priority} bg={PRIORITY[l.priority]?.bg || '#eee'} fg={PRIORITY[l.priority]?.fg || '#555'} />}
                        <Badge label={st.th} bg={st.bg} fg={st.fg} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>
                      {partOf(l)} · {l.car_model || 'รุ่น —'}{l.car_year ? ` (${l.car_year})` : ''} · {contactOf(l)}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>{fmtDate(l.created_at)} · {l.source || 'direct'}</span>
                      <span style={{ color: noOwner(l) ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>{noOwner(l) ? 'ยังไม่มีเจ้าของ' : `👤 ${l.owner}`}</span>
                      {l.follow_due && <span style={{ color: isOverdue(l) ? '#A32D2D' : '#0C447C' }}>📅 ตาม {fmtDate(l.follow_due)}{isOverdue(l) ? ' (เกิน)' : ''}</span>}
                      {miss.length > 0 && <span style={{ color: '#A32D2D' }}>ข้อมูลขาด: {miss.join('/')}</span>}
                      {l.next_action && <span style={{ color: BRASS }}>▶ {l.next_action}</span>}
                    </div>
                    {l.last_note && <div style={{ fontSize: 11.5, color: '#777', marginTop: 3 }}>📝 {String(l.last_note).slice(0, 80)}</div>}
                    {/* P0.1 ทดลอง memo แบบพิมพ์ตรงการ์ด (ทาง A) — ไม่ต้องเปิดฟอร์มแก้ไขเต็ม */}
                    <div style={{ marginTop: 5 }}>
                      <QuickMemo initial={l.last_note ? String(l.last_note) : ''} onSave={(v) => patch(l.id, { last_note: v })} />
                    </div>
                  </div>
                  {open && <EditPanel lead={l} onSave={(obj) => patch(l.id, obj)} onQuick={(obj) => patch(l.id, obj)} onCopy={copy} onCreateTask={addTask ? () => createTaskFromLead(l) : undefined} />}
                </div>
              )
            })}
          </>
        )}

        {/* ===== FOLLOW-UP ===== */}
        {tab === 'follow' && (
          <>
            {followList.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: 30 }}>ไม่มีงานต้องตาม 🎉</div>}
            {followList.map((l) => {
              const overdueF = isOverdue(l), dueF = isDueToday(l), silentF = isSilent(l)
              return (
                <div key={l.id} style={{ background: '#fff', border: `1px solid ${overdueF ? '#F09595' : '#e7e3d8'}`, borderLeft: `4px solid ${overdueF ? '#A32D2D' : dueF ? '#0C447C' : silentF ? '#EF9F27' : BRASS}`, borderRadius: 10, marginBottom: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name || '(ไม่ระบุชื่อ)'} {noOwner(l) ? <span style={{ fontSize: 11, color: '#A32D2D' }}>· ไม่มีเจ้าของ</span> : <span style={{ fontSize: 11, color: '#0F6E56' }}>· 👤{l.owner}</span>}</div>
                    <div style={{ fontSize: 11 }}>
                      {overdueF && <Badge label={`เลยกำหนด ${fmtDate(l.follow_due)}`} bg="#FCEBEB" fg="#A32D2D" />}
                      {dueF && <Badge label="วันนี้ต้องตาม" bg="#E6F1FB" fg="#0C447C" />}
                      {!overdueF && !dueF && l.follow_due && <Badge label={`ตาม ${fmtDate(l.follow_due)}`} bg="#EEF3EE" fg="#3d6b4c" />}
                      {!l.follow_due && silentF && <Badge label={`เงียบ ${daysSince(l.last_activity_at || l.created_at)} วัน`} bg="#FAEEDA" fg="#854F0B" />}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#444', margin: '4px 0' }}>
                    {partOf(l)} · {l.car_model || '—'} · {contactOf(l)}
                    {l.next_action && <span style={{ color: BRASS }}> ▶ {l.next_action}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <button onClick={() => patch(l.id, { status: 'to_follow' })} style={qbtn}>➜ ต้องตาม</button>
                    <button onClick={() => patch(l.id, { status: 'quoted' })} style={qbtn}>✓ ส่งรูป/ราคาแล้ว</button>
                    <button onClick={() => patch(l.id, { status: 'won' })} style={{ ...qbtn, color: '#0F6E56', borderColor: '#0F6E56' }}>🎉 ปิดการขาย</button>
                    <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + 3); patch(l.id, { follow_due: d.toISOString().slice(0, 10) }) }} style={qbtn}>เลื่อน +3 วัน</button>
                    <button onClick={() => copy(followMsgTH(l), 'คัดลอกข้อความตาม (ไทย)')} style={qbtn}>คัดลอกตาม TH</button>
                    <button onClick={() => copy(followMsgEN(l), 'คัดลอกข้อความตาม (EN)')} style={qbtn}>EN</button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ===== DAILY BRIEF ===== */}
        {tab === 'brief' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {[['ใหม่วันนี้', newToday.length], ['เปิดอยู่', openLeads.length], ['เกินกำหนด', overdue.length], ['ปิดได้ (7วัน)', wonWeek.length]].map(([k, v]) => (
                <div key={k as string} style={{ flex: 1, minWidth: 90, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{v as number}</div>
                  <div style={{ fontSize: 11, color: '#777' }}>{k as string}</div>
                </div>
              ))}
            </div>
            <button onClick={() => copy(briefText(), 'คัดลอกสรุปเช้าแล้ว')} style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>📋 คัดลอกสรุปเช้า</button>
            <BriefSection title="🔴 เกินกำหนด" leads={overdue} />
            <BriefSection title="📅 ต้องตามวันนี้" leads={dueToday} />
            <BriefSection title="🔥 lead ร้อน" leads={hot} />
            <BriefSection title="😶 เงียบเสี่ยงหลุด" leads={silent} />
            <BriefSection title="🧭 ต้องตัดสินใจ (ราคา/ของ/ปิดการขาย)" leads={decide} />
          </>
        )}

        {/* ===== TASK OPS ===== */}
        {tab === 'tasks' && addTask && updateTask && (
          <TaskOps tasks={tasks} leads={leads} addTask={addTask} updateTask={updateTask} onToast={flash} />
        )}

        {/* ===== CRM / ลูกค้าเก่า (Level B merge — reuse CrmClient · props เดียวกัน) ===== */}
        {tab === 'crm' && addTask && (
          <CrmClient leads={leads} updateLead={updateLead} addTask={addTask} />
        )}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}

const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
// P0.1: โน้ตด่วนบนการ์ด — แตะ → textarea โผล่ตรงการ์ด → บันทึก (font 16px กัน iOS ซูมเอง)
function QuickMemo({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [openM, setOpenM] = useState(false)
  const [v, setV] = useState(initial)
  if (!openM) {
    return <button onClick={(e) => { e.stopPropagation(); setV(initial); setOpenM(true) }}
      style={{ background: '#fff', border: '1px solid #ddd', color: '#555', borderRadius: 999, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>📝 โน้ตด่วน</button>
  }
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} autoFocus placeholder="พิมพ์โน้ตสั้น ๆ…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1px solid ${BRASS}`, borderRadius: 8, fontSize: 16, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={() => { onSave(v.trim()); setOpenM(false) }}
          style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>บันทึกโน้ต</button>
        <button onClick={() => setOpenM(false)} style={qbtn}>ยกเลิก</button>
      </div>
    </div>
  )
}
const sel: React.CSSProperties = { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }
const lbl: React.CSSProperties = { fontSize: 12, color: '#666', fontWeight: 600, display: 'block' }

function BriefSection({ title, leads }: { title: string; leads: Lead[] }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: GREEN, marginBottom: 6 }}>{title} <span style={{ color: '#999', fontWeight: 400 }}>({leads.length})</span></div>
      {leads.length === 0 && <div style={{ fontSize: 12, color: '#aaa', paddingLeft: 4 }}>— ไม่มี —</div>}
      {leads.map((l) => (
        <div key={l.id} style={{ background: '#fff', border: '1px solid #e7e3d8', borderRadius: 8, padding: '8px 10px', marginBottom: 5, fontSize: 13 }}>
          <b>{l.name || '(ไม่ระบุ)'}</b> — {partOf(l)} {l.car_model || ''} · <span style={{ color: '#666' }}>{contactOf(l)}</span>
          {l.owner ? <span style={{ color: '#0F6E56' }}> · 👤{l.owner}</span> : <span style={{ color: '#A32D2D' }}> · ไม่มีเจ้าของ</span>}
          {l.next_action && <span style={{ color: BRASS }}> ▶ {l.next_action}</span>}
        </div>
      ))}
    </div>
  )
}

function EditPanel({ lead, onSave, onQuick, onCopy, onCreateTask }: { lead: Lead; onSave: (obj: Record<string, string>) => void; onQuick: (obj: Record<string, string>) => void; onCopy: (t: string, m?: string) => void; onCreateTask?: () => void }) {
  const [f, setF] = useState({
    status: normStatus(lead.status),
    owner: lead.owner || '',
    priority: lead.priority || '',
    next_action: lead.next_action || '',
    follow_due: lead.follow_due || '',
    last_note: lead.last_note || '',
    part_wanted: lead.part_wanted || '',
    car_model: lead.car_model || '',
    part_number: lead.part_number || '',
  })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, marginTop: 4, boxSizing: 'border-box' }
  return (
    <div style={{ borderTop: '1px solid #eee', padding: 12, background: '#fbfaf6' }}>
      {lead.detail && <div style={{ fontSize: 12, color: '#555', marginBottom: 8, whiteSpace: 'pre-wrap' }}>📝 {lead.detail}</div>}
      {/* quick actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={() => onQuick({ status: 'to_follow' })} style={qbtn}>➜ ต้องตาม</button>
        <button onClick={() => onQuick({ status: 'quoted' })} style={qbtn}>✓ ส่งรูป/ราคาแล้ว</button>
        <button onClick={() => onQuick({ status: 'won' })} style={{ ...qbtn, color: '#0F6E56', borderColor: '#0F6E56' }}>🎉 ปิดการขาย</button>
        <button onClick={() => onCopy(followMsgTH(lead), 'คัดลอกข้อความตาม (ไทย)')} style={qbtn}>คัดลอก follow-up TH</button>
        <button onClick={() => onCopy(followMsgEN(lead), 'คัดลอกข้อความตาม (EN)')} style={qbtn}>EN</button>
        {onCreateTask && <button onClick={onCreateTask} style={{ ...qbtn, color: BRASS, borderColor: BRASS }}>➕ สร้าง task จาก lead</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={lbl}>สถานะ
          <select value={f.status} onChange={(e) => set('status', e.target.value)} style={inp}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].th}</option>)}
          </select>
        </label>
        <label style={lbl}>เจ้าของงาน (owner)
          <input value={f.owner} onChange={(e) => set('owner', e.target.value)} style={inp} placeholder="พิมพ์ชื่อผู้ดูแล" />
        </label>
        <label style={lbl}>ความร้อน
          <select value={f.priority} onChange={(e) => set('priority', e.target.value)} style={inp}>
            <option value="">—</option>
            {Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{PRIORITY[p].th}</option>)}
          </select>
        </label>
        <label style={lbl}>ตามวันที่ (next follow-up)
          <input type="date" value={f.follow_due} onChange={(e) => set('follow_due', e.target.value)} style={inp} />
        </label>
        <label style={lbl}>อะไหล่ที่ถาม
          <input value={f.part_wanted} onChange={(e) => set('part_wanted', e.target.value)} style={inp} placeholder="เช่น ไฟหน้า" />
        </label>
        <label style={lbl}>รุ่นรถ
          <input value={f.car_model} onChange={(e) => set('car_model', e.target.value)} style={inp} placeholder="เช่น W140" />
        </label>
        <label style={lbl}>Part number
          <input value={f.part_number} onChange={(e) => set('part_number', e.target.value)} style={inp} placeholder="OEM" />
        </label>
        <label style={lbl}>next action
          <input list="na" value={f.next_action} onChange={(e) => set('next_action', e.target.value)} style={inp} placeholder="รอตอบราคา…" />
          <datalist id="na">{NEXT_ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
      </div>
      <label style={{ ...lbl, marginTop: 8 }}>โน้ต
        <textarea value={f.last_note} onChange={(e) => set('last_note', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={() => onSave(f)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>บันทึก</button>
        <button onClick={() => onCopy(draftMsg(lead))} style={qbtn}>คัดลอกข้อความทักสั้น</button>
        {lead.line_id && <a href={LINE_OA} target="_blank" rel="noreferrer" style={{ ...qbtn, textDecoration: 'none', color: '#06C755', borderColor: '#06C755' }}>เปิด LINE</a>}
        {lead.phone && <a href={`tel:${lead.phone}`} style={{ ...qbtn, textDecoration: 'none' }}>โทร {lead.phone}</a>}
      </div>
    </div>
  )
}
