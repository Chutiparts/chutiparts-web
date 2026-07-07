'use client'
import { useState } from 'react'

type Status = 'PASS' | 'WARN' | 'FAIL'
type Check = { key: string; label: string; status: Status; detail: string; ms: number }
type RunResult = {
  error?: 'unauthorized'
  ranAt?: string
  site?: string
  overall?: Status
  summary?: { pass: number; warn: number; fail: number }
  results?: Check[]
}

const GREEN = '#17301F'
const BRASS = '#B08D57'
const COLOR: Record<Status, { bg: string; fg: string; label: string }> = {
  PASS: { bg: '#E6F4EA', fg: '#1B7F3B', label: '✅ PASS' },
  WARN: { bg: '#FFF6E0', fg: '#9A6A00', label: '⚠️ WARN' },
  FAIL: { bg: '#FDE7E7', fg: '#B3261E', label: '❌ FAIL' },
}

export default function WebCheckerClient({ runChecks, site }: { runChecks: () => Promise<RunResult>; site: string }) {
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<RunResult | null>(null)
  const [err, setErr] = useState('')

  async function run() {
    setLoading(true); setErr('')
    try {
      const r = await runChecks()
      if (r.error) { setErr('หมดสิทธิ์ — กรุณา login ใหม่'); setRes(null) }
      else setRes(r)
    } catch (e) {
      setErr((e as Error)?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  function download(filename: string, text: string, type: string) {
    const blob = new Blob([text], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }
  function exportTxt() {
    if (!res?.results) return
    const lines: string[] = []
    lines.push('ChutiBenz Web Checker — ผลตรวจ')
    lines.push(`เว็บ: ${res.site}`)
    lines.push(`เวลา: ${res.ranAt}`)
    lines.push(`ภาพรวม: ${res.overall}  (PASS ${res.summary?.pass} · WARN ${res.summary?.warn} · FAIL ${res.summary?.fail})`)
    lines.push('─'.repeat(48))
    for (const c of res.results) lines.push(`[${c.status}] ${c.label}\n    ${c.detail}  (${c.ms}ms)`)
    download(`web-checker-${stamp()}.txt`, '﻿' + lines.join('\n'), 'text/plain;charset=utf-8')
  }
  function exportJson() {
    if (!res) return
    download(`web-checker-${stamp()}.json`, JSON.stringify(res, null, 2), 'application/json')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE4', padding: '28px 18px', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: GREEN, fontSize: 22, fontWeight: 800 }}>🔍 ChutiBenz Web Checker</h1>
            <div style={{ color: '#6b6a63', fontSize: 13, marginTop: 2 }}>ตรวจสถานะเว็บ/ฟีเจอร์แบบ read-only · {site}</div>
          </div>
          <button onClick={run} disabled={loading}
            style={{ background: loading ? '#9aa79d' : GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? 'กำลังตรวจ…' : '▶ Run Check'}
          </button>
        </div>

        {err && <div style={{ marginTop: 16, background: '#FDE7E7', color: '#B3261E', padding: '10px 14px', borderRadius: 10, fontSize: 14 }}>{err}</div>}

        {res?.results && (
          <>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <Chip big label={`ภาพรวม: ${res.overall}`} status={res.overall!} />
              <Chip label={`PASS ${res.summary?.pass}`} status="PASS" />
              <Chip label={`WARN ${res.summary?.warn}`} status="WARN" />
              <Chip label={`FAIL ${res.summary?.fail}`} status="FAIL" />
              <span style={{ marginLeft: 'auto', color: '#8a897f', fontSize: 12, alignSelf: 'center' }}>{fmt(res.ranAt)}</span>
            </div>

            <div style={{ marginTop: 14, background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #E7E0D0' }}>
              {res.results.map((c, i) => (
                <div key={c.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderTop: i ? '1px solid #F0EBDD' : 'none' }}>
                  <span style={{ background: COLOR[c.status].bg, color: COLOR[c.status].fg, fontWeight: 700, fontSize: 12, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{COLOR[c.status].label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#1e1e1a', fontSize: 14 }}>{c.label}</div>
                    <div style={{ color: '#6b6a63', fontSize: 13, marginTop: 2, wordBreak: 'break-word' }}>{c.detail}</div>
                  </div>
                  <span style={{ color: '#b3b0a4', fontSize: 12, whiteSpace: 'nowrap' }}>{c.ms}ms</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={exportTxt} style={btn}>⬇ Export TXT</button>
              <button onClick={exportJson} style={btn}>⬇ Export JSON</button>
            </div>
          </>
        )}

        {!res && !err && (
          <div style={{ marginTop: 24, color: '#8a897f', fontSize: 14, background: '#fff', border: '1px dashed #D8CFB8', borderRadius: 12, padding: 20 }}>
            กด <b>Run Check</b> เพื่อตรวจสถานะเว็บ · เป็น read-only ทั้งหมด (มีเฉพาะ test lead แบบ dry-run ที่ insert แล้วลบทันที) · ไม่ส่งข้อความหาลูกค้า ไม่แตะระบบขายจริง
          </div>
        )}
      </div>
    </div>
  )
}

const btn: React.CSSProperties = { background: '#fff', color: GREEN, border: `1px solid ${BRASS}`, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }

function Chip({ label, status, big }: { label: string; status: Status; big?: boolean }) {
  const c = COLOR[status]
  return <span style={{ background: c.bg, color: c.fg, fontWeight: big ? 800 : 700, fontSize: big ? 15 : 13, padding: big ? '8px 14px' : '6px 12px', borderRadius: 999 }}>{label}</span>
}
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) }
function fmt(iso?: string) { if (!iso) return ''; try { return new Date(iso).toLocaleString('th-TH') } catch { return iso } }
