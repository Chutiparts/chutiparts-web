'use client'
// app/ops-x7k2m9/crm-retention/CrmClient.tsx — CRM & Retention P0
// จัดกลุ่ม lead เป็น "ลูกค้า" (phone/line/contact/name) → หาว่าใครควรทักกลับ → ร่างข้อความ (คัดลอกเท่านั้น)
// actions: set follow-up · assign owner · mark contacted/not-interested · create task — ผ่าน server action (ไม่ลบ)
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Lead = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

// ===== lead status (ตรงกับ PartsDeskClient) =====
const LEAD_STATUS: Record<string, string> = {
  new: 'ใหม่', quoted: 'ส่งรูป/ราคาแล้ว', deciding: 'รอตัดสินใจ', to_follow: 'ต้องตาม', won: 'ปิดการขาย ✓', lost: 'ไม่ซื้อ',
}
const LEGACY: Record<string, string> = { contacted: 'quoted', waiting: 'deciding' }
const normStatus = (s?: string) => { const k = LEGACY[s || ''] || s || 'new'; return LEAD_STATUS[k] ? k : 'new' }

const todayStr = () => new Date().toISOString().slice(0, 10)
const shiftStr = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function daysSince(d?: string | null) { if (!d) return 9999; const t = new Date(d).getTime(); if (isNaN(t)) return 9999; return Math.floor((Date.now() - t) / 86400000) }
function fmtDate(d?: string | null) { if (!d) return '-'; const x = new Date(d); if (isNaN(x.getTime())) return '-'; return `${x.getDate()}/${x.getMonth() + 1}/${(x.getFullYear() + 543) % 100}` }

const digits = (s?: string) => (s || '').replace(/\D/g, '')
const partOf = (l: Lead) => l.part_wanted || l.part_number || ''
const contactOf = (l: Lead) => l.line_id || l.phone || l.contact_value || '-'

// ===== customer type =====
type Customer = {
  key: string; name: string; contact: string; repId: string
  models: string[]; parts: string[]; count: number
  lastContact: string | null; daysSilent: number
  status: string; owner: string; follow_due: string | null
  everWon: boolean; hasOpen: boolean
}

function groupCustomers(leads: Lead[]): Customer[] {
  const keyOf = (l: Lead) => {
    const p = digits(l.phone); if (p.length >= 6) return 'p:' + p
    const line = (l.line_id || '').toLowerCase().trim(); if (line) return 'l:' + line
    const c = (l.contact_value || '').toLowerCase().trim(); if (c) return 'c:' + c
    const n = (l.name || '').toLowerCase().trim(); if (n) return 'n:' + n
    return 'id:' + l.id
  }
  const map = new Map<string, Lead[]>()
  for (const l of leads) { const k = keyOf(l); if (!map.has(k)) map.set(k, []); map.get(k)!.push(l) }
  const out: Customer[] = []
  for (const [key, arr] of map) {
    const sorted = [...arr].sort((a, b) => String(b.last_activity_at || b.created_at || '').localeCompare(String(a.last_activity_at || a.created_at || '')))
    const rep = sorted[0]
    const name = sorted.find((x) => x.name)?.name || '(ไม่ระบุชื่อ)'
    const models = Array.from(new Set(sorted.map((x) => x.car_model).filter(Boolean)))
    const parts = Array.from(new Set(sorted.map((x) => partOf(x)).filter(Boolean)))
    const lastContact = rep.last_activity_at || rep.created_at || null
    const everWon = sorted.some((x) => normStatus(x.status) === 'won')
    const hasOpen = sorted.some((x) => !['won', 'lost'].includes(normStatus(x.status)))
    out.push({
      key, name, contact: contactOf(rep), repId: rep.id, models, parts, count: sorted.length,
      lastContact, daysSilent: daysSince(lastContact), status: normStatus(rep.status),
      owner: rep.owner || '', follow_due: rep.follow_due || null, everWon, hasOpen,
    })
  }
  return out.sort((a, b) => a.daysSilent - b.daysSilent === 0 ? 0 : b.daysSilent - a.daysSilent)
}

// ===== retention rules =====
const silent30 = (c: Customer) => c.hasOpen && c.daysSilent >= 30
const askedNotBought = (c: Customer) => c.hasOpen && !c.everWon
const wonBefore = (c: Customer) => c.everWon
const decidingLong = (c: Customer) => c.status === 'deciding' && c.daysSilent >= 7
const noOwner = (c: Customer) => c.hasOpen && !c.owner.trim()
const noFollow = (c: Customer) => c.hasOpen && !c.follow_due
const shouldContact = (c: Customer) => c.hasOpen && (silent30(c) || noFollow(c) || decidingLong(c))

