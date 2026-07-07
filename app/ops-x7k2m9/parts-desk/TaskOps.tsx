'use client'
// app/ops-x7k2m9/parts-desk/TaskOps.tsx — Task & Team Ops P0 (แท็บใน parts-desk)
// งานภายในร้าน: ทุกงานมี owner/status/due/priority · ผูก lead ได้ · ห้ามลบ (ใช้ cancelled) · ไม่ส่งจริง
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Task = Record<string, any>
type Lead = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A'

const STATUS: Record<string, { th: string; bg: string; fg: string }> = {
  todo:      { th: 'ยังไม่เริ่ม',       bg: '#EEF0F3', fg: '#455' },
  doing:     { th: 'กำลังทำ',          bg: '#E6F1FB', fg: '#0C447C' },
  waiting:   { th: 'รอข้อมูล/ลูกค้า',   bg: '#FAEEDA', fg: '#854F0B' },
  done:      { th: 'เสร็จแล้ว ✓',      bg: '#E1F5EE', fg: '#0F6E56' },
  cancelled: { th: 'ยกเลิก',           bg: '#F1EFE8', fg: '#8a8a8a' },
}
const STATUS_ORDER = ['todo', 'doing', 'waiting', 'done', 'cancelled']
const PRIORITY: Record<string, { th: string; bg: string; fg: string }> = {
  high:   { th: 'ด่วน',  bg: '#FCEBEB', fg: '#A32D2D' },
  medium: { th: 'ปกติ',  bg: '#FAEEDA', fg: '#854F0B' },
  low:    { th: 'ต่ำ',    bg: '#F1EFE8', fg: '#5F5E5A' },
}
const PRIORITY_ORDER = ['high', 'medium', 'low']
const TASK_TYPES = ['เช็กสต็อก', 'เช็กราคา', 'ถ่ายรูปอะไหล่', 'ส่งรูป/ราคาให้ลูกค้า', 'แพ็คของ', 'ส่งของ', 'ตามโอน', 'เคลม/ปัญหา', 'อื่น ๆ']

const todayStr = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d?: string | null) => { if (!d) return '-'; const x = new Date(d); return `${x.getDate()}/${x.getMonth() + 1}` }
const isOpen = (t: Task) => !['done', 'cancelled'].includes(t.status || 'todo')
const isOverdue = (t: Task) => isOpen(t) && t.due_date && t.due_date < todayStr()
const isDueToday = (t: Task) => isOpen(t) && t.due_date === todayStr()
const noOwner = (t: Task) => !t.owner || !String(t.owner).trim()

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const sel: React.CSSProperties = { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }
const lbl: React.CSSProperties = { fontSize: 12, color: '#666', fontWeight: 600, display: 'block' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, marginTop: 4, boxSizing: 'border-box' }

function summaryText(t: Task) {
  return `งาน: ${t.title || '-'}\nผู้รับผิดชอบ: ${t.owner || '-'}\nกำหนดส่ง: ${t.due_date || '-'}\nสถานะ: ${STATUS[t.status || 'todo']?.th || t.status}\nหมายเหตุ: ${t.note || '-'}`
}

