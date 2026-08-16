'use client'
import { useRef, useState, useTransition, useActionState, useMemo } from 'react'
import { nameSimilarity } from '@/lib/docbrief-name-match'
import { STOCK_CATEGORIES } from '@/lib/docbrief-stock-categories'

type Line = {
  id: string; document_id: string; line_no: number
  qty: number | null; part_name: string | null; unit_price: number | null; amount: number | null
  car_model: string | null; confidence: number | null; arithmetic_ok: boolean | null; review_flags: string[]
  sku: string | null; set_price: number | null; location: string | null
  category: string | null; oem: string | null; condition: string | null; note: string | null
}
type Doc = {
  id: string; state: string; original_filename: string
  vendor_name: string | null; doc_date: string | null; grand_total: number | null
  review_flags: string[]; error_category: string | null; error_message: string | null
  retry_count: number | null; created_at: string
}

const STATE: Record<string, { th: string; bg: string; fg: string }> = {
  queued: { th: 'รออ่าน', bg: '#dcfce7', fg: '#166534' },
  extracting: { th: 'กำลังอ่าน', bg: '#ede9fe', fg: '#6d28d9' },
  pending_review: { th: 'รอตรวจ', bg: '#fef9c3', fg: '#854d0e' },
  confirmed: { th: 'ยืนยันแล้ว', bg: '#dbeafe', fg: '#1e40af' },
  exported: { th: 'เข้าสต็อกแล้ว', bg: '#dcfce7', fg: '#166534' },
  failed: { th: 'ไม่ผ่าน', bg: '#fee2e2', fg: '#991b1b' },
}
const FLAG_TH: Record<string, string> = {
  arithmetic_mismatch: 'ตัวเลขไม่ลงตัว', name_missing: 'ไม่มีชื่อ', name_uncertain: 'ชื่ออ่านไม่ชัด',
  qty_missing: 'ไม่มีจำนวน', price_missing: 'ไม่มีราคา', total_mismatch: 'ยอดรวมไม่ตรง', name_review: 'ควรตรวจชื่อ',
  possible_duplicate: 'อาจซ้ำ', qty_defaulted: 'จำนวนเดา (1)', unit_price_derived: 'ต้นทุนคำนวณจากยอดรวม',
}

const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }
const GREEN = '#17301F'

// ช่องจำเป็นก่อน confirm (ตรงกับ REQ ใน confirmStockDocument) — ใช้ทั้ง per-line + counter + sort
const REQ_FIELDS = ['sku', 'part_name', 'qty', 'unit_price', 'set_price', 'location'] as const
const REQ_TH: Record<string, string> = { sku: 'SKU', part_name: 'ชื่อ', qty: 'จำนวน', unit_price: 'ต้นทุน', set_price: 'ราคาขาย', location: 'ที่เก็บ' }
const lineMissing = (l: Line) => REQ_FIELDS.filter((f) => l[f] == null || String(l[f]).trim() === '')
const ATTN_FLAGS = ['name_missing', 'name_uncertain', 'arithmetic_mismatch']
const needsAttn = (l: Line) => lineMissing(l).length > 0 || (l.review_flags ?? []).some((f) => ATTN_FLAGS.includes(f))

type ConfirmState = { ok: boolean; message?: string } | null

type NameWarn = { part_name: string; sku: string | null; similarity: number }

