// app/admin/vin-tool/page.tsx — VIN Phase 7
// 2026-06-01 — Replaces standalone vin-datacard-tool.html
// Embed Datacard Fetcher directly in admin web. No file:// HTML needed.
//
// Path:  https://chutibenz.com/admin/vin-tool
// Auth:  Same admin gate as /admin/vin-check (relies on existing middleware)
//
// Usage flow:
//   1. Mr.Chuti goes to /admin/vin-check (queue) → copies request_id
//   2. Goes to /admin/vin-tool → pastes request_id + LastVIN URL
//   3. Clicks "Fetch with LastVIN" → ~30s → result with Copy/Download buttons
//
// Migration: After this is deployed, vin-datacard-tool.html can be retired.

'use client'

import { useState, useEffect } from 'react'

const API = '/api/admin/generate-vin-draft'
const LS_KEY = 'chutibenz_vin_tool_v7'

type DraftResult = {
  success: boolean
  draft: string
  sources?: string[]
  cache_hit?: boolean
  option_count?: number
  confidence?: string
  model?: string
  error?: string
}

export default function VinToolPage() {
  const [requestId, setRequestId] = useState('')
  const [lastvinUrl, setLastvinUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null)
  const [result, setResult] = useState<DraftResult | null>(null)
  const [copyHint, setCopyHint] = useState<string | null>(null)

  // Restore form values
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(LS_KEY) || '{}')
      if (saved.requestId) setRequestId(saved.requestId)
      if (saved.lastvinUrl) setLastvinUrl(saved.lastvinUrl)
    } catch {}
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      sessionStorage.setItem(LS_KEY, JSON.stringify({ requestId, lastvinUrl }))
    } catch {}
  }, [requestId, lastvinUrl])

  // Elapsed timer
  useEffect(() => {
    if (!loading) return
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 100) / 10), 100)
    return () => clearInterval(id)
  }, [loading])

  async function fetchDatacard(withUrl: boolean) {
    const rid = requestId.trim()
    if (!rid) {
      setStatus({ type: 'error', msg: '⚠ ใส่ Request ID ก่อน' })
      return
    }

    const body: Record<string, string> = { request_id: rid }
    if (withUrl && lastvinUrl.trim()) body.lastvin_url = lastvinUrl.trim()

    const mode = withUrl && lastvinUrl.trim() ? 'Phase 5 (Apify + LastVIN)' : 'Phase 1 (NHTSA / Cache)'
    setLoading(true)
    setElapsed(0)
    setResult(null)
    setStatus({ type: 'info', msg: `กำลังเรียก ${mode}... (อาจใช้เวลา 5–60 วินาที)` })

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: DraftResult = await res.json()

      if (!res.ok || !data.success) {
        setStatus({ type: 'error', msg: `❌ Error (HTTP ${res.status}): ${data.error || 'unknown'}` })
        setLoading(false)
        return
      }

      setResult(data)
      setStatus({ type: 'success', msg: data.cache_hit ? '⚡ Cache hit' : '🌐 Fresh fetch' })
    } catch (err: any) {
      setStatus({ type: 'error', msg: `❌ Network error: ${err.message || err}` })
    } finally {
      setLoading(false)
    }
  }

  function clearForm() {
    setRequestId('')
    setLastvinUrl('')
    setResult(null)
    setStatus(null)
    try { sessionStorage.removeItem(LS_KEY) } catch {}
  }

  async function copyDraft() {
    if (!result?.draft) return
    try {
      await navigator.clipboard.writeText(result.draft)
      setCopyHint('✅ Copied!')
      setTimeout(() => setCopyHint(null), 1500)
    } catch (e: any) {
      setCopyHint('❌ ' + (e.message || 'copy failed'))
      setTimeout(() => setCopyHint(null), 1500)
    }
  }

  function downloadDraft() {
    if (!result?.draft) return
    const vin = result.draft.match(/WDB[A-Z0-9]+/)?.[0] || 'vin'
    const blob = new Blob([result.draft], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chutibenz-vin-${vin}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <header className="bg-slate-800/80 backdrop-blur p-5 rounded-xl mb-5 border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">🚗 VIN Datacard Fetcher</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Multi-source decoder · NHTSA + Apify + Cache · V4.4 · Phase 7
              </p>
            </div>
            
              href="/admin/vin-check"
              className="text-xs sm:text-sm bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-center transition"
            >← กลับไปคิว VIN</a>
          </div>
        </header>

        {/* Form */}
        <div className="bg-slate-800 p-5 sm:p-6 rounded-xl mb-5 border border-slate-700">
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5 text-blue-300">
              Request ID
              <span className="ml-2 text-[11px] text-slate-400 font-normal">
                (UUID จาก /admin/vin-check)
              </span>
            </label>
            <input
              type="text"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="45ae0e43-00a5-467f-b79a-fb13f4b5f1b1"
              className="w-full px-3 py-2.5 text-sm font-mono bg-slate-900 border border-slate-600 rounded-md focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5 text-blue-300">
              LastVIN URL / Encoded ID
              <span className="ml-2 text-[11px] text-slate-400 font-normal">
                (optional — ใส่เมื่อต้อง datacard ครบ)
              </span>
            </label>
            <input
              type="text"
              value={lastvinUrl}
              onChange={(e) => setLastvinUrl(e.target.value)}
              placeholder="1735zAJeDPPO2myMQ   หรือ   https://www.lastvin.com/vin/1735zAJeDPPO2myMQ"
              className="w-full px-3 py-2.5 text-sm font-mono bg-slate-900 border border-slate-600 rounded-md focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchDatacard(true)}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-md transition"
            >
              🚀 Fetch with LastVIN (Phase 5)
            </button>
            <button
              onClick={() => fetchDatacard(false)}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-semibold bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition"
            >
              ⚡ Cache Only / Phase 1
            </button>
            <button
              onClick={clearForm}
              disabled={loading}
              className="px-3 py-2.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-md transition ml-auto"
            >
              🗑 Clear
            </button>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div
            className={[
              'p-4 rounded-lg mb-4 text-sm font-medium',
              status.type === 'info' && 'bg-blue-900/40 text-blue-200 border border-blue-700',
              status.type === 'success' && 'bg-green-900/40 text-green-200 border border-green-700',
              status.type === 'error' && 'bg-red-900/40 text-red-200 border border-red-700',
            ].filter(Boolean).join(' ')}
          >
            {loading && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin align-middle mr-2"></span>
            )}
            {status.msg}
            {loading && <span className="ml-2 text-xs opacity-70">⏱ {elapsed.toFixed(1)}s</span>}

            {/* Result meta on success */}
            {!loading && result && status.type === 'success' && (
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                {result.sources && result.sources.length > 0 && (
                  <span className="bg-white/10 px-2.5 py-1 rounded">Sources: {result.sources.join(', ')}</span>
                )}
                {typeof result.option_count === 'number' && (
                  <span className="bg-white/10 px-2.5 py-1 rounded">Options: {result.option_count}</span>
                )}
                {result.confidence && (
                  <span className="bg-white/10 px-2.5 py-1 rounded">Confidence: {result.confidence}</span>
                )}
                {result.model && (
                  <span className="bg-white/10 px-2.5 py-1 rounded">Model: {result.model}</span>
                )}
                <span className="bg-white/10 px-2.5 py-1 rounded">⏱ {elapsed.toFixed(1)}s</span>
              </div>
            )}
          </div>
        )}

        {/* Draft output */}
        {result?.draft && (
          <div className="bg-slate-800 p-5 sm:p-6 rounded-xl border border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <label className="text-xs font-semibold text-blue-300">📋 AI Draft Output</label>
              <div className="flex gap-2 items-center flex-wrap">
                {copyHint && <span className="text-xs text-slate-300">{copyHint}</span>}
                <button
                  onClick={copyDraft}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 rounded-md transition"
                >📋 Copy</button>
                <button
                  onClick={downloadDraft}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-600 hover:bg-slate-500 rounded-md transition"
                >⬇ Download .md</button>
              </div>
            </div>
            <pre className="bg-slate-900 p-4 rounded-md font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-slate-200 max-h-[600px] overflow-y-auto border border-slate-700">
{result.draft}
            </pre>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-[11px] text-slate-500 mt-6">
          ChutiBenz Mercedes Parts · LINE @mr.chuti5988 · chutibenz.com · Phase 7 admin tool
        </footer>
      </div>
    </div>
  )
}
