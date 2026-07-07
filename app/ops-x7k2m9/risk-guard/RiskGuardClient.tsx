'use client'
// app/ops-x7k2m9/risk-guard/RiskGuardClient.tsx — Stock / Risk Guard P0 (อ่านล้วน + copy/export)
// 4 สัญญาณ: สินค้าค้างนาน · ไม่อัปเดตนาน · ข้อมูลไม่ครบ · lead/task เกินกำหนด
// decision (client-side ไม่เขียน DB): โพสต์ใหม่/ลดราคา/จัดเซ็ต/พักไว้ · rule-based · ไม่แตะ margin (P1 · products ไม่มีต้นทุน)
import { useMemo, useState } from 'react'

type Row = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

const todayStr = () => new Date().toISOString().slice(0, 10)
function daysSince(d?: string | null) { if (!d) return null; const t = new Date(d).getTime(); if (isNaN(t)) return null; return Math.floor((Date.now() - t) / 86400000) }
function fmtDate(d?: string | null) { if (!d) return '-'; const x = new Date(d); if (isNaN(x.getTime())) return '-'; return `${x.getDate()}/${x.getMonth() + 1}/${(x.getFullYear() + 543) % 100}` }

// ----- product field helpers (อ่านแบบ defensive เพราะ schema อาจต่างชื่อ) -----
const pName = (p: Row) => p.name || p.name_en || p.title || '(ไม่มีชื่อ)'
const pPart = (p: Row) => p.part_number || p.sku || p.oem_number || p.oem || p.part_no || ''
const pModel = (p: Row) => p.car_model || (Array.isArray(p.compatible_models) ? p.compatible_models.join('/') : p.compatible_models) || ''
const pPrice = (p: Row) => { const n = Number(p.price); return isNaN(n) ? 0 : n }
const pImg = (p: Row) => p.image_url || p.image || p.cover_image || ''
const pPublished = (p: Row) => p.is_published === true || p.is_published === 'true' || p.published === true
const pCreated = (p: Row) => p.created_at || null
const pUpdated = (p: Row) => p.updated_at || p.created_at || null

// ----- lead/task overdue (ตรงกับโมดูลเดิม) -----
const LEGACY: Record<string, string> = { contacted: 'quoted', waiting: 'deciding' }
const normLead = (s?: string) => LEGACY[s || ''] || s || 'new'
const leadOpen = (l: Row) => !['won', 'lost'].includes(normLead(l.status))
const leadOverdue = (l: Row) => leadOpen(l) && !!l.follow_due && l.follow_due < todayStr()
const taskOpen = (t: Row) => !['done', 'cancelled'].includes(t.status || 'todo')
const taskOverdue = (t: Row) => taskOpen(t) && !!t.due_date && t.due_date < todayStr()
const partOf = (l: Row) => l.part_wanted || l.part_number || 'อะไหล่'