export default function StockIntakeClient({
  docs, linesByDoc, warnByLine = {}, nameOptions = [], locationOptions = [], uploadBills, extractBills, saveLine, autoSku, confirmStock, rejectBill, trashBill, getPreviewUrl,
}: {
  docs: Doc[]
  linesByDoc: Record<string, Line[]>
  warnByLine?: Record<string, NameWarn[]>
  nameOptions?: string[]
  locationOptions?: string[]
  uploadBills: (fd: FormData) => Promise<void>
  extractBills: (fd: FormData) => Promise<void>
  saveLine: (fd: FormData) => Promise<void>
  autoSku: (fd: FormData) => Promise<void>
  confirmStock: (prev: ConfirmState, fd: FormData) => Promise<{ ok: boolean; message?: string }>
  rejectBill: (fd: FormData) => Promise<void>
  trashBill: (fd: FormData) => Promise<void>
  getPreviewUrl: (id: string) => Promise<string | null>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const [picked, setPicked] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null)

  const counts = docs.reduce((a, d) => { a[d.state] = (a[d.state] ?? 0) + 1; return a }, {} as Record<string, number>)

  const doUpload = (fd: FormData) => start(async () => { await uploadBills(fd); if (inputRef.current) inputRef.current.value = ''; setPicked(0) })
  const doExtract = (ids: string[]) => start(async () => { const fd = new FormData(); ids.forEach((i) => fd.append('id', i)); await extractBills(fd) })
  const showPreview = (id: string) => start(async () => { const url = await getPreviewUrl(id); if (url) setPreview({ id, url }) })

  const queued = docs.filter((d) => d.state === 'queued').map((d) => d.id)

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>PROFILE A · STOCK INTAKE</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>📦 รับเข้าสต็อก</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        ถ่ายใบส่งของ → AI แตกรายการ → ตรวจ/แก้ + เติม SKU·ราคาขาย·ที่เก็บ → เข้าสต็อก · <b>ทุกบรรทัดต้องผ่านตาคุณ</b>
      </p>

      {/* อัปโหลด */}
      <form action={doUpload} style={{ marginBottom: 20 }}>
        <label
          style={{ display: 'block', border: '2px dashed #cbd5e1', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', background: '#fafafa' }}>
          <input ref={inputRef} type="file" name="file" accept="image/*,application/pdf" multiple hidden
            onChange={(e) => setPicked(e.target.files?.length ?? 0)} />
          <div style={{ fontSize: 15, color: GREEN, fontWeight: 600 }}>เลือกใบส่งของ (เลือกหลายไฟล์ได้)</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>JPG, PNG, PDF · ไม่เกิน 10 MB{picked > 0 ? ` · เลือกแล้ว ${picked} ไฟล์` : ''}</div>
        </label>
        <button type="submit" disabled={pending || picked === 0}
          style={{ marginTop: 10, width: '100%', padding: 12, borderRadius: 8, border: 'none', background: picked === 0 ? '#d1d5db' : GREEN, color: '#fff', fontWeight: 600, fontSize: 14, cursor: picked === 0 ? 'not-allowed' : 'pointer' }}>
          {pending ? 'กำลังทำงาน…' : 'อัปโหลด'}
        </button>
      </form>

      {/* สรุป + ปุ่มอ่านทั้งหมด */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {['queued', 'pending_review', 'confirmed', 'exported', 'failed'].map((s) => counts[s] ? (
          <span key={s} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: STATE[s].bg, color: STATE[s].fg }}>
            {STATE[s].th}: <b>{counts[s]}</b>
          </span>
        ) : null)}
        {queued.length > 0 && (
          <button onClick={() => doExtract(queued)} disabled={pending}
            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: 'none', background: '#C9A961', color: '#3a2d0a', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            อ่านข้อมูลทั้งหมด ({queued.length})
          </button>
        )}
      </div>

      {docs.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>ยังไม่มีใบส่งของ — อัปโหลดด้านบนได้เลย</p>}

      {/* รายการเอกสาร */}
      {docs.map((d) => {
        const lines = linesByDoc[d.id] ?? []
        const st = STATE[d.state] ?? { th: d.state, bg: '#f3f4f6', fg: '#374151' }
        const isOpen = open === d.id
        return (
          <div key={d.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                  {d.vendor_name || 'ใบส่งของ'} {d.grand_total != null && <span style={{ color: '#6b7280', fontWeight: 400 }}>· รวม {d.grand_total.toLocaleString()} ฿</span>}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {d.original_filename}{d.doc_date ? ` · ${d.doc_date}` : ''}{lines.length ? ` · ${lines.length} รายการ` : ''}
                </div>
                {(d.review_flags?.length > 0) && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {d.review_flags.map((f) => <span key={f} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>{FLAG_TH[f] ?? f}</span>)}
                    {d.review_flags.includes('possible_duplicate') && (
                      <a href={`/ops-x7k2m9/compare/${d.id}`} style={{ fontSize: 10, fontWeight: 700, color: '#6d28d9', textDecoration: 'underline' }}>เทียบ →</a>
                    )}
                  </div>
                )}
                {d.state === 'failed' && d.error_message && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>{d.error_message}</div>}
              </div>
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>{st.th}</span>
              {d.state === 'queued' && (
                <button onClick={() => doExtract([d.id])} disabled={pending}
                  style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #C9A961', background: '#fff', color: '#8a6d2f', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>อ่านข้อมูล</button>
              )}
              {lines.length > 0 && (
                <button onClick={() => setOpen(isOpen ? null : d.id)}
                  style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>{isOpen ? 'ปิด' : 'ตรวจ'}</button>
              )}
              <button onClick={() => showPreview(d.id)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>ดู</button>
              <form action={trashBill} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={d.id} />
                <button type="submit" title="ทิ้งลงถัง (กู้คืนได้)"
                  style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>🗑</button>
              </form>
            </div>

            {/* พรีวิวรูป */}
            {preview?.id === d.id && (
              <div style={{ padding: 12, background: '#f9fafb', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt="ใบส่งของ" style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8 }} />
              </div>
            )}

            {/* ตารางรายการ (ตรวจ/แก้) — เรียงบรรทัดที่ยังไม่ครบ/ติดธง ขึ้นบน */}
            {isOpen && lines.length > 0 && (() => {
              const remaining = lines.filter((l) => lineMissing(l).length > 0).length
              const sorted = [...lines].sort((a, b) => (needsAttn(b) ? 1 : 0) - (needsAttn(a) ? 1 : 0) || a.line_no - b.line_no)
              return (
              <div style={{ borderTop: '1px solid #e5e7eb', background: '#fafafa', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>
                    💡 AI เติมโครงให้แล้ว — คุณ<b>แตะเลือกชื่อ + ราคาขาย + ที่เก็บ</b>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: remaining ? '#fef3c7' : '#dcfce7', color: remaining ? '#92400e' : '#166534' }}>
                    {remaining ? `เหลือ ${remaining} แถวยังไม่ครบ (ชื่อ/ราคาขาย/ที่เก็บ)` : '✓ ครบทุกแถว พร้อมยืนยัน'}
                  </span>
                  <form action={autoSku}>
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" disabled={pending}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #C9A961', background: '#fffbea', color: '#8a6d2f', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      🔢 เติม SKU ใหม่
                    </button>
                  </form>
                </div>
                {sorted.map((l) => <LineForm key={l.id} line={l} warn={warnByLine[l.id]} saveLine={saveLine} pending={pending} start={start} nameOptions={nameOptions} locationOptions={locationOptions} />)}
              </div>
              )
            })()}

            {/* ยืนยัน / ปฏิเสธ */}
            {d.state === 'pending_review' && (
              <ConfirmFooter docId={d.id} lines={lines} confirmStock={confirmStock} rejectBill={rejectBill} />
            )}
          </div>
        )
      })}
    </section>
  )
}

function ConfirmFooter({ docId, lines, confirmStock, rejectBill }: {
  docId: string; lines: Line[]
  confirmStock: (prev: ConfirmState, fd: FormData) => Promise<{ ok: boolean; message?: string }>
  rejectBill: (fd: FormData) => Promise<void>
}) {
  const [state, action, busy] = useActionState(confirmStock, null)
  // เช็กครบทุกช่องจำเป็นก่อน (กันกดทั้งที่ยังไม่พร้อม) — REQ เดียวกับ confirmStockDocument
  const incomplete = lines.filter((l) => lineMissing(l).length > 0)
  const ready = incomplete.length === 0

  return (
    <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6' }}>
      {!ready && (
        <div style={{ fontSize: 12, color: '#b45309', marginBottom: 8 }}>
          ⚠️ ยังกรอกไม่ครบ {incomplete.length} บรรทัด — ต้องมี SKU · ราคาขาย · ที่เก็บ ครบทุกบรรทัดก่อนยืนยัน (อย่าลืมกด &quot;บันทึกบรรทัด&quot;)
        </div>
      )}
      {state?.message && (
        <div style={{ fontSize: 12, color: state.ok ? '#059669' : '#b91c1c', marginBottom: 8 }}>
          {state.ok ? '✓ ' : '⚠️ '}{state.message}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <form action={rejectBill}>
          <input type="hidden" name="id" value={docId} />
          <button type="submit" style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>ปฏิเสธใบนี้</button>
        </form>
        <form action={action}>
          <input type="hidden" name="id" value={docId} />
          <button type="submit" disabled={!ready || busy}
            style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: ready ? '#166534' : '#d1d5db', color: '#fff', fontWeight: 700, fontSize: 13, cursor: ready ? 'pointer' : 'not-allowed' }}>
            {busy ? 'กำลังเข้าสต็อก…' : '✓ ยืนยันเข้าสต็อก'}
          </button>
        </form>
      </div>
    </div>
  )
}

function LineForm({ line, warn, saveLine, pending, start, nameOptions, locationOptions }: {
  line: Line; warn?: NameWarn[]; saveLine: (fd: FormData) => Promise<void>; pending: boolean; start: React.TransitionStartFunction
  nameOptions: string[]; locationOptions: string[]
}) {
  const [saved, setSaved] = useState(false)
  // controlled เฉพาะช่องที่มีปุ่ม/แตะช่วยเติม (ค่ายัง submit ผ่าน form action = saveLine เดิม)
  const [name, setName] = useState(line.part_name ?? '')
  const [setPrice, setSetPrice] = useState(line.set_price != null ? String(line.set_price) : '')
  const [location, setLocation] = useState(line.location ?? '')
  const [condition, setCondition] = useState(line.condition ?? 'มือสอง-A') // default "มือสอง" (ใช้บ่อยสุด · brief ข้อ 5)
  const [nameOpen, setNameOpen] = useState(false)
  const flags = line.review_flags ?? []
  const arithBad = flags.includes('arithmetic_mismatch')
  const unit = Number(line.unit_price) || 0
  const missing = lineMissing(line)

  // ตัวเลือกชื่อจากคลังจริง (reuse nameSimilarity เดียวกับ warnByLine) — substring + fuzzy
  const suggestions = useMemo(() => {
    if (!nameOptions.length) return []
    const q = name.trim()
    if (!q) return nameOptions.slice(0, 12)
    return nameOptions
      .map((n) => ({ n, s: n.includes(q) ? 1 : nameSimilarity(q, n) }))
      .filter((x) => x.s >= 0.34 && x.n !== q)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.n)
  }, [name, nameOptions])
  const recentLoc = locationOptions.slice(0, 6)

  return (
    <form
      action={(fd) => start(async () => { await saveLine(fd); setSaved(true); setTimeout(() => setSaved(false), 1500) })}
      style={{ background: '#fff', border: `1px solid ${arithBad ? '#fca5a5' : missing.length ? '#fde68a' : '#e5e7eb'}`, borderLeft: `4px solid ${missing.length ? '#f59e0b' : '#86efac'}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
      <input type="hidden" name="document_id" value={line.document_id} />
      <input type="hidden" name="id" value={line.id} />

      {/* header + สถานะครบ/ไม่ครบ */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>#{line.line_no}</span>
        {flags.map((f) => <span key={f} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>{FLAG_TH[f] ?? f}</span>)}
        {line.confidence != null && <span style={{ fontSize: 10, color: line.confidence < 0.6 ? '#b91c1c' : '#9ca3af' }}>มั่นใจ {(line.confidence * 100).toFixed(0)}%</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: missing.length ? '#b45309' : '#059669' }}>
          {missing.length ? `ยังไม่ครบ: ${missing.map((f) => REQ_TH[f] ?? f).join(' · ')}` : '✓ ครบ'}
        </span>
      </div>

      {/* ★ ชื่ออะไหล่ = เด่นสุด (combobox แตะเลือก) */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <label style={{ ...lbl, fontWeight: 700, color: '#374151' }}>ชื่ออะไหล่ — แตะเลือกจากของเดิม หรือพิมพ์ใหม่</label>
        <input name="part_name" value={name} autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setNameOpen(true)}
          onBlur={() => setTimeout(() => setNameOpen(false), 150)}
          style={{ ...inp, fontSize: 15, padding: '9px 10px', borderWidth: 1.5, borderColor: warn?.length ? '#fb923c' : flags.includes('name_uncertain') ? '#fbbf24' : '#9ca3af' }} />
        {nameOpen && suggestions.length > 0 && (
          <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, marginTop: 2, maxHeight: 220, overflowY: 'auto', boxShadow: '0 6px 20px rgba(0,0,0,.12)' }}>
            {suggestions.map((s) => (
              <div key={s} onMouseDown={(e) => { e.preventDefault(); setName(s); setNameOpen(false) }}
                style={{ padding: '7px 10px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>{s}</div>
            ))}
          </div>
        )}
        {warn?.length ? (
          <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, color: '#c2410c' }}>⚠️ คล้ายของเดิม (แตะใช้):</span>
            {warn.map((w) => (
              <button key={w.part_name} type="button" onMouseDown={(e) => { e.preventDefault(); setName(w.part_name) }}
                style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, border: '1px solid #fdba74', background: '#fff7ed', color: '#c2410c', cursor: 'pointer' }}>
                {w.part_name}{w.sku ? ` (${w.sku})` : ''}
              </button>
            ))}
            <span style={{ fontSize: 10, color: '#9ca3af' }}>— ถ้าตัวเดียวกัน เติมจำนวนในสต็อกเดิมแทน</span>
          </div>
        ) : null}
      </div>

      {/* AI เติมให้ (มั่นใจสูง · compact/จาง) */}
      <div style={{ display: 'grid', gridTemplateColumns: '68px 96px 1fr', gap: 8, marginBottom: 8, background: '#f9fafb', borderRadius: 6, padding: '6px 8px' }}>
        <div><label style={lbl}>จำนวน</label><input name="qty" defaultValue={line.qty ?? ''} style={{ ...inp, background: '#fff' }} inputMode="numeric" /></div>
        <div><label style={lbl}>ต้นทุน/ชิ้น</label><input name="unit_price" defaultValue={line.unit_price ?? ''} style={{ ...inp, background: '#fff' }} inputMode="numeric" /></div>
        <div><label style={lbl}>SKU <span style={{ color: '#059669', fontWeight: 600 }}>· auto</span></label><input name="sku" defaultValue={line.sku ?? ''} style={{ ...inp, background: '#fff' }} placeholder="140-010" /></div>
      </div>

      {/* เติมเอง: ราคาขาย (×N) + ที่เก็บ (quick-pick) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
        <div>
          <label style={lbl}>ราคาตั้งขาย *</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input name="set_price" value={setPrice} onChange={(e) => setSetPrice(e.target.value)} style={inp} inputMode="numeric" />
            {unit > 0 && [2, 2.5, 3].map((f) => (
              <button key={f} type="button" onClick={() => setSetPrice(String(Math.round(unit * f)))}
                style={{ padding: '0 7px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>×{f}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>ตำแหน่งเก็บ *</label>
          <input name="location" value={location} onChange={(e) => setLocation(e.target.value)} list={`loc-${line.id}`} style={inp} placeholder="A-05" />
          <datalist id={`loc-${line.id}`}>{locationOptions.map((l) => <option key={l} value={l} />)}</datalist>
        </div>
      </div>
      {recentLoc.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>ที่เก็บล่าสุด:</span>
          {recentLoc.map((l) => (
            <button key={l} type="button" onClick={() => setLocation(l)}
              style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      )}

      {/* หมวด (datalist) · สภาพ (chips) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
        <div>
          <label style={lbl}>หมวดหมู่</label>
          <input name="category" defaultValue={line.category ?? ''} list={`cats-${line.id}`} style={inp} placeholder="เลือก/พิมพ์หมวด" />
          <datalist id={`cats-${line.id}`}>{STOCK_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label style={lbl}>สภาพ</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {['มือสอง-A', 'มือสอง-B', 'ใหม่'].map((c) => (
              <button key={c} type="button" onClick={() => setCondition(c)}
                style={{ flex: 1, padding: '5px 2px', borderRadius: 6, border: `1px solid ${condition === c ? '#166534' : '#d1d5db'}`, background: condition === c ? '#dcfce7' : '#fff', color: condition === c ? '#166534' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{c}</button>
            ))}
          </div>
          <input type="hidden" name="condition" value={condition} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input name="oem" defaultValue={line.oem ?? ''} style={{ ...inp, width: 120 }} placeholder="OEM" />
        <input name="note" defaultValue={line.note ?? ''} style={{ ...inp, flex: 1 }} placeholder="หมายเหตุ" />
        <button type="submit" disabled={pending}
          style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: saved ? '#059669' : GREEN, color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {saved ? '✓ บันทึกแล้ว' : 'บันทึกบรรทัด'}
        </button>
      </div>
    </form>
  )
}
