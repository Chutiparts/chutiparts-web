'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { INTAKE_TYPES, LINE_OA_URL, buildLineOAMessageUrl } from '@/lib/constants'
import { updateCase, addNote, sendQuote } from './actions'

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 ใหม่',
  in_review: '🔍 กำลังตรวจ',
  quoted: '💰 เสนอราคาแล้ว',
  confirmed: '✅ ลูกค้ายืนยัน',
  shipped: '📦 จัดส่งแล้ว',
  closed_won: '🏆 ปิดเคส (ขายสำเร็จ)',
  closed_lost: '❌ ปิดเคส (ไม่ปิด)',
  closed_unreachable: '☎️ ติดต่อไม่ได้',
}

export default function CaseDetailClient({ case: c, vehicle, admins }: any) {
  const router = useRouter()
  const [status, setStatus] = useState(c.status)
  const [priority, setPriority] = useState(c.priority)
  const [assignedTo, setAssignedTo] = useState(c.assigned_to || '')
  const [quotedAmount, setQuotedAmount] = useState(c.quoted_amount || '')
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const intakeType = INTAKE_TYPES[c.intake_type as keyof typeof INTAKE_TYPES]

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateCase(c.id, {
        status,
        priority,
        assigned_to: assignedTo || null,
        quoted_amount: quotedAmount ? Number(quotedAmount) : null,
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setSaving(true)
    try {
      await addNote(c.id, newNote)
      setNewNote('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleSendLine = () => {
    // Copy message template to clipboard, then open LINE OA chat manager
    const summary = c.intake_type === 'find_parts'
      ? `อะไหล่: ${c.part_name}`
      : `อาการ: ${(c.symptom_detail || '').slice(0, 100)}`
    const message = `สวัสดีครับ ทีม ChutiBenz ตอบกลับเคส ${c.case_number}\nรุ่น: ${vehicle?.chassis} (${vehicle?.year_from})\n${summary}\n\n[พิมพ์รายละเอียดต่อ]`
    navigator.clipboard?.writeText(message).catch(() => {})
    // Open LINE OA Chat Manager — admin sees chat list with customers
    window.open('https://chat.line.biz/', '_blank')
    alert('Copy message ลง clipboard แล้ว ✓\nเปิด LINE OA Chats → เลือกแชทลูกค้า → paste')
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
      {/* LEFT: case info */}
      <div className="md:col-span-2 space-y-5">
        {/* Customer */}
        <section className="bg-gray-50 rounded-lg p-4">
          <h2 className="font-bold mb-3 flex items-center gap-2">👤 ลูกค้า</h2>
          <div className="space-y-1 text-sm">
            <p><strong>{c.contact_name}</strong></p>
            {c.contact_phone && (
              <p>📞 <a href={`tel:${c.contact_phone}`} className="text-blue-600 hover:underline">{c.contact_phone}</a></p>
            )}
            {c.contact_line_id && <p>💬 LINE: {c.contact_line_id}</p>}
            <p>📍 {c.contact_province}</p>
          </div>
        </section>

        {/* Vehicle */}
        <section className="bg-gray-50 rounded-lg p-4">
          <h2 className="font-bold mb-3">🚗 รถ</h2>
          <p className="text-sm">
            <strong>{vehicle?.chassis}</strong> ปี {vehicle?.year_from}
            {vehicle?.engine_code && ` · ${vehicle.engine_code}`}
            {vehicle?.body_style && ` · ${vehicle.body_style}`}
            {vehicle?.variant && ` · ${vehicle.variant}`}
          </p>
        </section>

        {/* Request */}
        <section className="bg-gray-50 rounded-lg p-4">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            {intakeType?.icon} {intakeType?.label}
          </h2>
          {c.intake_type === 'find_parts' && (
            <div className="space-y-1 text-sm">
              {c.part_name && <p><strong>ชื่อ:</strong> {c.part_name}</p>}
              {c.part_number && <p><strong>Part #:</strong> {c.part_number}</p>}
              {c.part_category && <p><strong>หมวด:</strong> {c.part_category}</p>}
            </div>
          )}
          {(c.intake_type === 'find_garage' || c.intake_type === 'symptom_advice') && (
            <div className="space-y-1 text-sm">
              {c.symptom_category && <p><strong>หมวด:</strong> {c.symptom_category}</p>}
              <p><strong>อาการ:</strong></p>
              <p className="whitespace-pre-wrap bg-white p-3 rounded border">{c.symptom_detail}</p>
              {c.warning_light && <p className="text-orange-600">⚠️ มีไฟเตือนติด</p>}
              {c.stop_drive && <p className="text-red-600 font-bold">🛑 ขับต่อไม่ได้</p>}
            </div>
          )}
        </section>

        {/* Photos */}
        {c.photos && c.photos.length > 0 && (
          <section className="bg-gray-50 rounded-lg p-4">
            <h2 className="font-bold mb-3">📷 หลักฐาน ({c.photos.length})</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {c.photos.map((p: any, i: number) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="w-full aspect-square object-cover rounded hover:opacity-80" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Notes */}
        <section>
          <h2 className="font-bold mb-3">📝 Notes</h2>
          <div className="space-y-2 mb-3">
            {(c.notes || []).map((n: any, i: number) => (
              <div key={i} className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-sm">
                <p className="whitespace-pre-wrap">{n.text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {n.author} · {new Date(n.at).toLocaleString('th-TH')}
                </p>
              </div>
            ))}
          </div>
          <textarea
            rows={3}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="เพิ่ม note..."
            className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm focus:border-yellow-500 focus:outline-none"
          />
          <button
            onClick={handleAddNote}
            disabled={saving || !newNote.trim()}
            className="mt-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            เพิ่ม Note
          </button>
        </section>
      </div>

      {/* RIGHT: actions */}
      <aside className="space-y-4">
        {/* Status */}
        <section className="bg-white rounded-lg border border-gray-200 p-4">
          <label className="block text-sm font-semibold mb-2">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-2 mb-3"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <label className="block text-sm font-semibold mb-2">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-2 mb-3"
          >
            <option value="low">ต่ำ</option>
            <option value="normal">ปกติ</option>
            <option value="high">สูง</option>
            <option value="urgent">🚨 ด่วน</option>
          </select>

          <label className="block text-sm font-semibold mb-2">ผู้ดูแล</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-lg p-2 mb-3"
          >
            <option value="">— เลือก —</option>
            {admins.map((a: any) => (
              <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
            ))}
          </select>

          <label className="block text-sm font-semibold mb-2">Quoted ฿</label>
          <input
            type="number"
            value={quotedAmount}
            onChange={(e) => setQuotedAmount(e.target.value)}
            placeholder="0"
            className="w-full border-2 border-gray-200 rounded-lg p-2 mb-3"
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
        </section>

        {/* Quick actions */}
        <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
          <button
            onClick={handleSendLine}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            💬 ส่ง LINE
          </button>
          <a
            href={c.contact_phone ? `tel:${c.contact_phone}` : '#'}
            className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg text-center"
          >
            📞 โทร
          </a>
        </section>

        {/* SLA */}
        <section className="bg-white rounded-lg border border-gray-200 p-4 text-sm">
          <p className="font-semibold mb-1">⏰ SLA</p>
          <p className="text-gray-600">
            กำหนดตอบ: {c.sla_due_at ? new Date(c.sla_due_at).toLocaleString('th-TH') : '-'}
          </p>
          {c.first_responded_at ? (
            <p className="text-green-600 mt-1">✓ ตอบเมื่อ {new Date(c.first_responded_at).toLocaleString('th-TH')}</p>
          ) : (
            <p className="text-orange-600 mt-1">⏳ ยังไม่ตอบ</p>
          )}
        </section>
      </aside>
    </div>
  )
}