function reasons(c: Customer): string[] {
  const r: string[] = []
  if (silent30(c)) r.push(`เงียบมา ${c.daysSilent} วัน`)
  if (decidingLong(c)) r.push(`รอตัดสินใจนาน ${c.daysSilent} วัน`)
  if (askedNotBought(c)) r.push('เคยถามแต่ยังไม่ปิดการขาย')
  if (wonBefore(c)) r.push('เคยปิดการขายแล้ว (ชวนซื้อซ้ำ)')
  if (noFollow(c)) r.push('ยังไม่มีวันตามต่อ')
  if (noOwner(c)) r.push('ยังไม่มีเจ้าของ')
  return r
}

// ===== copy templates (สเปก) =====
function msgTH(c: Customer) {
  return `สวัสดีครับ ขออนุญาตทักกลับเรื่องอะไหล่ Mercedes-Benz ที่เคยสอบถามไว้ครับ\nรุ่นรถ: ${c.models[0] || '-'}\nรายการที่เคยสนใจ: ${c.parts[0] || 'อะไหล่'}\nตอนนี้ถ้ายังหาอยู่ ผมช่วยเช็กของ/รูป/ราคาให้ต่อได้ครับ`
}
function msgEN(c: Customer) {
  return `Hello, I'm following up on the Mercedes-Benz part you asked about earlier.\nModel: ${c.models[0] || '-'}\nPart: ${c.parts[0] || 'part'}\nIf you are still looking, I can help check availability, photos, and price.`
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: '11px 12px', marginBottom: 8 }
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const sel: React.CSSProperties = { padding: '6px 9px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }
const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid #ddd', borderRadius: 7, fontSize: 12.5 }

const SEGMENTS: { k: string; label: string; fn: (c: Customer) => boolean }[] = [
  { k: '', label: 'ทั้งหมด', fn: () => true },
  { k: 'should', label: 'ควรทักกลับ', fn: shouldContact },
  { k: 'silent30', label: 'เงียบเกิน 30 วัน', fn: silent30 },
  { k: 'asked', label: 'เคยถามยังไม่ซื้อ', fn: askedNotBought },
  { k: 'won', label: 'เคยปิดการขาย', fn: wonBefore },
  { k: 'deciding', label: 'รอตัดสินใจนาน', fn: decidingLong },
  { k: 'no_owner', label: 'ไม่มีเจ้าของ', fn: noOwner },
  { k: 'no_follow', label: 'ไม่มีวันตาม', fn: noFollow },
]

export default function CrmClient({ leads, updateLead, addTask }:
  { leads: Lead[]; updateLead: (fd: FormData) => Promise<void>; addTask: (fd: FormData) => Promise<void> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [seg, setSeg] = useState('')
  const [modelF, setModelF] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600) }
  const copy = (t: string, m = 'คัดลอกแล้ว') => navigator.clipboard?.writeText(t).then(() => flash(m))

  const customers = useMemo(() => groupCustomers(leads), [leads])
  const models = useMemo(() => Array.from(new Set(customers.flatMap((c) => c.models))).sort(), [customers])

  function patchLead(id: string, obj: Record<string, string>) {
    const fd = new FormData(); fd.set('id', id); Object.entries(obj).forEach(([k, v]) => fd.set(k, v))
    start(async () => { await updateLead(fd); router.refresh() })
  }
  function createTask(c: Customer) {
    const fd = new FormData()
    fd.set('title', `ทักกลับลูกค้าเก่า ${c.name} เรื่อง ${c.parts[0] || 'อะไหล่'}${c.models[0] ? ` (${c.models[0]})` : ''}`)
    fd.set('owner', c.owner); fd.set('priority', 'medium'); fd.set('status', 'todo'); fd.set('task_type', 'ตามโอน')
    fd.set('linked_lead_id', c.repId); fd.set('due_date', shiftStr(1))
    start(async () => { await addTask(fd); router.refresh(); flash('สร้าง task ทักกลับแล้ว → ดูใน Tasks') })
  }

  const filtered = useMemo(() => {
    const segFn = SEGMENTS.find((s) => s.k === seg)?.fn || (() => true)
    const kw = q.trim().toLowerCase()
    return customers.filter((c) => {
      if (!segFn(c)) return false
      if (modelF && !c.models.includes(modelF)) return false
      if (!kw) return true
      return [c.name, c.contact, ...c.models, ...c.parts, c.owner].filter(Boolean).join(' ').toLowerCase().includes(kw)
    })
  }, [customers, seg, modelF, q])

  // dashboard
  const D = useMemo(() => ({
    should: customers.filter(shouldContact).length,
    silent: customers.filter(silent30).length,
    asked: customers.filter(askedNotBought).length,
    deciding: customers.filter(decidingLong).length,
    noFollow: customers.filter(noFollow).length,
    w124: customers.filter((c) => c.models.includes('W124')).length,
    w140: customers.filter((c) => c.models.includes('W140')).length,
    w210: customers.filter((c) => c.models.includes('W210')).length,
  }), [customers])

  // export
  function dl(name: string, text: string, type: string) { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
  const COLS = ['name', 'contact', 'models', 'parts', 'interactions', 'last_contact', 'days_silent', 'status', 'owner', 'follow_due', 'reasons']
  const row = (c: Customer) => [c.name, c.contact, c.models.join('/'), c.parts.join('/'), String(c.count), c.lastContact || '', String(c.daysSilent), LEAD_STATUS[c.status], c.owner, c.follow_due || '', reasons(c).join('; ')]
  function exportCsv() {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = filtered.map((c) => row(c).map(esc).join(','))
    dl(`crm-retention-${todayStr()}.csv`, '﻿' + [COLS.join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8')
  }
  function exportTxt() {
    const body = filtered.map((c) => `▪ ${c.name} · ${c.contact}\n   รุ่น: ${c.models.join('/') || '-'} · อะไหล่: ${c.parts.join('/') || '-'} · ติดต่อ ${c.count} ครั้ง\n   ล่าสุด ${fmtDate(c.lastContact)} (เงียบ ${c.daysSilent} วัน) · ${LEAD_STATUS[c.status]}${c.owner ? ` · ${c.owner}` : ''}\n   เหตุผลควรทัก: ${reasons(c).join(', ') || '-'}`)
    dl(`crm-retention-${todayStr()}.txt`, '﻿' + `ChutiBenz — CRM & Retention\nวันที่ออก ${new Date().toLocaleString('th-TH')} · ${filtered.length} ลูกค้า\n${'─'.repeat(40)}\n` + body.join('\n\n'), 'text/plain;charset=utf-8')
  }
  function exportJson() {
    dl(`crm-retention-${todayStr()}.json`, JSON.stringify(filtered.map((c) => ({ name: c.name, contact: c.contact, models: c.models, parts: c.parts, interactions: c.count, last_contact: c.lastContact, days_silent: c.daysSilent, status: c.status, owner: c.owner || null, follow_due: c.follow_due, reasons: reasons(c) })), null, 2), 'application/json')
  }

  const stat = (label: string, val: number, color: string) => (
    <div style={{ flex: 1, minWidth: 84, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
      <div style={{ fontSize: 21, fontWeight: 700, color }}>{val}</div>
      <div style={{ fontSize: 10.5, color: '#777' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>🤝 CRM / ลูกค้าเก่า — Retention</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>ดึงลูกค้าเก่ากลับมาซื้อซ้ำ · ระบบช่วยร่างข้อความ เจ้าของกดทักเอง (ไม่ส่งอัตโนมัติ) · {new Date().toLocaleDateString('th-TH')}</div>
      </div>

      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {/* dashboard */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {stat('ควรทักกลับ', D.should, '#A32D2D')}
          {stat('เงียบ 30+ วัน', D.silent, '#854F0B')}
          {stat('ถามยังไม่ซื้อ', D.asked, '#0C447C')}
          {stat('รอตัดสินใจนาน', D.deciding, '#3C3489')}
          {stat('ไม่มีวันตาม', D.noFollow, '#854F0B')}
          {stat('W124', D.w124, GREEN)}
          {stat('W140', D.w140, GREEN)}
          {stat('W210', D.w210, GREEN)}
        </div>

        {/* segments */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {SEGMENTS.map((s) => (
            <button key={s.k} onClick={() => setSeg(s.k)} style={{ border: `1px solid ${seg === s.k ? BRASS : '#ddd'}`, background: seg === s.k ? BRASS : '#fff', color: seg === s.k ? '#fff' : '#555', borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{s.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ/เบอร์/รุ่น/อะไหล่" style={{ flex: 1, minWidth: 160, padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
          <select value={modelF} onChange={(e) => setModelF(e.target.value)} style={sel}><option value="">ทุกรุ่น</option>{models.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
          <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
          <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
          {pending && <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>กำลังบันทึก…</span>}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>แสดง {filtered.length} / {customers.length} ลูกค้า</div>

        {filtered.length === 0 && <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 24 }}>— ไม่มีลูกค้าตามเงื่อนไข —</div>}
        {filtered.map((c) => {
          const open = openId === c.key
          const rs = reasons(c)
          return (
            <div key={c.key} style={{ ...card, borderLeft: `4px solid ${shouldContact(c) ? '#A32D2D' : '#e7e3d8'}` }}>
              <div onClick={() => setOpenId(open ? null : c.key)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 14 }}>{c.name}</b>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {c.everWon && <Badge label="เคยซื้อ" bg="#E1F5EE" fg="#0F6E56" />}
                    <Badge label={LEAD_STATUS[c.status]} bg="#EEF0F3" fg="#455" />
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>
                  {c.contact} · รุ่น {c.models.join('/') || '—'} · {c.parts.join('/') || 'อะไหล่'}
                </div>
                <div style={{ fontSize: 11.5, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>ติดต่อ {c.count} ครั้ง · ล่าสุด {fmtDate(c.lastContact)}</span>
                  <span style={{ color: c.daysSilent >= 30 ? '#A32D2D' : '#666' }}>เงียบ {c.daysSilent} วัน</span>
                  <span style={{ color: c.owner ? '#0F6E56' : '#A32D2D', fontWeight: 600 }}>{c.owner ? `👤 ${c.owner}` : 'ไม่มีเจ้าของ'}</span>
                  {c.follow_due ? <span style={{ color: '#0C447C' }}>📅 ตาม {fmtDate(c.follow_due)}</span> : <span style={{ color: '#A32D2D' }}>ไม่มีวันตาม</span>}
                </div>
                {rs.length > 0 && <div style={{ fontSize: 11.5, color: '#A32D2D', marginTop: 3 }}>💡 ควรทัก: {rs.join(' · ')}</div>}
              </div>
              {open && (
                <div style={{ borderTop: '1px solid #eee', marginTop: 9, paddingTop: 9 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button onClick={() => copy(msgTH(c), 'คัดลอกข้อความทักกลับ (ไทย)')} style={{ ...qbtn, color: BRASS, borderColor: BRASS }}>📋 คัดลอกทักกลับ TH</button>
                    <button onClick={() => copy(msgEN(c), 'คัดลอกข้อความทักกลับ (EN)')} style={qbtn}>EN</button>
                    <button onClick={() => createTask(c)} style={qbtn}>➕ สร้าง task ทักกลับ</button>
                    <button onClick={() => patchLead(c.repId, { status: 'quoted' })} style={qbtn}>✓ ทักแล้ว</button>
                    <button onClick={() => patchLead(c.repId, { status: 'lost' })} style={qbtn}>✕ ไม่สนใจ</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ fontSize: 11, color: '#666' }}>ตั้งวันตามต่อ<br /><input type="date" defaultValue={c.follow_due || shiftStr(3)} onBlur={(e) => e.target.value && patchLead(c.repId, { follow_due: e.target.value })} style={{ ...inp, marginTop: 2 }} /></label>
                    <label style={{ fontSize: 11, color: '#666' }}>มอบหมายเจ้าของ<br /><input defaultValue={c.owner} placeholder="พิมพ์ชื่อ + Enter" onKeyDown={(e) => { if (e.key === 'Enter') { patchLead(c.repId, { owner: (e.target as HTMLInputElement).value }); flash('มอบหมายแล้ว') } }} style={{ ...inp, marginTop: 2 }} /></label>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#aaa', marginTop: 6 }}>action ทั้งหมดแก้ที่ lead ล่าสุดของลูกค้า · ไม่ส่งข้อความจริง · ไม่ลบข้อมูล</div>
                </div>
              )}
            </div>
          )
        })}

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '10px 0 30px' }}>
          ระบบช่วยร่างข้อความ · เจ้าของกดทักเอง (คัดลอก) · ไม่ส่ง/ไม่ broadcast อัตโนมัติ · จัดกลุ่มจาก lead เดิม (phone/line/ชื่อ)
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}
