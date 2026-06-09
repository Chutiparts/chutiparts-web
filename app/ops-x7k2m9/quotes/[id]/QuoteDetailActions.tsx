// app/ops-x7k2m9/quotes/[id]/QuoteDetailActions.tsx — Status update + note
// Phase 1A · Day 3 — 2026-06-09

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = [
  { value: 'new', label: '🆕 ใหม่' },
  { value: 'reviewing', label: '👀 กำลังดู' },
  { value: 'quoted', label: '💬 quoted' },
  { value: 'waiting_customer', label: '⏳ รอลูกค้า' },
  { value: 'won', label: '✅ won' },
  { value: 'lost', label: '❌ lost' },
  { value: 'archived', label: '🗄 archive' },
]

interface Props {
  quoteId: string
  currentStatus: string
  currentNote: string
  customerPhone: string | null
  customerLine: string | null
}

export default function QuoteDetailActions({
  quoteId,
  currentStatus,
  currentNote,
  customerPhone,
  customerLine,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState(currentStatus)
  const [note, setNote] = useState(currentNote)
  const [reason, setReason] = useState('')
  const [followupHours, setFollowupHours] = useState<number | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  async function handleUpdate() {
    setSaveMsg('')
    startTransition(async () => {
      try {
        const res = await fetch(`/api/quotes/${quoteId}/update`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status,
            owner_note: note,
            reason,
            followup_hours: followupHours,
          }),
        })

        if (res.ok) {
          setSaveMsg('✅ บันทึกแล้ว')
          setReason('')
          router.refresh()
          setTimeout(() => setSaveMsg(''), 3000)
        } else {
          const e = await res.json().catch(() => ({}))
          setSaveMsg(`❌ ${e.error?.message || 'บันทึกไม่สำเร็จ'}`)
        }
      } catch (err) {
        setSaveMsg('❌ network error')
      }
    })
  }

  // Quick contact links
  const linePersonalUrl = customerLine
    ? `https://line.me/R/oaMessage/@${customerLine.replace(/^@/, '')}`
    : 'https://line.me/R/ti/p/%40440ifncj'

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-lg text-gray-900">⚙️ Actions</h2>

      {/* Status */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full md:w-auto border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Reason (only show if status changed) */}
      {status !== currentStatus && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">เหตุผลเปลี่ยน status (optional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น คุยกับลูกค้าเรียบร้อย / ลูกค้าตัดสินใจซื้อ"
            className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
          />
        </div>
      )}

      {/* Owner Note */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Owner Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961] font-mono"
        />
      </div>

      {/* Followup */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">ตั้ง Follow-up Reminder</label>
        <div className="flex flex-wrap gap-2">
          {[null, 4, 24, 72].map((h) => (
            <button
              key={String(h)}
              type="button"
              onClick={() => setFollowupHours(h)}
              className={`text-xs px-3 py-1.5 border transition ${
                followupHours === h
                  ? 'bg-[#1C1D2C] text-[#C9A961] border-[#C9A961]'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-[#C9A961]'
              }`}
            >
              {h === null ? 'ไม่ตั้ง' : `${h} ชม.`}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={handleUpdate}
          disabled={pending}
          className="bg-[#C9A961] hover:bg-[#D8B872] disabled:bg-gray-400 text-[#1C1D2C] font-medium px-5 py-2.5 text-sm transition"
        >
          {pending ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
        </button>

        {saveMsg && <span className="text-sm">{saveMsg}</span>}
      </div>

      {/* Quick contact */}
      <div className="border-t border-gray-200 pt-4">
        <div className="text-xs text-gray-500 mb-2">🔗 ติดต่อลูกค้าด่วน:</div>
        <div className="flex flex-wrap gap-2">
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 transition"
            >
              📞 โทร {customerPhone}
            </a>
          )}
          {customerLine && (
            <a
              href={`https://line.me/R/ti/p/${customerLine}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#06C755] hover:bg-[#05B04A] text-white text-xs px-3 py-1.5 transition"
            >
              💬 LINE: {customerLine}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
