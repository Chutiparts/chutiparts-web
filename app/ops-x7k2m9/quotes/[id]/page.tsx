// app/ops-x7k2m9/quotes/[id]/page.tsx — Quote Detail (Admin)
// Phase 1A · Day 3 — 2026-06-09

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import QuoteDetailActions from './QuoteDetailActions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Quote Detail · ChutiBenz Internal',
  robots: 'noindex, nofollow',
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function getQuote(id: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !quote) return null

  // History
  const { data: history } = await supabase
    .from('quote_status_history')
    .select('*')
    .eq('quote_id', id)
    .order('changed_at', { ascending: true })

  return { quote, history: history || [] }
}

export default async function QuoteDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const result = await getQuote(id)
  if (!result) return notFound()

  const { quote, history } = result

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1C1D2C] text-[#F2EDE0] sticky top-0 z-10 shadow-md">
        <div className="container mx-auto px-4 max-w-5xl py-3 flex items-center justify-between">
          <Link href="/ops-x7k2m9/quotes" className="text-xs text-[#C9A961] hover:text-white">
            ← กลับ Inbox
          </Link>
          <div className="text-xs text-[#8E8F9E]">
            ID: <span className="font-mono">{quote.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-5xl py-6 space-y-6">

        {/* Section 1: Photos */}
        <section className="bg-white border border-gray-200 p-5">
          <h2 className="font-serif text-lg text-gray-900 mb-3">📷 รูปอะไหล่</h2>
          {Array.isArray(quote.photo_urls) && quote.photo_urls.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {quote.photo_urls.map((url: string, i: number) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square bg-gray-100 border border-gray-200 hover:border-[#C9A961] overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-sm">ไม่มีรูปแนบ</div>
          )}
        </section>

        {/* Section 2: Customer */}
        <section className="bg-white border border-gray-200 p-5">
          <h2 className="font-serif text-lg text-gray-900 mb-3">👤 ลูกค้า</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 mb-1">ชื่อ</div>
              <div className="font-medium text-gray-900">{quote.customer_name || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">เบอร์โทร</div>
              <div className="font-medium text-gray-900">
                {quote.customer_phone ? (
                  <a href={`tel:${quote.customer_phone}`} className="text-[#C9A961] hover:underline">
                    📞 {quote.customer_phone}
                  </a>
                ) : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">LINE ID</div>
              <div className="font-medium text-gray-900">{quote.customer_line || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">รถ</div>
              <div className="font-medium text-gray-900">
                <span className="text-[#C9A961]">{quote.vehicle_model || '?'}</span>
                {quote.vehicle_year && <span className="text-gray-500"> · ปี {quote.vehicle_year}</span>}
              </div>
            </div>
          </div>
          {quote.part_description && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-1">รายละเอียดจากลูกค้า</div>
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{quote.part_description}</div>
            </div>
          )}
        </section>

        {/* Section 3: AI Analysis */}
        <section className="bg-white border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg text-gray-900">🤖 AI Vision วิเคราะห์</h2>
            <ReanalyzeButton quoteId={quote.id} hasAnalyzed={!!quote.ai_analyzed_at} />
          </div>

          {quote.ai_analyzed_at ? (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-3">
                <div className="bg-blue-50 border border-blue-200 px-3 py-2 flex-1 min-w-[200px]">
                  <div className="text-xs text-blue-700 mb-1">ระบุได้ว่าเป็น:</div>
                  <div className="font-medium text-blue-900">
                    {quote.ai_part_guess || '(ระบุไม่ได้)'}
                  </div>
                  {quote.ai_confidence !== null && (
                    <div className="text-xs text-blue-700 mt-1">
                      มั่นใจ {quote.ai_confidence}%
                    </div>
                  )}
                </div>
                {quote.ai_oem_guess && (
                  <div className="bg-blue-50 border border-blue-200 px-3 py-2 flex-1 min-w-[150px]">
                    <div className="text-xs text-blue-700 mb-1">OEM guess:</div>
                    <div className="font-mono font-medium text-blue-900">{quote.ai_oem_guess}</div>
                  </div>
                )}
              </div>

              {/* Stock match */}
              {quote.matched_sku ? (
                <div className="bg-green-50 border border-green-300 px-4 py-3">
                  <div className="text-xs text-green-700 mb-1">📦 Stock match:</div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono font-bold text-green-900">{quote.matched_sku}</span>
                    {quote.matched_price && (
                      <span className="text-lg font-bold text-green-900">
                        ฿{Number(quote.matched_price).toLocaleString()}
                      </span>
                    )}
                    {quote.match_confidence !== null && (
                      <span className="text-xs text-green-700">match {quote.match_confidence}%</span>
                    )}
                  </div>
                  <a
                    href={`/search?q=${quote.matched_sku}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-700 hover:underline mt-1 inline-block"
                  >
                    🔗 ดูรายการในเว็บ →
                  </a>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-300 px-4 py-3 text-sm text-yellow-900">
                  📦 ไม่พบ SKU ที่ตรงในสต็อก — ต้องตรวจสอบเพิ่มหรือสั่งหาให้
                </div>
              )}

              {quote.owner_note && (
                <div className="bg-gray-50 border border-gray-200 px-4 py-3">
                  <div className="text-xs text-gray-500 mb-1">โน้ตจาก AI:</div>
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans">
                    {quote.owner_note}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 py-6 text-center">
              ⏳ ยังไม่ได้วิเคราะห์ — กด &quot;Re-analyze&quot; เพื่อรัน AI Vision
            </div>
          )}
        </section>

        {/* Section 4: Actions */}
        <section className="bg-white border border-gray-200 p-5">
          <QuoteDetailActions
            quoteId={quote.id}
            currentStatus={quote.status}
            currentNote={quote.owner_note || ''}
            customerPhone={quote.customer_phone}
            customerLine={quote.customer_line}
          />
        </section>

        {/* Section 5: History */}
        <section className="bg-white border border-gray-200 p-5">
          <h2 className="font-serif text-lg text-gray-900 mb-3">📜 ประวัติสถานะ</h2>
          {history.length === 0 ? (
            <div className="text-sm text-gray-500">ไม่มี history</div>
          ) : (
            <div className="space-y-2">
              {history.map((h: any) => (
                <div key={h.id} className="text-xs text-gray-700 flex items-center gap-3 border-b border-gray-100 pb-2">
                  <span className="text-gray-400 font-mono w-32">
                    {new Date(h.changed_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span>
                    {h.from_status ? (
                      <>
                        <span className="text-gray-500">{h.from_status}</span>
                        {' → '}
                      </>
                    ) : ''}
                    <strong className="text-gray-900">{h.to_status}</strong>
                  </span>
                  {h.reason && <span className="text-gray-500">· {h.reason}</span>}
                  <span className="text-gray-400 ml-auto">by {h.changed_by}</span>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}

// ======================================================
// Helper: Re-analyze button (calls /api/quotes/[id]/analyze)
// ======================================================

function ReanalyzeButton({ quoteId, hasAnalyzed }: { quoteId: string; hasAnalyzed: boolean }) {
  // Use a simple form POST (server action style would work too)
  return (
    <form action={`/api/quotes/${quoteId}/analyze`} method="POST">
      <button
        type="submit"
        className="text-xs px-3 py-1.5 border border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961] hover:text-[#1C1D2C] transition"
      >
        {hasAnalyzed ? '🔄 Re-analyze' : '🤖 Analyze'}
      </button>
    </form>
  )
}
