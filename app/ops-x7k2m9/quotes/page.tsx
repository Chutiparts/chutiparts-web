// app/ops-x7k2m9/quotes/page.tsx — Admin Quote Inbox (Secret URL)
// Phase 1A · Day 3 — 2026-06-09
//
// Note: This is a SECRET URL (Mr.Chuti's choice B — no login).
// The path "ops-x7k2m9" is hard to guess (random suffix).
// Anyone with the URL has full read/update access.
// Add /robots noindex + Vercel headers protect against indexing.

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import QuotesList from './QuotesList'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Quote Inbox · ChutiBenz Internal',
  robots: 'noindex, nofollow',
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function getQuotes() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { quotes: [], summary: null }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Fetch from view (includes age_hours + is_stale)
  const { data: quotes, error } = await supabase
    .from('quotes_inbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[admin/quotes] fetch error:', error)
    return { quotes: [], summary: null }
  }

  // Compute summary
  const summary = {
    total: quotes?.length || 0,
    new: quotes?.filter((q: any) => q.status === 'new').length || 0,
    reviewing: quotes?.filter((q: any) => q.status === 'reviewing').length || 0,
    quoted: quotes?.filter((q: any) => q.status === 'quoted').length || 0,
    won: quotes?.filter((q: any) => q.status === 'won').length || 0,
    stale: quotes?.filter((q: any) => q.is_stale).length || 0,
  }

  return { quotes: quotes || [], summary }
}

export default async function QuoteInboxPage() {
  const { quotes, summary } = await getQuotes()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-[#1C1D2C] text-[#F2EDE0] sticky top-0 z-10 shadow-md">
        <div className="container mx-auto px-4 max-w-7xl py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[#C9A961] font-serif text-lg">📋 Quote Inbox</span>
            <span className="text-xs text-[#8E8F9E]">ChutiBenz Internal · Secret URL</span>
          </div>
          <Link href="/" className="text-xs text-[#C9A961] hover:text-white">
            ← chutibenz.com
          </Link>
        </div>

        {/* Summary chips */}
        {summary && (
          <div className="border-t border-[#2E303F]">
            <div className="container mx-auto px-4 max-w-7xl py-3 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1.5 bg-white/[0.05] border border-[#C9A961]/30 text-[#F2EDE0]">
                ทั้งหมด: <strong className="text-[#C9A961]">{summary.total}</strong>
              </span>
              <span className="px-3 py-1.5 bg-blue-500/15 border border-blue-400/40 text-blue-200">
                🆕 ใหม่: <strong>{summary.new}</strong>
              </span>
              <span className="px-3 py-1.5 bg-yellow-500/15 border border-yellow-400/40 text-yellow-200">
                👀 กำลังดู: <strong>{summary.reviewing}</strong>
              </span>
              <span className="px-3 py-1.5 bg-purple-500/15 border border-purple-400/40 text-purple-200">
                💬 quoted: <strong>{summary.quoted}</strong>
              </span>
              <span className="px-3 py-1.5 bg-green-500/15 border border-green-400/40 text-green-200">
                ✅ won: <strong>{summary.won}</strong>
              </span>
              {summary.stale > 0 && (
                <span className="px-3 py-1.5 bg-red-500/20 border border-red-400/40 text-red-200 animate-pulse">
                  ⚠️ stale &gt;24ชม.: <strong>{summary.stale}</strong>
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* List (client component for filter + sound) */}
      <main className="container mx-auto px-4 max-w-7xl py-6">
        <QuotesList initialQuotes={quotes} />
      </main>

      {/* Footer note */}
      <footer className="container mx-auto px-4 max-w-7xl py-6 text-xs text-gray-500 text-center border-t border-gray-200 mt-10">
        Auto-refresh ทุก 60 วินาที · 🔊 เสียงแจ้งเตือนเมื่อพบ quote ใหม่
      </footer>
    </div>
  )
}
