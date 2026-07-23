'use client'
// app/ops-x7k2m9/documents/DocumentsClient.tsx — docbrief UI (owner-only)
// หน้าเดียว: อัปโหลด → อ่านข้อมูล → ตรวจ/แก้/ยืนยัน · ไม่สร้าง layout/nav ใหม่
import { useRef, useState, useTransition } from 'react'

type Issue = { flag: string; field: string; message: string }
type Doc = {
  id: string
  state: string
  original_filename: string
  mime_type: string
  file_size: number
  page_count: number | null
  error_message: string | null
  duplicate_of: string | null
  created_at: string
  vendor_name?: string | null
  vendor_tax_id?: string | null
  doc_no?: string | null
  doc_date?: string | null
  subtotal?: number | null
  vat?: number | null
  grand_total?: number | null
  currency?: string | null
  confidence?: Record<string, number> | null
  review_flags?: string[] | null
  raw_extraction?: { _issues?: Issue[]; notes?: string } | null
}

const STATE_LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  queued: { text: 'รออ่าน', bg: '#dcfce7', fg: '#166534' },
  received: { text: 'รับแล้ว', bg: '#e0f2fe', fg: '#075985' },
  extracting: { text: 'กำลังอ่าน', bg: '#ede9fe', fg: '#5b21b6' },
  pending_review: { text: 'รอตรวจ', bg: '#fef9c3', fg: '#854d0e' },
  confirmed: { text: 'ยืนยันแล้ว', bg: '#dbeafe', fg: '#1e40af' },
  exported: { text: 'ส่งออกแล้ว', bg: '#d1fae5', fg: '#065f46' },
  duplicate: { text: 'ซ้ำ', bg: '#fef3c7', fg: '#92400e' },
  rejected: { text: 'ปฏิเสธ', bg: '#f3f4f6', fg: '#374151' },
  failed: { text: 'ไม่ผ่าน', bg: '#fee2e2', fg: '#991b1b' },
}

