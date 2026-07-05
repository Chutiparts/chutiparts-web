'use client'
// app/ops-x7k2m9/parts-desk/PartsDeskClient.tsx — 3 module: Lead Desk · Follow-up Control · Daily Brief
// รับ leads (contact_leads) + server action updateLead จาก page.tsx
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Lead = Record<string, any>
const LINE_OA = 'https://line.me/R/ti/p/%40440ifncj'

const STATUS: Record<string, { th: string; bg: string; fg: string }> = {
  new:       { th: 'ใหม่',        bg: '#E6F1FB', fg: '#0C447C' },
  contacted: { th: 'ติดต่อแล้ว',   bg: '#FAEEDA', fg: '#854F0B' },
  waiting:   { th: 'รอลูกค้า',     bg: '#EEEDFE', fg: '#3C3489' },
  won:       { th: 'ปิดการขาย ✓',  bg: '#E1F5EE', fg: '#0F6E56' },
  lost:      { th: 'หลุด',        bg: '#F1EFE8', fg: '#5F5E5A' },
}
const STATUS_ORDER = ['new', 'contacted', 'waiting', 'won', 'lost']
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
const isOpen = (l: Lead) => !['won', 'lost'].includes(l.status || 'new')
const isSilent = (l: Lead) => isOpen(l) && daysSince(l.last_activity_at || l.created_at) >= 3
const isOverdue = (l: Lead) => isOpen(l) && l.follow_due && l.follow_due <= todayStr()
const contactOf = (l: Lead) => l.line_id || l.phone || l.contact_value || '-'
function missingInfo(l: Lead) {
  const miss: string[] = []
  if (!l.car_model) miss.push('รุ่น')
  if (!l.part_wanted && !l.part_number) miss.push('อะไหล่')
  if (!l.phone && !l.line_id && !l.contact_value) miss.push('ช่องทาง')
  return miss
}
function draftMsg(l: Lead) {
  const part = l.part_wanted || l.part_number || 'อะไหล่'
  const model = l.car_model ? `รุ่น ${l.car_model}` : ''
  return `สวัสดีครับคุณ${l.name || ''} ChutiBenz ตามเรื่อง ${part} ${model} ที่สอบถามไว้นะครับ ยังสนใจอยู่ไหมครับ 🙏`
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}