const DECISIONS = ['โพสต์ใหม่', 'ลดราคา', 'จัดเซ็ต', 'พักไว้']

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 8, padding: '9px 11px', marginBottom: 6 }
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const sel: React.CSSProperties = { padding: '6px 9px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }

export default function RiskGuardClient({ products, leads, tasks }: { products: Row[]; leads: Row[]; tasks: Row[] }) {
  const [agedDays, setAgedDays] = useState(60)
  const [staleDays, setStaleDays] = useState(45)
  const [decisions, setDecisions] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600) }
  const copy = (text: string, m = 'คัดลอกแล้ว') => navigator.clipboard?.writeText(text).then(() => flash(m))
  const setDecision = (id: string, d: string) => setDecisions((s) => ({ ...s, [id]: s[id] === d ? '' : d }))

  const B = useMemo(() => {
    const pub = products.filter(pPublished)
    const aged = pub.filter((p) => { const d = daysSince(pCreated(p)); return d !== null && d >= agedDays })
      .sort((a, b) => (daysSince(pCreated(b)) || 0) - (daysSince(pCreated(a)) || 0))
    const stale = pub.filter((p) => { const d = daysSince(pUpdated(p)); return d !== null && d >= staleDays })
      .sort((a, b) => (daysSince(pUpdated(b)) || 0) - (daysSince(pUpdated(a)) || 0))
    const incomplete = pub.filter((p) => !pImg(p) || pPrice(p) <= 0)
    const overdueLeads = leads.filter(leadOverdue)
    const overdueTasks = tasks.filter(taskOverdue)
    return { pubCount: pub.length, aged, stale, incomplete, overdueLeads, overdueTasks }
  }, [products, leads, tasks, agedDays, staleDays])

  const totalRisk = B.aged.length + B.stale.length + B.incomplete.length + B.overdueLeads.length + B.overdueTasks.length

  // ===== summary / export =====
  function decLabel(id: string) { return decisions[id] ? ` → ${decisions[id]}` : '' }
  function prodLine(p: Row, extra: string) {
    return `- ${pName(p)}${pPart(p) ? ` [${pPart(p)}]` : ''}${pModel(p) ? ` · ${pModel(p)}` : ''}${pPrice(p) ? ` · ฿${pPrice(p).toLocaleString()}` : ' · (ไม่มีราคา)'} · ${extra}${decLabel(p.id)}`
  }
  function summaryText() {
    return [
      `🛡️ Stock / Risk Guard — ${new Date().toLocaleDateString('th-TH')}`,
      `เกณฑ์: ค้างนาน ≥ ${agedDays} วัน · ไม่อัปเดต ≥ ${staleDays} วัน · สินค้าเผยแพร่ ${B.pubCount} ชิ้น`, '',
      `📦 สินค้าค้างนาน (${B.aged.length})`, ...(B.aged.length ? B.aged.map((p) => prodLine(p, `ค้าง ${daysSince(pCreated(p))} วัน`)) : ['- ไม่มีรายการ']), '',
      `🕸️ ไม่อัปเดตนาน (${B.stale.length})`, ...(B.stale.length ? B.stale.map((p) => prodLine(p, `อัปเดตล่าสุด ${daysSince(pUpdated(p))} วัน`)) : ['- ไม่มีรายการ']), '',
      `🖼️ ข้อมูลไม่ครบ (${B.incomplete.length})`, ...(B.incomplete.length ? B.incomplete.map((p) => prodLine(p, !pImg(p) ? 'ไม่มีรูป' : 'ไม่มีราคา')) : ['- ไม่มีรายการ']), '',
      `🔴 lead/task เกินกำหนด (${B.overdueLeads.length + B.overdueTasks.length})`,
      ...(B.overdueLeads.length ? B.overdueLeads.map((l) => `- [Lead] ${l.name || '(ไม่ระบุ)'} · ${partOf(l)} · เลย ${fmtDate(l.follow_due)}`) : []),
      ...(B.overdueTasks.length ? B.overdueTasks.map((t) => `- [Task] ${t.title || '(ไม่มีชื่องาน)'} · เลย ${fmtDate(t.due_date)}`) : []),
      ...((B.overdueLeads.length + B.overdueTasks.length) ? [] : ['- ไม่มีรายการ']), '',
      `หมายเหตุ: AI ช่วยเตือน เจ้าของเป็นผู้ตัดสินใจ (โพสต์ใหม่/ลดราคา/จัดเซ็ต/พักไว้) · margin ต้องดูที่ Profit Guard`,
    ].join('\n')
  }
  function dl(name: string, text: string, type: string) { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
  function exportTxt() { dl(`risk-guard-${todayStr()}.txt`, '﻿' + summaryText(), 'text/plain;charset=utf-8') }
  function briefData() {
    const prod = (p: Row, kind: string, days: number | null) => ({ kind, name: pName(p), part: pPart(p) || null, model: pModel(p) || null, price: pPrice(p) || null, days, decision: decisions[p.id] || null })
    return {
      generated_at: new Date().toISOString(),
      thresholds: { aged_days: agedDays, stale_days: staleDays }, published_count: B.pubCount,
      counts: { aged: B.aged.length, stale: B.stale.length, incomplete: B.incomplete.length, overdue_leads: B.overdueLeads.length, overdue_tasks: B.overdueTasks.length },
      aged: B.aged.map((p) => prod(p, 'aged', daysSince(pCreated(p)))),
      stale: B.stale.map((p) => prod(p, 'stale', daysSince(pUpdated(p)))),
      incomplete: B.incomplete.map((p) => ({ ...prod(p, 'incomplete', null), missing: !pImg(p) ? 'image' : 'price' })),
      overdue_leads: B.overdueLeads.map((l) => ({ name: l.name || null, part: partOf(l), follow_due: l.follow_due || null })),
      overdue_tasks: B.overdueTasks.map((t) => ({ title: t.title || null, due_date: t.due_date || null })),
    }
  }
  function exportJson() { dl(`risk-guard-${todayStr()}.json`, JSON.stringify(briefData(), null, 2), 'application/json') }
  function exportCsv() {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows: string[][] = [['signal', 'name', 'part', 'model', 'price', 'detail', 'decision']]
    B.aged.forEach((p) => rows.push(['ค้างนาน', pName(p), pPart(p), pModel(p), String(pPrice(p) || ''), `ค้าง ${daysSince(pCreated(p))} วัน`, decisions[p.id] || '']))
    B.stale.forEach((p) => rows.push(['ไม่อัปเดตนาน', pName(p), pPart(p), pModel(p), String(pPrice(p) || ''), `${daysSince(pUpdated(p))} วัน`, decisions[p.id] || '']))
    B.incomplete.forEach((p) => rows.push(['ข้อมูลไม่ครบ', pName(p), pPart(p), pModel(p), String(pPrice(p) || ''), !pImg(p) ? 'ไม่มีรูป' : 'ไม่มีราคา', decisions[p.id] || '']))
    B.overdueLeads.forEach((l) => rows.push(['Lead เกินกำหนด', l.name || '', partOf(l), l.car_model || '', '', `เลย ${l.follow_due}`, '']))
    B.overdueTasks.forEach((t) => rows.push(['Task เกินกำหนด', t.title || '', '', '', '', `เลย ${t.due_date}`, '']))
    dl(`risk-guard-${todayStr()}.csv`, '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }

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
            <div style={{ fontWeight: 700, fontSize: 18 }}>🛡️ Stock / Risk Guard</div>
            <div style={{ fontSize: 12, color: '#cbd8cf' }}>เตือนของค้าง · ข้อมูลไม่อัปเดต · งานเสี่ยง — ก่อนเงินจม · {new Date().toLocaleDateString('th-TH')}</div>
          </div>
          <a href="/ops-x7k2m9/profit-guard" style={{ ...qbtn, textDecoration: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>→ Profit Guard (คิดกำไร)</a>
        </div>
      </div>

      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {/* stat strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {stat('ค้างนาน', B.aged.length, '#A32D2D')}
          {stat('ไม่อัปเดต', B.stale.length, '#854F0B')}
          {stat('ข้อมูลไม่ครบ', B.incomplete.length, '#0C447C')}
          {stat('Lead เกิน', B.overdueLeads.length, '#A32D2D')}
          {stat('Task เกิน', B.overdueTasks.length, '#A32D2D')}
        </div>

        {/* thresholds + actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#555' }}>ค้างนาน ≥
            <select value={agedDays} onChange={(e) => setAgedDays(Number(e.target.value))} style={{ ...sel, marginLeft: 4 }}>
              {[30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} วัน</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#555' }}>ไม่อัปเดต ≥
            <select value={staleDays} onChange={(e) => setStaleDays(Number(e.target.value))} style={{ ...sel, marginLeft: 4 }}>
              {[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} วัน</option>)}
            </select>
          </label>
          <span style={{ fontSize: 12, color: '#888' }}>· เผยแพร่ {B.pubCount} ชิ้น · เสี่ยงรวม {totalRisk}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => copy(summaryText(), 'คัดลอกสรุปเสี่ยงแล้ว')} style={{ flex: 1, minWidth: 160, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>📋 คัดลอกสรุปเสี่ยง</button>
          <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
          <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
          <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
        </div>

        {/* 1) สินค้าค้างนาน */}
        <Section title="📦 สินค้าค้างนาน (ลงเว็บนานยังไม่ออก)" count={B.aged.length}>
          {B.aged.length === 0 ? <Empty /> : B.aged.map((p) => (
            <ProductRow key={p.id} p={p} tag={`ค้าง ${daysSince(pCreated(p))} วัน`} tagColor="#A32D2D" decision={decisions[p.id]} onDecision={(d) => setDecision(p.id, d)} />
          ))}
        </Section>

        {/* 2) ไม่อัปเดตนาน */}
        <Section title="🕸️ ไม่อัปเดตนาน (ข้อมูล/ราคาอาจล้าสมัย)" count={B.stale.length}>
          {B.stale.length === 0 ? <Empty /> : B.stale.map((p) => (
            <ProductRow key={p.id} p={p} tag={`อัปเดต ${daysSince(pUpdated(p))} วัน`} tagColor="#854F0B" decision={decisions[p.id]} onDecision={(d) => setDecision(p.id, d)} />
          ))}
        </Section>

        {/* 3) ข้อมูลไม่ครบ */}
        <Section title="🖼️ ข้อมูลไม่ครบ (ขายยากบนเว็บ)" count={B.incomplete.length}>
          {B.incomplete.length === 0 ? <Empty /> : B.incomplete.map((p) => (
            <ProductRow key={p.id} p={p} tag={!pImg(p) ? 'ไม่มีรูป' : 'ไม่มีราคา'} tagColor="#0C447C" decision={decisions[p.id]} onDecision={(d) => setDecision(p.id, d)} />
          ))}
        </Section>

        {/* 4) lead/task overdue */}
        <Section title="🔴 lead / task เกินกำหนด" count={B.overdueLeads.length + B.overdueTasks.length}>
          {(B.overdueLeads.length + B.overdueTasks.length) === 0 ? <Empty /> : (
            <>
              {B.overdueLeads.map((l) => (
                <div key={'l' + l.id} style={{ ...card, borderLeft: '4px solid #A32D2D' }}>
                  <span style={{ fontSize: 11, color: '#0C447C', fontWeight: 700 }}>LEAD</span> <b style={{ fontSize: 13.5 }}>{l.name || '(ไม่ระบุ)'}</b>
                  <span style={{ fontSize: 12.5, color: '#555' }}> — {partOf(l)}{l.car_model ? ` (${l.car_model})` : ''} · เลย {fmtDate(l.follow_due)}</span>
                </div>
              ))}
              {B.overdueTasks.map((t) => (
                <div key={'t' + t.id} style={{ ...card, borderLeft: '4px solid #A32D2D' }}>
                  <span style={{ fontSize: 11, color: BRASS, fontWeight: 700 }}>TASK</span> <b style={{ fontSize: 13.5 }}>{t.title || '(ไม่มีชื่องาน)'}</b>
                  <span style={{ fontSize: 12.5, color: '#555' }}> — เลย {fmtDate(t.due_date)}{t.owner ? ` · ${t.owner}` : ' · ไม่มีเจ้าของ'}</span>
                </div>
              ))}
            </>
          )}
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>จัดการ lead/task จริงที่ Parts Desk / Daily Brief</div>
        </Section>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '10px 0 30px' }}>
          AI ช่วยเตือน · เจ้าของเป็นผู้ตัดสินใจ · margin/ต้นทุน ดูที่ Profit Guard (products ไม่เก็บต้นทุน)
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

function ProductRow({ p, tag, tagColor, decision, onDecision }:
  { p: Row; tag: string; tagColor: string; decision?: string; onDecision: (d: string) => void }) {
  return (
    <div style={{ ...card, borderLeft: `4px solid ${tagColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <b style={{ fontSize: 13.5 }}>{pName(p)}</b>
        <Badge label={tag} bg="#F6EEE9" fg={tagColor} />
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
        {pPart(p) ? `[${pPart(p)}] ` : ''}{pModel(p) || '—'}{pPrice(p) ? ` · ฿${pPrice(p).toLocaleString()}` : ' · (ไม่มีราคา)'}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#999' }}>ตัดสินใจ:</span>
        {DECISIONS.map((d) => (
          <button key={d} onClick={() => onDecision(d)}
            style={{ border: `1px solid ${decision === d ? GREEN : '#ddd'}`, background: decision === d ? GREEN : '#fff', color: decision === d ? '#fff' : '#555', borderRadius: 999, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>{d}</button>
        ))}
      </div>
    </div>
  )
}