const FLAG_LABEL: Record<string, string> = {
  missing_doc_no: 'ไม่มีเลขที่เอกสาร',
  validation_failed: 'ข้อมูลไม่ผ่านการตรวจ',
  vat_mismatch: 'VAT ผิดปกติ',
  invalid_tax_id: 'เลขภาษีไม่ถูกต้อง',
  future_date: 'วันที่อนาคต',
  low_confidence: 'อ่านไม่ชัด',
  possible_duplicate: 'อาจซ้ำ',
  cost_soft_cap: 'ต้นทุนสูง',
}

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`)
const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#6b7280', marginBottom: 3, display: 'block' }

// ต้องมีครบ 3 อย่างนี้ถึงยืนยันได้ (ตรงกับ canExport ฝั่ง server)
const readyToConfirm = (d: Doc) => !!d.doc_no?.trim() && d.grand_total != null && d.grand_total > 0 && !!d.doc_date

export default function DocumentsClient({
  docs, uploadDocuments, extractDocuments, saveReview, confirmDocument, rejectDocument,
  exportDocuments, sheetConfigured,
}: {
  docs: Doc[]
  uploadDocuments: (fd: FormData) => Promise<void>
  extractDocuments: (fd: FormData) => Promise<void>
  saveReview: (fd: FormData) => Promise<void>
  confirmDocument: (fd: FormData) => Promise<void>
  rejectDocument: (fd: FormData) => Promise<void>
  exportDocuments: (fd: FormData) => Promise<void>
  sheetConfigured: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const [picked, setPicked] = useState(0)
  const [open, setOpen] = useState<string | null>(null)

  const upload = (fd: FormData) => start(async () => {
    await uploadDocuments(fd)
    setPicked(0)
    if (inputRef.current) inputRef.current.value = ''
  })
  const extract = (ids: string[]) => start(async () => {
    const fd = new FormData()
    for (const id of ids) fd.append('id', id)
    await extractDocuments(fd)
  })
  const doExport = (ids: string[]) => start(async () => {
    const fd = new FormData()
    for (const id of ids) fd.append('id', id)
    await exportDocuments(fd)
  })

  const counts = docs.reduce<Record<string, number>>((a, d) => ({ ...a, [d.state]: (a[d.state] || 0) + 1 }), {})
  const queuedIds = docs.filter((d) => d.state === 'queued').map((d) => d.id)
  const confirmedIds = docs.filter((d) => d.state === 'confirmed').map((d) => d.id)

  return (
    <div style={{ padding: '18px 16px 60px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: '#17301F' }}>📄 เอกสาร</div>
      <div style={{ fontSize: 13, color: '#777', marginBottom: 18 }}>
        อัปโหลด → อ่านข้อมูล → ตรวจ/แก้ → ยืนยัน · ทุกใบต้องผ่านตาคุณก่อนเสมอ
      </div>

      {/* ===== Upload ===== */}
      <form action={upload}
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, marginBottom: 22 }}>
        <label htmlFor="file" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer',
          border: '2px dashed #d1d5db', borderRadius: 12, padding: '26px 16px', textAlign: 'center',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#17301F' }}>
            {picked > 0 ? `เลือกไว้ ${picked} ไฟล์` : 'เลือกไฟล์ (เลือกหลายไฟล์ได้)'}
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>PDF, JPG, PNG · สูงสุด 10 MB · PDF ไม่เกิน 5 หน้า</span>
          <input id="file" name="file" ref={inputRef} type="file" multiple hidden
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setPicked(e.target.files?.length || 0)} />
        </label>
        <button type="submit" disabled={pending || picked === 0}
          style={{
            marginTop: 12, width: '100%', padding: '11px', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 600,
            background: pending || picked === 0 ? '#cbd5e1' : '#17301F', color: '#fff',
            cursor: pending || picked === 0 ? 'not-allowed' : 'pointer',
          }}>
          {pending ? 'กำลังทำงาน…' : 'อัปโหลด'}
        </button>
      </form>

      {/* ===== Summary ===== */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {['queued', 'pending_review', 'confirmed', 'exported', 'failed'].map((s) => (
          <div key={s} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>
            <span style={{ color: '#777' }}>{STATE_LABEL[s]?.text || s}: </span>
            <b style={{ color: '#17301F' }}>{counts[s] || 0}</b>
          </div>
        ))}
        {queuedIds.length > 0 && (
          <button type="button" disabled={pending} onClick={() => extract(queuedIds)}
            style={{
              marginLeft: 'auto', padding: '8px 16px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600,
              background: pending ? '#cbd5e1' : '#C9A961', color: '#17301F', cursor: pending ? 'not-allowed' : 'pointer',
            }}>
            {pending ? 'กำลังอ่าน…' : `อ่านข้อมูลทั้งหมด (${queuedIds.length})`}
          </button>
        )}
        {confirmedIds.length > 0 && (
          <button type="button" disabled={pending || !sheetConfigured} onClick={() => doExport(confirmedIds)}
            title={sheetConfigured ? '' : 'ยังไม่ได้ตั้งค่า Google Sheet'}
            style={{
              marginLeft: queuedIds.length ? 0 : 'auto', padding: '8px 16px', borderRadius: 9, border: 'none',
              fontSize: 13, fontWeight: 600,
              background: pending || !sheetConfigured ? '#cbd5e1' : '#166534', color: '#fff',
              cursor: pending || !sheetConfigured ? 'not-allowed' : 'pointer',
            }}>
            {pending ? 'กำลังส่ง…' : `ส่งเข้า Sheet (${confirmedIds.length})`}
          </button>
        )}
      </div>
      {!sheetConfigured && confirmedIds.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '9px 12px', marginBottom: 12, fontSize: 12.5, color: '#92400e' }}>
          มีเอกสารยืนยันแล้ว {confirmedIds.length} ใบ รอส่งออก — แต่ยังไม่ได้ตั้งค่า Google Sheet
          (ต้องมี <code>DOCBRIEF_SHEET_WEBHOOK_URL</code> และ <code>DOCBRIEF_SHEET_SECRET</code>)
        </div>
      )}

      {/* ===== Inbox ===== */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 780 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left', color: '#6b7280', fontSize: 11.5 }}>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>ไฟล์ / ผู้ขาย</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>สถานะ</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>เลขที่</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>วันที่</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>ยอดสุทธิ</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 34, textAlign: 'center', color: '#9ca3af' }}>ยังไม่มีเอกสาร</td></tr>
              )}
              {docs.map((d) => {
                const st = STATE_LABEL[d.state] || { text: d.state, bg: '#f3f4f6', fg: '#374151' }
                const flags = d.review_flags || []
                const isOpen = open === d.id
                return (
                  <>
                    <tr key={d.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#111' }}>{d.vendor_name || d.original_filename}</div>
                        <div style={{ fontSize: 11.5, color: '#9ca3af' }}>
                          {d.vendor_name ? d.original_filename : `${fmtSize(d.file_size)}${d.page_count ? ` · ${d.page_count} หน้า` : ''}`}
                        </div>
                        {d.error_message && <div style={{ fontSize: 11.5, color: '#b91c1c' }}>{d.error_message}</div>}
                        {d.duplicate_of && <div style={{ fontSize: 11.5, color: '#b45309' }}>ซ้ำกับเอกสารก่อนหน้า</div>}
                        {flags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                            {flags.map((f) => (
                              <span key={f} style={{ background: '#fef3c7', color: '#92400e', borderRadius: 5, padding: '1px 6px', fontSize: 10.5, fontWeight: 600 }}>
                                {FLAG_LABEL[f] || f}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>{st.text}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#555' }}>{d.doc_no || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#555', whiteSpace: 'nowrap' }}>{d.doc_date || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#111', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {d.grand_total != null ? `${fmtMoney(d.grand_total)} ${d.currency || 'THB'}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {d.state === 'queued' && (
                          <button type="button" disabled={pending} onClick={() => extract([d.id])}
                            style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid #C9A961', fontSize: 12, fontWeight: 600, background: '#fff', color: '#8a6d2f', cursor: pending ? 'not-allowed' : 'pointer' }}>
                            อ่านข้อมูล
                          </button>
                        )}
                        {d.state === 'confirmed' && (
                          <button type="button" disabled={pending || !sheetConfigured} onClick={() => doExport([d.id])}
                            style={{
                              marginRight: 6, padding: '5px 11px', borderRadius: 7, border: '1px solid #166534',
                              fontSize: 12, fontWeight: 600, background: '#fff',
                              color: sheetConfigured ? '#166534' : '#9ca3af',
                              cursor: pending || !sheetConfigured ? 'not-allowed' : 'pointer',
                            }}>
                            ส่งเข้า Sheet
                          </button>
                        )}
                        {(d.state === 'pending_review' || d.state === 'confirmed' || d.state === 'exported') && (
                          <button type="button" onClick={() => setOpen(isOpen ? null : d.id)}
                            style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, background: '#fff', color: '#374151', cursor: 'pointer' }}>
                            {isOpen ? 'ปิด' : d.state === 'pending_review' ? 'ตรวจ' : 'ดู'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr key={`${d.id}-detail`} style={{ background: '#fafafa' }}>
                        <td colSpan={6} style={{ padding: '14px 16px' }}>
                          {/* ปัญหาที่ตรวจพบ */}
                          {(d.raw_extraction?._issues || []).length > 0 && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '10px 12px', marginBottom: 14 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 5 }}>สิ่งที่ต้องดู</div>
                              {(d.raw_extraction?._issues || []).map((iss, i) => (
                                <div key={i} style={{ fontSize: 12.5, color: '#78350f' }}>• {iss.message}</div>
                              ))}
                            </div>
                          )}
                          {d.raw_extraction?.notes && (
                            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                              <b>โมเดลบันทึกไว้:</b> {d.raw_extraction.notes}
                            </div>
                          )}

                          {d.state === 'pending_review' ? (
                            <>
                              <form action={saveReview}>
                                <input type="hidden" name="id" value={d.id} />
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 11 }}>
                                  <div><label style={labelStyle}>ผู้ขาย</label><input name="vendor_name" defaultValue={d.vendor_name ?? ''} style={inputStyle} /></div>
                                  <div><label style={labelStyle}>เลขผู้เสียภาษี (13 หลัก)</label><input name="vendor_tax_id" defaultValue={d.vendor_tax_id ?? ''} style={inputStyle} /></div>
                                  <div><label style={labelStyle}>เลขที่เอกสาร *</label><input name="doc_no" defaultValue={d.doc_no ?? ''} style={inputStyle} /></div>
                                  <div><label style={labelStyle}>วันที่ (ค.ศ.) *</label><input name="doc_date" type="date" defaultValue={d.doc_date ?? ''} style={inputStyle} /></div>
                                  <div><label style={labelStyle}>ก่อน VAT</label><input name="subtotal" inputMode="decimal" defaultValue={d.subtotal ?? ''} style={inputStyle} /></div>
                                  <div><label style={labelStyle}>VAT</label><input name="vat" inputMode="decimal" defaultValue={d.vat ?? ''} style={inputStyle} /></div>
                                  <div><label style={labelStyle}>ยอดสุทธิ *</label><input name="grand_total" inputMode="decimal" defaultValue={d.grand_total ?? ''} style={inputStyle} /></div>
                                  <div><label style={labelStyle}>สกุลเงิน</label><input name="currency" defaultValue={d.currency ?? 'THB'} style={inputStyle} /></div>
                                </div>
                                <button type="submit" style={{ marginTop: 12, padding: '8px 18px', borderRadius: 8, border: '1px solid #17301F', background: '#fff', color: '#17301F', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                  บันทึกการแก้ไข
                                </button>
                                <span style={{ marginLeft: 10, fontSize: 11.5, color: '#9ca3af' }}>* จำเป็นต้องมีก่อนยืนยัน</span>
                              </form>

                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                                <form action={confirmDocument}>
                                  <input type="hidden" name="id" value={d.id} />
                                  <button type="submit" disabled={!readyToConfirm(d)}
                                    style={{
                                      padding: '9px 22px', borderRadius: 8, border: 'none', fontSize: 13.5, fontWeight: 700,
                                      background: readyToConfirm(d) ? '#17301F' : '#cbd5e1', color: '#fff',
                                      cursor: readyToConfirm(d) ? 'pointer' : 'not-allowed',
                                    }}>
                                    ✓ ยืนยันข้อมูล
                                  </button>
                                </form>
                                {!readyToConfirm(d) && (
                                  <span style={{ fontSize: 12, color: '#b45309' }}>
                                    กรอกเลขที่เอกสาร / วันที่ / ยอดสุทธิ ให้ครบก่อน แล้วกด “บันทึกการแก้ไข”
                                  </span>
                                )}
                                <form action={rejectDocument} style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                  <input type="hidden" name="id" value={d.id} />
                                  <input name="reason" placeholder="เหตุผลที่ปฏิเสธ" style={{ ...inputStyle, width: 170 }} />
                                  <button type="submit" style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    ปฏิเสธ
                                  </button>
                                </form>
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, fontSize: 12.5 }}>
                              {[
                                ['ผู้ขาย', d.vendor_name || '—'], ['เลขผู้เสียภาษี', d.vendor_tax_id || '—'],
                                ['เลขที่เอกสาร', d.doc_no || '—'], ['วันที่', d.doc_date || '—'],
                                ['ก่อน VAT', fmtMoney(d.subtotal)], ['VAT', fmtMoney(d.vat)],
                                ['ยอดสุทธิ', fmtMoney(d.grand_total)], ['สกุลเงิน', d.currency || '—'],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{label}</div>
                                  <div style={{ color: '#111', fontWeight: 600 }}>{value}</div>
                                </div>
                              ))}
                              <div style={{ gridColumn: '1/-1', fontSize: 11.5, color: '#9ca3af', marginTop: 6 }}>
                                {d.state === 'exported' ? 'ส่งเข้า Google Sheet เรียบร้อยแล้ว' : 'ยืนยันแล้ว — กด “ส่งเข้า Sheet” เพื่อส่งออก'}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
