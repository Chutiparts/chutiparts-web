'use client'
// app/ops-x7k2m9/documents/DocumentsClient.tsx — docbrief intake UI (owner-only)
// หน้าเดียว: อัปโหลด + inbox · ไม่สร้าง layout/nav ใหม่ (ห่อด้วย OpsShell จาก layout เดิม)
import { useRef, useState, useTransition } from 'react'

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
}

const STATE_LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  queued: { text: 'เข้าคิว', bg: '#dcfce7', fg: '#166534' },
  received: { text: 'รับแล้ว', bg: '#e0f2fe', fg: '#075985' },
  extracting: { text: 'กำลังอ่าน', bg: '#ede9fe', fg: '#5b21b6' },
  pending_review: { text: 'รอตรวจ', bg: '#fef9c3', fg: '#854d0e' },
  confirmed: { text: 'ยืนยันแล้ว', bg: '#dbeafe', fg: '#1e40af' },
  exported: { text: 'ส่งออกแล้ว', bg: '#d1fae5', fg: '#065f46' },
  duplicate: { text: 'ซ้ำ', bg: '#fef3c7', fg: '#92400e' },
  rejected: { text: 'ปฏิเสธ', bg: '#f3f4f6', fg: '#374151' },
  failed: { text: 'ไม่ผ่าน', bg: '#fee2e2', fg: '#991b1b' },
}

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`)

export default function DocumentsClient({
  docs, uploadDocuments,
}: { docs: Doc[]; uploadDocuments: (fd: FormData) => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const [picked, setPicked] = useState(0)

  const submit = (fd: FormData) => start(async () => {
    await uploadDocuments(fd)
    setPicked(0)
    if (inputRef.current) inputRef.current.value = ''
  })

  const counts = docs.reduce<Record<string, number>>((a, d) => ({ ...a, [d.state]: (a[d.state] || 0) + 1 }), {})

  return (
    <div style={{ padding: '18px 16px 60px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: '#17301F' }}>📄 เอกสาร</div>
      <div style={{ fontSize: 13, color: '#777', marginBottom: 18 }}>
        บิลซื้อจาก vendor (invoice / receipt / ใบกำกับภาษี) · อัปโหลดเก็บต้นฉบับ + เข้าคิวรออ่านข้อมูล
      </div>

      {/* ===== Upload ===== */}
      <form ref={formRef} action={submit}
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
          {pending ? 'กำลังอัปโหลด…' : 'อัปโหลด'}
        </button>
      </form>

      {/* ===== Summary ===== */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {['queued', 'pending_review', 'duplicate', 'failed'].map((s) => (
          <div key={s} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>
            <span style={{ color: '#777' }}>{STATE_LABEL[s]?.text || s}: </span>
            <b style={{ color: '#17301F' }}>{counts[s] || 0}</b>
          </div>
        ))}
      </div>

      {/* ===== Inbox ===== */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 620 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left', color: '#6b7280', fontSize: 11.5 }}>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>ไฟล์</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>สถานะ</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>ขนาด</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>หน้า</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>เวลา</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 34, textAlign: 'center', color: '#9ca3af' }}>ยังไม่มีเอกสาร</td></tr>
              )}
              {docs.map((d) => {
                const st = STATE_LABEL[d.state] || { text: d.state, bg: '#f3f4f6', fg: '#374151' }
                return (
                  <tr key={d.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#111' }}>{d.original_filename}</div>
                      {d.error_message && <div style={{ fontSize: 11.5, color: '#b91c1c' }}>{d.error_message}</div>}
                      {d.duplicate_of && <div style={{ fontSize: 11.5, color: '#b45309' }}>ซ้ำกับเอกสารก่อนหน้า</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>{st.text}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{fmtSize(d.file_size)}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{d.page_count ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap' }}>
                      {new Date(d.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
