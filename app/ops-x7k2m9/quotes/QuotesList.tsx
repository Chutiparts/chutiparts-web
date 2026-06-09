// app/ops-x7k2m9/quotes/QuotesList.tsx — Client list with filter + sound alert
// Phase 1A · Day 3 — 2026-06-09

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Quote = {
  id: string
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  customer_line: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  part_description: string | null
  photo_urls: string[] | null
  ai_part_guess: string | null
  ai_confidence: number | null
  matched_sku: string | null
  matched_price: number | null
  match_confidence: number | null
  status: string
  owner_note: string | null
  age_hours: number | null
  is_stale: boolean | null
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด', color: 'gray' },
  { value: 'new', label: '🆕 ใหม่', color: 'blue' },
  { value: 'reviewing', label: '👀 กำลังดู', color: 'yellow' },
  { value: 'quoted', label: '💬 quoted', color: 'purple' },
  { value: 'waiting_customer', label: '⏳ รอลูกค้า', color: 'orange' },
  { value: 'won', label: '✅ won', color: 'green' },
  { value: 'lost', label: '❌ lost', color: 'red' },
  { value: 'archived', label: '🗄 archive', color: 'gray' },
]

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-300',
  reviewing: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  quoted: 'bg-purple-100 text-purple-800 border-purple-300',
  waiting_customer: 'bg-orange-100 text-orange-800 border-orange-300',
  won: 'bg-green-100 text-green-800 border-green-300',
  lost: 'bg-red-100 text-red-800 border-red-300',
  archived: 'bg-gray-100 text-gray-600 border-gray-300',
}

const STATUS_LABEL: Record<string, string> = {
  new: '🆕 ใหม่',
  reviewing: '👀 กำลังดู',
  quoted: '💬 quoted',
  waiting_customer: '⏳ รอลูกค้า',
  won: '✅ won',
  lost: '❌ lost',
  archived: '🗄 archive',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'เพิ่งเข้า'
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function QuotesList({ initialQuotes }: { initialQuotes: Quote[] }) {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [lastCheckIds, setLastCheckIds] = useState<Set<string>>(
    new Set(initialQuotes.map((q) => q.id))
  )
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Init audio (simple beep)
  useEffect(() => {
    audioRef.current = new Audio(
      'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' +
        'Pv//8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
    )
  }, [])

  // Polling: refresh every 60s
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch(window.location.pathname + '?_t=' + Date.now(), {
          cache: 'no-store',
        })
        if (!res.ok) return
        const html = await res.text()
        // Use Next.js soft navigation instead — just reload
        window.location.reload()
      } catch (e) {
        // ignore
      }
    }

    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [])

  // Sound alert on new quote (compare with last seen IDs)
  useEffect(() => {
    const currentIds = new Set(quotes.map((q) => q.id))
    const newOnes = quotes.filter((q) => !lastCheckIds.has(q.id) && q.status === 'new')
    if (newOnes.length > 0 && soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {})
      // Browser title alert
      document.title = `🔔 (${newOnes.length} ใหม่) Quote Inbox`
      setTimeout(() => {
        document.title = 'Quote Inbox · ChutiBenz Internal'
      }, 10_000)
    }
    setLastCheckIds(currentIds)
  }, [quotes])

  // Filter + search
  const filtered = quotes.filter((q) => {
    if (filter !== 'all' && q.status !== filter) return false
    if (search) {
      const term = search.toLowerCase()
      const hay = [
        q.customer_name,
        q.customer_phone,
        q.customer_line,
        q.vehicle_model,
        q.part_description,
        q.ai_part_guess,
        q.matched_sku,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(term)) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white border border-gray-200 p-3 sticky top-[88px] z-[5]">
        <div className="flex flex-wrap gap-2 mb-3">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = filter === opt.value
            const count =
              opt.value === 'all'
                ? quotes.length
                : quotes.filter((q) => q.status === opt.value).length
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`text-xs px-3 py-1.5 border transition ${
                  isActive
                    ? 'bg-[#1C1D2C] text-[#C9A961] border-[#C9A961]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#C9A961]'
                }`}
              >
                {opt.label} <span className="opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="🔍 ค้นหา ชื่อ / เบอร์ / รุ่น / SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
          />
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`text-xs px-3 py-2 border transition ${
              soundEnabled
                ? 'bg-green-50 text-green-800 border-green-300'
                : 'bg-gray-100 text-gray-600 border-gray-300'
            }`}
            title="เปิด/ปิดเสียงแจ้งเตือน"
          >
            {soundEnabled ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด'}
          </button>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center text-gray-500">
          <div className="text-4xl mb-2">📭</div>
          <p>ยังไม่มี quote ในกลุ่มนี้</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <Link
              key={q.id}
              href={`/ops-x7k2m9/quotes/${q.id}`}
              className={`block bg-white border ${
                q.is_stale && q.status !== 'won' && q.status !== 'lost'
                  ? 'border-red-300 shadow-red-100'
                  : 'border-gray-200'
              } hover:border-[#C9A961] hover:shadow-md transition p-4`}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Photo thumbnail */}
                <div className="flex-shrink-0">
                  {q.photo_urls && q.photo_urls.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={q.photo_urls[0]}
                      alt="Quote photo"
                      className="w-20 h-20 object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                      📷
                    </div>
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 border ${
                        STATUS_BADGE[q.status] || 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      {STATUS_LABEL[q.status] || q.status}
                    </span>
                    {q.is_stale && q.status !== 'won' && q.status !== 'lost' && (
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-800 border border-red-300">
                        ⚠️ stale &gt;24ชม.
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{formatTime(q.created_at)}</span>
                  </div>

                  <div className="font-medium text-gray-900">
                    {q.customer_name || '(ไม่มีชื่อ)'} ·{' '}
                    <span className="text-[#C9A961]">{q.vehicle_model || '?'}</span>
                    {q.vehicle_year && (
                      <span className="text-gray-500"> ({q.vehicle_year})</span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 line-clamp-1 mt-0.5">
                    {q.ai_part_guess ? (
                      <>
                        🤖 <strong className="text-gray-800">{q.ai_part_guess}</strong>{' '}
                        {q.ai_confidence !== null && (
                          <span className="text-xs text-gray-500">({q.ai_confidence}%)</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">⏳ รอ AI วิเคราะห์...</span>
                    )}
                  </div>

                  {q.part_description && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                      💬 {q.part_description}
                    </div>
                  )}
                </div>

                {/* Right: Stock match + contact */}
                <div className="flex-shrink-0 text-right md:min-w-[180px]">
                  {q.matched_sku ? (
                    <div className="bg-green-50 border border-green-200 px-3 py-2">
                      <div className="text-xs text-green-800 font-medium">
                        📦 {q.matched_sku}
                      </div>
                      {q.matched_price && (
                        <div className="text-sm text-green-900 font-bold">
                          ฿{q.matched_price.toLocaleString()}
                        </div>
                      )}
                      {q.match_confidence && (
                        <div className="text-[10px] text-green-700">
                          match: {q.match_confidence}%
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">📦 ไม่มี SKU match</div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    📞 {q.customer_phone || '-'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