export default function PartsDeskClient({ leads, updateLead }: { leads: Lead[]; updateLead: (fd: FormData) => Promise<void> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [tab, setTab] = useState<'desk' | 'follow' | 'brief'>('desk')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  function patch(id: string, obj: Record<string, string>) {
    const fd = new FormData()
    fd.set('id', id)
    Object.entries(obj).forEach(([k, v]) => fd.set(k, v))
    start(async () => { await updateLead(fd); router.refresh() })
  }
  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => { setToast('คัดลอกแล้ว'); setTimeout(() => setToast(''), 1500) })
  }
  function exportCsv() {
    const cols = ['created_at', 'name', 'phone', 'line_id', 'car_model', 'car_year', 'part_wanted', 'part_number', 'budget', 'status', 'priority', 'next_action', 'follow_due', 'last_note', 'source', 'detail']
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = leads.map((l) => cols.map((c) => esc(l[c])).join(','))
    const csv = '﻿' + [cols.join(','), ...rows].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `parts-leads-${todayStr()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return leads.filter((l) => {
      if (statusFilter && (l.status || 'new') !== statusFilter) return false
      if (!kw) return true
      return [l.name, l.car_model, l.part_wanted, l.part_number, l.phone, l.line_id, l.detail]
        .filter(Boolean).join(' ').toLowerCase().includes(kw)
    })
  }, [leads, q, statusFilter])

  const openLeads = leads.filter(isOpen)
  const followList = useMemo(() =>
    [...openLeads].sort((a, b) => {
      const rank = (l: Lead) => (isOverdue(l) ? 0 : l.follow_due ? 1 : isSilent(l) ? 2 : 3)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      return (a.follow_due || '9999').localeCompare(b.follow_due || '9999')
    }), [leads])

  // Daily brief buckets
  const dueToday = openLeads.filter((l) => l.follow_due && l.follow_due <= todayStr())
  const hot = openLeads.filter((l) => l.priority === 'hot')
  const silent = openLeads.filter(isSilent)
  const decide = openLeads.filter((l) => l.status === 'waiting' || /ราคา|เช็กของ|ตัดสินใจ/.test(l.next_action || ''))
  const newToday = leads.filter((l) => (l.created_at || '').slice(0, 10) === todayStr())
  const wonWeek = leads.filter((l) => l.status === 'won' && daysSince(l.created_at) <= 7)

  function briefText() {
    const line = (l: Lead) => `• ${l.name || '(ไม่ระบุชื่อ)'} — ${l.part_wanted || l.part_number || 'อะไหล่'} ${l.car_model || ''} · ${contactOf(l)}${l.next_action ? ` · ${l.next_action}` : ''}`
    return [
      `☀️ Parts OpsBrief — ${new Date().toLocaleDateString('th-TH')}`,
      ``,
      `📊 ใหม่วันนี้ ${newToday.length} · เปิดอยู่ ${openLeads.length} · ปิดได้ 7 วัน ${wonWeek.length}`,
      ``,
      `🔴 ต้องตามวันนี้ (${dueToday.length})`, ...dueToday.map(line),
      ``,
      `🔥 lead ร้อน (${hot.length})`, ...hot.map(line),
      ``,
      `😶 เงียบเสี่ยงหลุด (${silent.length})`, ...silent.map(line),
      ``,
      `🧭 ต้องตัดสินใจ (${decide.length})`, ...decide.map(line),
    ].join('\n')
  }

  const TABS = [
    { k: 'desk', label: `Lead Desk (${leads.length})` },
    { k: 'follow', label: `Follow-up (${openLeads.length})` },
    { k: 'brief', label: 'Daily Brief' },
  ] as const

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Parts OpsBrief</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>รับลูกค้าให้ไม่หลุด · ตามงานให้ไม่หาย · สรุปให้ตัดสินใจทุกเช้า</div>
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

      <div style={{ padding: 12, maxWidth: 900, margin: '0 auto' }}>
        {/* ===== LEAD DESK ===== */}
        {tab === 'desk' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ/รุ่น/อะไหล่/เบอร์"
                style={{ flex: 1, minWidth: 180, padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }}>
                <option value="">ทุกสถานะ</option>
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].th}</option>)}
              </select>
              <button onClick={exportCsv} style={{ ...qbtn, padding: '8px 12px' }}>⬇ CSV</button>
            </div>
            {filtered.length === 0 && <div style={{ color: '#888', textAlign: 'center', padding: 30 }}>ไม่มี lead</div>}
            {filtered.map((l) => {
              const st = STATUS[l.status || 'new'] || STATUS.new
              const miss = missingInfo(l)
              const open = openId === l.id
              return (
                <div key={l.id} style={{ background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                  <div onClick={() => setOpenId(open ? null : l.id)} style={{ padding: '10px 12px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name || '(ไม่ระบุชื่อ)'}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {l.priority && <Badge label={PRIORITY[l.priority]?.th || l.priority} bg={PRIORITY[l.priority]?.bg || '#eee'} fg={PRIORITY[l.priority]?.fg || '#555'} />}
                        <Badge label={st.th} bg={st.bg} fg={st.fg} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>
                      {(l.part_wanted || l.part_number) || 'อะไหล่ —'} · {l.car_model || 'รุ่น —'}{l.car_year ? ` (${l.car_year})` : ''} · {contactOf(l)}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                      {fmtDate(l.created_at)} · {l.source || 'direct'}
                      {miss.length > 0 && <span style={{ color: '#A32D2D', marginLeft: 6 }}>ข้อมูลขาด: {miss.join('/')}</span>}
                      {l.next_action && <span style={{ marginLeft: 6, color: BRASS }}>▶ {l.next_action}</span>}
                    </div>
                  </div>
                  {open && <EditPanel lead={l} onSave={(obj) => patch(l.id, obj)} onCopy={copy} />}
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
              const overdue = isOverdue(l), silentF = isSilent(l)
              return (
                <div key={l.id} style={{ background: '#fff', border: `1px solid ${overdue ? '#F09595' : '#e7e3d8'}`, borderLeft: `4px solid ${overdue ? '#A32D2D' : silentF ? '#EF9F27' : BRASS}`, borderRadius: 10, marginBottom: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name || '(ไม่ระบุชื่อ)'}</div>
                    <div style={{ fontSize: 11 }}>
                      {overdue && <Badge label={`เลยกำหนด ${fmtDate(l.follow_due)}`} bg="#FCEBEB" fg="#A32D2D" />}
                      {!overdue && l.follow_due && <Badge label={`ตาม ${fmtDate(l.follow_due)}`} bg="#E6F1FB" fg="#0C447C" />}
                      {!l.follow_due && silentF && <Badge label={`เงียบ ${daysSince(l.last_activity_at || l.created_at)} วัน`} bg="#FAEEDA" fg="#854F0B" />}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#444', margin: '4px 0' }}>
                    {(l.part_wanted || l.part_number) || 'อะไหล่ —'} · {l.car_model || '—'} · {contactOf(l)}
                    {l.next_action && <span style={{ color: BRASS }}> ▶ {l.next_action}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <button onClick={() => patch(l.id, { status: 'contacted' })} style={qbtn}>✓ ติดต่อแล้ว</button>
                    <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + 3); patch(l.id, { follow_due: d.toISOString().slice(0, 10) }) }} style={qbtn}>เลื่อน +3 วัน</button>
                    <button onClick={() => copy(draftMsg(l))} style={qbtn}>คัดลอกข้อความทัก</button>
                    {l.line_id && <a href={LINE_OA} target="_blank" rel="noreferrer" style={{ ...qbtn, textDecoration: 'none', color: '#06C755', borderColor: '#06C755' }}>LINE</a>}
                    {l.phone && <a href={`tel:${l.phone}`} style={{ ...qbtn, textDecoration: 'none' }}>โทร</a>}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ===== DAILY BRIEF ===== */}
        {tab === 'brief' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['ใหม่วันนี้', newToday.length], ['เปิดอยู่', openLeads.length], ['ปิดได้ (7วัน)', wonWeek.length]].map(([k, v]) => (
                <div key={k as string} style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{v as number}</div>
                  <div style={{ fontSize: 11, color: '#777' }}>{k as string}</div>
                </div>
              ))}
            </div>
            <button onClick={() => copy(briefText())} style={{ width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>📋 คัดลอกสรุปเช้า</button>
            <BriefSection title="🔴 ต้องตามวันนี้" leads={dueToday} />
            <BriefSection title="🔥 lead ร้อน" leads={hot} />
            <BriefSection title="😶 เงียบเสี่ยงหลุด" leads={silent} />
            <BriefSection title="🧭 ต้องตัดสินใจ (ราคา/ของ/ปิดการขาย)" leads={decide} />
          </>
        )}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}

const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }

function BriefSection({ title, leads }: { title: string; leads: Lead[] }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: GREEN, marginBottom: 6 }}>{title} <span style={{ color: '#999', fontWeight: 400 }}>({leads.length})</span></div>
      {leads.length === 0 && <div style={{ fontSize: 12, color: '#aaa', paddingLeft: 4 }}>— ไม่มี —</div>}
      {leads.map((l) => (
        <div key={l.id} style={{ background: '#fff', border: '1px solid #e7e3d8', borderRadius: 8, padding: '8px 10px', marginBottom: 5, fontSize: 13 }}>
          <b>{l.name || '(ไม่ระบุ)'}</b> — {(l.part_wanted || l.part_number) || 'อะไหล่'} {l.car_model || ''} · <span style={{ color: '#666' }}>{l.line_id || l.phone || '-'}</span>
          {l.next_action && <span style={{ color: BRASS }}> ▶ {l.next_action}</span>}
        </div>
      ))}
    </div>
  )
}

function EditPanel({ lead, onSave, onCopy }: { lead: Lead; onSave: (obj: Record<string, string>) => void; onCopy: (t: string) => void }) {
  const [f, setF] = useState({
    status: lead.status || 'new',
    priority: lead.priority || '',
    next_action: lead.next_action || '',
    follow_due: lead.follow_due || '',
    last_note: lead.last_note || '',
  })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, marginTop: 4 }
  return (
    <div style={{ borderTop: '1px solid #eee', padding: 12, background: '#fbfaf6' }}>
      {lead.detail && <div style={{ fontSize: 12, color: '#555', marginBottom: 8, whiteSpace: 'pre-wrap' }}>📝 {lead.detail}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={lbl}>สถานะ
          <select value={f.status} onChange={(e) => set('status', e.target.value)} style={inp}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].th}</option>)}
          </select>
        </label>
        <label style={lbl}>ความร้อน
          <select value={f.priority} onChange={(e) => set('priority', e.target.value)} style={inp}>
            <option value="">—</option>
            {Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{PRIORITY[p].th}</option>)}
          </select>
        </label>
        <label style={lbl}>next action
          <input list="na" value={f.next_action} onChange={(e) => set('next_action', e.target.value)} style={inp} placeholder="รอตอบราคา…" />
          <datalist id="na">{NEXT_ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
        <label style={lbl}>ตามวันที่
          <input type="date" value={f.follow_due} onChange={(e) => set('follow_due', e.target.value)} style={inp} />
        </label>
      </div>
      <label style={{ ...lbl, marginTop: 8 }}>โน้ต
        <textarea value={f.last_note} onChange={(e) => set('last_note', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={() => onSave(f)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>บันทึก</button>
        <button onClick={() => onCopy(draftMsg(lead))} style={qbtn}>คัดลอกข้อความทัก</button>
        {lead.line_id && <a href={LINE_OA} target="_blank" rel="noreferrer" style={{ ...qbtn, textDecoration: 'none', color: '#06C755', borderColor: '#06C755' }}>LINE</a>}
        {lead.phone && <a href={`tel:${lead.phone}`} style={{ ...qbtn, textDecoration: 'none' }}>โทร {lead.phone}</a>}
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { fontSize: 12, color: '#666', fontWeight: 600, display: 'block' }
