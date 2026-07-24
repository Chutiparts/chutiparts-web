'use client'
import { useRef, useState, useTransition, useActionState } from 'react'

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
}

const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }
const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }
const GREEN = '#17301F'

type ConfirmState = { ok: boolean; message?: string } | null

export default function StockIntakeClient({
  docs, linesByDoc, uploadBills, extractBills, saveLine, autoSku, confirmStock, rejectBill, getPreviewUrl,
}: {
  docs: Doc[]
  linesByDoc: Record<string, Line[]>
  uploadBills: (fd: FormData) => Promise<void>
  extractBills: (fd: FormData) => Promise<void>
  saveLine: (fd: FormData) => Promise<void>
  autoSku: (fd: FormData) => Promise<void>
  confirmStock: (prev: ConfirmState, fd: FormData) => Promise<{ ok: boolean; message?: string }>
  rejectBill: (fd: FormData) => Promise<void>
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
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {d.review_flags.map((f) => <span key={f} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>{FLAG_TH[f] ?? f}</span>)}
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
            </div>

            {/* พรีวิวรูป */}
            {preview?.id === d.id && (
              <div style={{ padding: 12, background: '#f9fafb', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt="ใบส่งของ" style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8 }} />
              </div>
            )}

            {/* ตารางรายการ (ตรวจ/แก้) */}
            {isOpen && lines.length > 0 && (
              <div style={{ borderTop: '1px solid #e5e7eb', background: '#fafafa', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>
                    💡 จาก AI: <b>จำนวน · ชื่อ · ต้นทุน</b> · เติมอัตโนมัติ: <b>SKU · หมวดหมู่ · สภาพ</b> · เติมเอง: <b>ราคาขาย · ที่เก็บ</b>
                  </div>
                  <form action={autoSku}>
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" disabled={pending}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #C9A961', background: '#fffbea', color: '#8a6d2f', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      🔢 เติมอัตโนมัติ
                    </button>
                  </form>
                </div>
                {lines.map((l) => <LineForm key={l.id} line={l} saveLine={saveLine} pending={pending} start={start} />)}
              </div>
            )}

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
  // เช็กครบทุกช่องจำเป็นก่อน (กันกดทั้งที่ยังไม่พร้อม)
  const REQ: (keyof Line)[] = ['sku', 'part_name', 'qty', 'unit_price', 'set_price', 'location']
  const incomplete = lines.filter((l) => REQ.some((f) => l[f] == null || String(l[f]).trim() === ''))
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

function LineForm({ line, saveLine, pending, start }: {
  line: Line; saveLine: (fd: FormData) => Promise<void>; pending: boolean; start: React.TransitionStartFunction
}) {
  const [saved, setSaved] = useState(false)
  const flags = line.review_flags ?? []
  const arithBad = flags.includes('arithmetic_mismatch')
  return (
    <form
      action={(fd) => start(async () => { await saveLine(fd); setSaved(true); setTimeout(() => setSaved(false), 1500) })}
      style={{ background: '#fff', border: `1px solid ${arithBad ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
      <input type="hidden" name="document_id" value={line.document_id} />
      <input type="hidden" name="id" value={line.id} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>#{line.line_no}</span>
        {flags.map((f) => <span key={f} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>{FLAG_TH[f] ?? f}</span>)}
        {line.confidence != null && <span style={{ fontSize: 10, color: line.confidence < 0.6 ? '#b91c1c' : '#9ca3af' }}>ความมั่นใจ {(line.confidence * 100).toFixed(0)}%</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: line.arithmetic_ok ? '#059669' : '#9ca3af' }}>
          {line.arithmetic_ok ? '✓ ตัวเลขลงตัว' : ''}{line.amount != null ? ` · รวม ${line.amount.toLocaleString()} ฿` : ''}
        </span>
      </div>
      {/* จาก AI */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px', gap: 8, marginBottom: 8 }}>
        <div><label style={lbl}>จำนวน</label><input name="qty" defaultValue={line.qty ?? ''} style={inp} inputMode="numeric" /></div>
        <div><label style={lbl}>ชื่ออะไหล่</label><input name="part_name" defaultValue={line.part_name ?? ''} style={{ ...inp, borderColor: flags.includes('name_uncertain') ? '#fbbf24' : '#d1d5db' }} /></div>
        <div><label style={lbl}>ต้นทุน/ชิ้น</label><input name="unit_price" defaultValue={line.unit_price ?? ''} style={inp} inputMode="numeric" /></div>
      </div>
      {/* เติมเอง */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
        <div><label style={lbl}>SKU *</label><input name="sku" defaultValue={line.sku ?? ''} style={inp} placeholder="เช่น 140-010" /></div>
        <div><label style={lbl}>ราคาตั้งขาย *</label><input name="set_price" defaultValue={line.set_price ?? ''} style={inp} inputMode="numeric" /></div>
        <div><label style={lbl}>ตำแหน่งเก็บ *</label><input name="location" defaultValue={line.location ?? ''} style={inp} placeholder="เช่น A-05" /></div>
        <div><label style={lbl}>หมวดหมู่</label><input name="category" defaultValue={line.category ?? ''} style={inp} placeholder="เช่น LGT-03 ไฟท้าย" /></div>
        <div><label style={lbl}>OEM</label><input name="oem" defaultValue={line.oem ?? ''} style={inp} /></div>
        <div><label style={lbl}>สภาพ</label><input name="condition" defaultValue={line.condition ?? ''} style={inp} placeholder="เช่น มือสอง-A" /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input name="note" defaultValue={line.note ?? ''} style={{ ...inp, flex: 1 }} placeholder="หมายเหตุ" />
        <button type="submit" disabled={pending}
          style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: GREEN, color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {saved ? '✓ บันทึกแล้ว' : 'บันทึกบรรทัด'}
        </button>
      </div>
    </form>
  )
}