export default function TaskOps({ tasks, leads, addTask, updateTask, onToast }:
  { tasks: Task[]; leads: Lead[]; addTask: (fd: FormData) => Promise<void>; updateTask: (fd: FormData) => Promise<void>; onToast: (m: string) => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [q, setQ] = useState('')
  const [quick, setQuick] = useState<'' | 'due_today' | 'overdue' | 'no_owner'>('')
  const [statusF, setStatusF] = useState('')
  const [prioF, setPrioF] = useState('')
  const [ownerF, setOwnerF] = useState('')
  const [typeF, setTypeF] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const leadName = (id?: string) => { if (!id) return ''; const l = leads.find((x) => x.id === id); return l ? (l.name || '(lead)') : '' }
  const owners = useMemo(() => Array.from(new Set(tasks.map((t) => t.owner).filter(Boolean))).sort(), [tasks])

  function submitAdd(fd: FormData) { start(async () => { await addTask(fd); router.refresh(); setShowAdd(false); onToast('เพิ่มงานแล้ว') }) }
  function patch(id: string, obj: Record<string, string>) {
    const fd = new FormData(); fd.set('id', id); Object.entries(obj).forEach(([k, v]) => fd.set(k, v))
    start(async () => { await updateTask(fd); router.refresh() })
  }
  function copy(text: string, m = 'คัดลอกแล้ว') { navigator.clipboard?.writeText(text).then(() => onToast(m)) }

  // export
  const COLS = ['created_at', 'due_date', 'title', 'task_type', 'owner', 'status', 'priority', 'linked_lead_id', 'note', 'updated_at', 'completed_at']
  function dl(name: string, text: string, type: string) { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
  function exportCsv() {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = tasks.map((t) => COLS.map((c) => esc(c === 'status' ? STATUS[t.status || 'todo']?.th : c === 'priority' ? PRIORITY[t.priority || 'medium']?.th : c === 'linked_lead_id' ? leadName(t[c]) : t[c])).join(','))
    dl(`ops-tasks-${todayStr()}.csv`, '﻿' + [COLS.join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8')
  }
  function exportTxt() {
    const body = tasks.map((t) => `▪ ${t.title || '-'} · ${STATUS[t.status || 'todo']?.th}${t.owner ? ` · ${t.owner}` : ' · (ไม่มีเจ้าของ)'} · ${PRIORITY[t.priority || 'medium']?.th}\n   ประเภท: ${t.task_type || '-'} · กำหนด ${t.due_date || '-'}${t.linked_lead_id ? ` · lead: ${leadName(t.linked_lead_id)}` : ''}${t.note ? `\n   โน้ต: ${t.note}` : ''}`)
    dl(`ops-tasks-${todayStr()}.txt`, '﻿' + `ChutiBenz — Task & Team Ops\nวันที่ออก: ${new Date().toLocaleString('th-TH')} · ทั้งหมด ${tasks.length} งาน\n${'─'.repeat(40)}\n` + body.join('\n\n'), 'text/plain;charset=utf-8')
  }
  function exportJson() { dl(`ops-tasks-${todayStr()}.json`, JSON.stringify(tasks.map((t) => { const o: Record<string, any> = {}; COLS.forEach((c) => (o[c] = t[c] ?? null)); o.linked_lead_name = leadName(t.linked_lead_id) || null; return o }), null, 2), 'application/json') }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return tasks.filter((t) => {
      if (quick === 'due_today' && !isDueToday(t)) return false
      if (quick === 'overdue' && !isOverdue(t)) return false
      if (quick === 'no_owner' && !(noOwner(t) && isOpen(t))) return false
      if (statusF && (t.status || 'todo') !== statusF) return false
      if (prioF && (t.priority || 'medium') !== prioF) return false
      if (ownerF && t.owner !== ownerF) return false
      if (typeF && t.task_type !== typeF) return false
      if (!kw) return true
      return [t.title, t.owner, t.task_type, t.note, leadName(t.linked_lead_id)].filter(Boolean).join(' ').toLowerCase().includes(kw)
    })
  }, [tasks, q, quick, statusF, prioF, ownerF, typeF])

  const openTasks = tasks.filter(isOpen)
  const dueToday = openTasks.filter(isDueToday).length
  const overdue = openTasks.filter(isOverdue).length

  return (
    <>
      {/* summary + add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#555' }}>เปิดอยู่ <b>{openTasks.length}</b> · วันนี้ต้องทำ <b style={{ color: '#0C447C' }}>{dueToday}</b> · เกินกำหนด <b style={{ color: '#A32D2D' }}>{overdue}</b></div>
        <button onClick={() => setShowAdd((s) => !s)} style={{ marginLeft: 'auto', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{showAdd ? '× ปิดฟอร์ม' : '+ เพิ่มงาน'}</button>
        {pending && <span style={{ fontSize: 12, color: '#888' }}>กำลังบันทึก…</span>}
      </div>

      {showAdd && (
        <form action={submitAdd} style={{ background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8, fontSize: 14 }}>เพิ่มงานใหม่</div>
          <label style={lbl}>ชื่องาน (title) *
            <input name="title" required style={inp} placeholder="เช่น ถ่ายรูปไฟท้าย W124 ส่งลูกค้า" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <label style={lbl}>เจ้าของงาน (owner) *<input name="owner" required style={inp} placeholder="ชื่อผู้รับผิดชอบ" /></label>
            <label style={lbl}>กำหนดส่ง (due) *<input name="due_date" type="date" required style={inp} /></label>
            <label style={lbl}>ความสำคัญ *
              <select name="priority" defaultValue="medium" style={inp}>{PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY[p].th}</option>)}</select>
            </label>
            <label style={lbl}>สถานะ
              <select name="status" defaultValue="todo" style={inp}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].th}</option>)}</select>
            </label>
            <label style={lbl}>ประเภทงาน
              <select name="task_type" defaultValue="" style={inp}><option value="">—</option>{TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </label>
            <label style={lbl}>ผูกกับลูกค้า (lead)
              <select name="linked_lead_id" defaultValue="" style={inp}><option value="">— ไม่ผูก —</option>{leads.filter((l) => !['won', 'lost'].includes(l.status)).slice(0, 200).map((l) => <option key={l.id} value={l.id}>{l.name || '(ไม่ระบุ)'} · {l.part_wanted || l.part_number || ''}</option>)}</select>
            </label>
          </div>
          <label style={{ ...lbl, marginTop: 8 }}>หมายเหตุ<textarea name="note" rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
          <button type="submit" style={{ marginTop: 10, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>บันทึกงาน</button>
        </form>
      )}

      {/* quick filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {[['', 'ทั้งหมด'], ['due_today', `วันนี้ต้องทำ (${dueToday})`], ['overdue', `เกินกำหนด (${overdue})`], ['no_owner', 'ยังไม่มีเจ้าของ']].map(([k, label]) => (
          <button key={k} onClick={() => setQuick(k as any)} style={{ border: `1px solid ${quick === k ? BRASS : '#ddd'}`, background: quick === k ? BRASS : '#fff', color: quick === k ? '#fff' : '#555', borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหางาน/เจ้าของ/ประเภท" style={{ flex: 1, minWidth: 150, padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={sel}><option value="">ทุกสถานะ</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].th}</option>)}</select>
        <select value={prioF} onChange={(e) => setPrioF(e.target.value)} style={sel}><option value="">ทุกความสำคัญ</option>{PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY[p].th}</option>)}</select>
        <select value={ownerF} onChange={(e) => setOwnerF(e.target.value)} style={sel}><option value="">ทุกเจ้าของ</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={sel}><option value="">ทุกประเภท</option>{TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
        <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
        <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>แสดง {filtered.length} / {tasks.length} งาน</div>

      {filtered.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: 30 }}>ยังไม่มีงาน — กด “+ เพิ่มงาน”</div>}
      {filtered.map((t) => {
        const st = STATUS[t.status || 'todo'] || STATUS.todo
        const pr = PRIORITY[t.priority || 'medium']
        const open = openId === t.id
        return (
          <div key={t.id} style={{ background: '#fff', border: `1px solid ${isOverdue(t) ? '#F09595' : '#e7e3d8'}`, borderLeft: `4px solid ${isOverdue(t) ? '#A32D2D' : isDueToday(t) ? '#0C447C' : BRASS}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
            <div onClick={() => setOpenId(open ? null : t.id)} style={{ padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title || '(ไม่มีชื่องาน)'}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {pr && <Badge label={pr.th} bg={pr.bg} fg={pr.fg} />}
                  <Badge label={st.th} bg={st.bg} fg={st.fg} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {t.task_type && <span>{t.task_type}</span>}
                <span style={{ color: noOwner(t) ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>{noOwner(t) ? 'ยังไม่มีเจ้าของ' : `👤 ${t.owner}`}</span>
                {t.due_date && <span style={{ color: isOverdue(t) ? '#A32D2D' : '#0C447C' }}>📅 {fmtDate(t.due_date)}{isOverdue(t) ? ' (เกิน)' : ''}</span>}
                {t.linked_lead_id && leadName(t.linked_lead_id) && <span style={{ color: BRASS }}>🔗 {leadName(t.linked_lead_id)}</span>}
              </div>
              {t.note && <div style={{ fontSize: 11.5, color: '#777', marginTop: 3 }}>📝 {String(t.note).slice(0, 90)}</div>}
            </div>
            {open && <TaskEdit task={t} leads={leads} onSave={(obj) => patch(t.id, obj)} onQuick={(obj) => patch(t.id, obj)} onCopy={copy} />}
          </div>
        )
      })}
    </>
  )
}

function TaskEdit({ task, leads, onSave, onQuick, onCopy }:
  { task: Task; leads: Lead[]; onSave: (o: Record<string, string>) => void; onQuick: (o: Record<string, string>) => void; onCopy: (t: string, m?: string) => void }) {
  const [f, setF] = useState({
    title: task.title || '', description: task.description || '', owner: task.owner || '',
    status: task.status || 'todo', priority: task.priority || 'medium', due_date: task.due_date || '',
    task_type: task.task_type || '', note: task.note || '', linked_lead_id: task.linked_lead_id || '',
  })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  return (
    <div style={{ borderTop: '1px solid #eee', padding: 12, background: '#fbfaf6' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={() => onQuick({ status: 'doing' })} style={qbtn}>▶ กำลังทำ</button>
        <button onClick={() => onQuick({ status: 'waiting' })} style={qbtn}>⏸ รอข้อมูล</button>
        <button onClick={() => onQuick({ status: 'done' })} style={{ ...qbtn, color: '#0F6E56', borderColor: '#0F6E56' }}>✓ เสร็จแล้ว</button>
        <button onClick={() => onCopy(summaryText(task), 'คัดลอกสรุปงานแล้ว')} style={qbtn}>คัดลอกสรุปงาน</button>
      </div>
      <label style={lbl}>ชื่องาน<input value={f.title} onChange={(e) => set('title', e.target.value)} style={inp} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <label style={lbl}>เจ้าของงาน<input value={f.owner} onChange={(e) => set('owner', e.target.value)} style={inp} placeholder="พิมพ์ชื่อ" /></label>
        <label style={lbl}>กำหนดส่ง<input type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} style={inp} /></label>
        <label style={lbl}>สถานะ<select value={f.status} onChange={(e) => set('status', e.target.value)} style={inp}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].th}</option>)}</select></label>
        <label style={lbl}>ความสำคัญ<select value={f.priority} onChange={(e) => set('priority', e.target.value)} style={inp}>{PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY[p].th}</option>)}</select></label>
        <label style={lbl}>ประเภทงาน<select value={f.task_type} onChange={(e) => set('task_type', e.target.value)} style={inp}><option value="">—</option>{TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label style={lbl}>ผูกลูกค้า (lead)<select value={f.linked_lead_id} onChange={(e) => set('linked_lead_id', e.target.value)} style={inp}><option value="">— ไม่ผูก —</option>{leads.slice(0, 200).map((l) => <option key={l.id} value={l.id}>{l.name || '(ไม่ระบุ)'} · {l.part_wanted || l.part_number || ''}</option>)}</select></label>
      </div>
      <label style={{ ...lbl, marginTop: 8 }}>รายละเอียด/โน้ต<textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
      <div style={{ marginTop: 10 }}>
        <button onClick={() => onSave(f)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>บันทึก</button>
      </div>
    </div>
  )
}
