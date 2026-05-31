// app/admin/vin-check/page.tsx — Admin dashboard สำหรับ Mr.Chuti
// Phase 1 — 2026-05-31
// Access: bookmark URL https://chutibenz.com/admin/vin-check (unlisted)

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type VinRequest = {
  id: string
  name: string
  contact: string
  vin: string
  car_model: string | null
  car_year: number | null
  questions: string | null
  status: string
  ai_draft: string | null
  ai_generated_at: string | null
  ai_model: string | null
  notes: string | null
  response_sent_at: string | null
  created_at: string
}

export default function AdminVinCheckPage() {
  const [requests, setRequests] = useState<VinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('pending')

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    if (selectedId) {
      const sel = requests.find(r => r.id === selectedId)
      setEditDraft(sel?.ai_draft || '')
    }
  }, [selectedId, requests])

  async function fetchRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('vin_check_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  async function generateDraft(id: string) {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/generate-vin-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id }),
      })
      const data = await res.json()
      if (data.draft) {
        setEditDraft(data.draft)
        await fetchRequests()
      } else {
        alert('Error: ' + (data.error || 'Unknown'))
      }
    } catch (e) {
      alert('Error generating draft')
    }
    setGenerating(false)
  }

  async function saveDraftEdit(id: string) {
    await supabase
      .from('vin_check_requests')
      .update({ ai_draft: editDraft })
      .eq('id', id)
    await fetchRequests()
    alert('Saved!')
  }

  async function markCompleted(id: string) {
    await supabase
      .from('vin_check_requests')
      .update({
        status: 'completed',
        response_sent_at: new Date().toISOString(),
      })
      .eq('id', id)
    await fetchRequests()
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      alert('✅ Copied! Paste into LINE')
    } catch {
      alert('Copy failed — select text manually')
    }
  }

  const selected = requests.find(r => r.id === selectedId)
  const filteredRequests = requests.filter((r) => {
    if (filter === 'all') return true
    return r.status === filter
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="font-serif text-3xl font-medium text-gray-900">
            🔍 VIN Check Admin
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {pendingCount > 0 ? `⚠️ ${pendingCount} pending` : '✅ All caught up'}
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
        >
          🔄 Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* === LEFT: Request list === */}
        <div className="md:col-span-1">
          <div className="flex gap-1 mb-3 flex-wrap">
            {(['pending', 'in_progress', 'completed', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded ${
                  filter === f
                    ? 'bg-[#1C1D2C] text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto">
            {filteredRequests.length === 0 && (
              <p className="text-sm text-gray-500 p-4 text-center">No requests</p>
            )}
            {filteredRequests.map((req) => {
              const date = new Date(req.created_at).toLocaleDateString('th-TH', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <button
                  key={req.id}
                  onClick={() => setSelectedId(req.id)}
                  className={`w-full text-left p-3 border rounded transition ${
                    selectedId === req.id
                      ? 'bg-[#C9A961] text-[#1C1D2C] border-[#C9A961]'
                      : 'bg-white border-gray-200 hover:border-[#C9A961]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-medium">{req.name}</div>
                    <div className="text-xs opacity-70">{date}</div>
                  </div>
                  <div className="text-xs opacity-70 mt-1">
                    {req.car_model || '?'} · {req.car_year || '?'}
                  </div>
                  <div className="text-xs font-mono opacity-50 mt-1 truncate">
                    {req.vin}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {req.status === 'pending' && (
                      <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                        pending
                      </span>
                    )}
                    {req.status === 'in_progress' && (
                      <span className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded">
                        in progress
                      </span>
                    )}
                    {req.status === 'completed' && (
                      <span className="text-xs bg-green-200 text-green-900 px-2 py-0.5 rounded">
                        ✓ done
                      </span>
                    )}
                    {req.ai_draft && (
                      <span className="text-xs bg-purple-200 text-purple-900 px-2 py-0.5 rounded">
                        🤖
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* === RIGHT: Detail + Draft === */}
        <div className="md:col-span-2">
          {!selected ? (
            <div className="bg-gray-50 rounded p-12 text-center text-gray-500">
              ← เลือก request ทางซ้ายเพื่อดูรายละเอียด
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded p-6 space-y-4">

              {/* Customer info */}
              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-4 rounded">
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">Name</div>
                  <div className="font-medium">{selected.name}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">Contact</div>
                  <div className="font-medium">{selected.contact}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">VIN</div>
                  <div className="font-mono text-sm">{selected.vin}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">Model / Year</div>
                  <div className="font-medium">
                    {selected.car_model || '-'} / {selected.car_year || '-'}
                  </div>
                </div>
              </div>

              {selected.questions && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">
                  <div className="text-amber-900 text-xs uppercase tracking-wider mb-1">คำถามจากลูกค้า</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{selected.questions}</div>
                </div>
              )}

              {/* AI Draft */}
              <div>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <h3 className="font-medium flex items-center gap-2">
                    🤖 AI Draft Response
                    {selected.ai_generated_at && (
                      <span className="text-xs text-gray-500 font-normal">
                        (generated {new Date(selected.ai_generated_at).toLocaleString('th-TH')})
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => generateDraft(selected.id)}
                    disabled={generating}
                    className="text-sm bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-4 py-2 rounded disabled:opacity-50"
                  >
                    {generating
                      ? '⏳ Generating...'
                      : selected.ai_draft
                      ? '🔄 Regenerate'
                      : '✨ Generate Draft'}
                  </button>
                </div>

                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={18}
                  placeholder="คลิก 'Generate Draft' เพื่อให้ AI เขียน response ให้..."
                  className="w-full p-3 border border-gray-300 rounded font-sans text-sm leading-relaxed focus:outline-none focus:border-[#C9A961]"
                />

                <div className="mt-2 text-xs text-gray-500">
                  💡 แก้ไขข้อความได้ก่อน copy
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-200">
                <button
                  onClick={() => saveDraftEdit(selected.id)}
                  disabled={!editDraft}
                  className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded disabled:opacity-50"
                >
                  💾 Save Edit
                </button>

                <button
                  onClick={() => copyToClipboard(editDraft)}
                  disabled={!editDraft}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded disabled:opacity-50"
                >
                  📋 Copy
                </button>

                
                  href="https://line.me/R/oaMessage/%40440ifncj/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded inline-block"
                >
                  💬 Open LINE
                </a>

                <button
                  onClick={() => markCompleted(selected.id)}
                  disabled={selected.status === 'completed'}
                  className="bg-[#1C1D2C] hover:bg-[#3A3B4D] text-white text-sm font-medium px-4 py-2 rounded ml-auto disabled:opacity-50"
                >
                  ✓ Mark Completed
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
