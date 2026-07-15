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

type Health = { productsPub: number; complete: number; noImg: number; noPrice: number; healthPct: number; leadsNoOwner: number; overdueLeads: number; overdueTasks: number }

export default function WebCheckerClient({ runChecks, site, health }: { runChecks: () => Promise<RunResult>; site: string; health?: Health }) {
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
            <h1 style={{ margin: 0, color: GREEN, fontSize: 22, fontWeight: 800 }}>🩺 System Monitor</h1>
            <div style={{ color: '#6b6a63', fontSize: 13, marginTop: 2 }}>สุขภาพข้อมูล + ตรวจเว็บ (read-only) · เปิดหน้าเดียวรู้ระบบปกติไหม · {site}</div>
          </div>
          <button onClick={run} disabled={loading}
            style={{ background: loading ? '#9aa79d' : GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? 'กำลังตรวจ…' : '▶ Run Check'}
          </button>
        </div>

        {/* Level B #5: Data Health at-a-glance */}
        {health && (
          <div style={{ marginTop: 18, background: '#fff', border: '1px solid #E7E0D0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: health.healthPct >= 80 ? '#1B7F3B' : health.healthPct >= 50 ? '#9A6A00' : '#B3261E' }}>{health.healthPct}%</div>
              <div>
                <div style={{ fontWeight: 700, color: GREEN, fontSize: 15 }}>คะแนนสุขภาพข้อมูลสินค้า</div>
                <div style={{ fontSize: 12.5, color: '#6b6a63', marginTop: 2 }}>สินค้าเผยแพร่ {health.productsPub} ชิ้น · ข้อมูลครบ {health.complete} ชิ้น</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <MiniStat n={health.noImg} label="ไม่มีรูป" />
              <MiniStat n={health.noPrice} label="ไม่มีราคา" />
              <MiniStat n={health.leadsNoOwner} label="lead ไม่มีเจ้าของ" />
              <MiniStat n={health.overdueLeads} label="lead เกินกำหนด" />
              <MiniStat n={health.overdueTasks} label="งานเกินกำหนด" />
            </div>
            {(health.noImg || health.leadsNoOwner || health.overdueLeads || health.overdueTasks) ? (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {health.noImg > 0 && <div style={alertLine}>🖼️ {health.noImg} ชิ้นไม่มีรูป — ขายบนเว็บยาก (คิวถ่ายรูป)</div>}
                {health.leadsNoOwner > 0 && <div style={alertLine}>👤 {health.leadsNoOwner} lead ยังไม่มีเจ้าของ — มอบหมายที่ Parts Desk</div>}
                {(health.overdueLeads > 0 || health.overdueTasks > 0) && <div style={alertLine}>🔴 เกินกำหนด: lead {health.overdueLeads} · งาน {health.overdueTasks} — ดู Daily Brief</div>}
              </div>
            ) : <div style={{ marginTop: 12, color: '#1B7F3B', fontSize: 13, fontWeight: 600 }}>✅ ข้อมูลสุขภาพดี ไม่มีสัญญาณเตือน</div>}
          </div>
        )}

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
const alertLine: React.CSSProperties = { background: '#FFF6E0', color: '#7a5b00', fontSize: 12.5, padding: '7px 11px', borderRadius: 8 }

function MiniStat({ n, label }: { n: number; label: string }) {
  const warn = n > 0
  return (
    <div style={{ flex: 1, minWidth: 82, textAlign: 'center', background: warn ? '#FFF6E0' : '#F1F6F2', border: `1px solid ${warn ? '#EAD9A6' : '#DCE7DE'}`, borderRadius: 10, padding: '8px 6px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: warn ? '#9A6A00' : '#1B7F3B' }}>{n}</div>
      <div style={{ fontSize: 11, color: '#6b6a63' }}>{label}</div>
    </div>
  )
}

function Chip({ label, status, big }: { label: string; status: Status; big?: boolean }) {
  const c = COLOR[status]
  return <span style={{ background: c.bg, color: c.fg, fontWeight: big ? 800 : 700, fontSize: big ? 15 : 13, padding: big ? '8px 14px' : '6px 12px', borderRadius: 999 }}>{label}</span>
}
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) }
function fmt(iso?: string) { if (!iso) return ''; try { return new Date(iso).toLocaleString('th-TH') } catch { return iso } }
