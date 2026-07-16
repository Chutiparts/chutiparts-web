'use client'
// app/ops-x7k2m9/stock-source/demand/SearchDemandClient.tsx — Search Demand (P0b)
// อ่าน search_queries (P0a log) อย่างเดียว → ลูกค้าค้นอะไรบ่อย + ค้นอะไรแล้วไม่เจอ
// เอาไปตัดสินใจ: หาของมาสต็อก · ถ่ายรูปชิ้นไหนก่อน · ทำคอนเทนต์ตามที่คนสนใจ
// ไม่เขียน DB · ไม่มี SQL ใหม่ · เกณฑ์ช่วงเวลา จำ localStorage · export CSV/TXT/JSON (BOM)
import { useMemo, useState, useEffect } from 'react'

type Row = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

// ===== pure logic (เทสได้) =====
export const norm = (s: any) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
export function daysAgo(d?: string | null, now?: Date) {
  if (!d) return 999999
  const x = new Date(d); if (isNaN(x.getTime())) return 999999
  return Math.max(0, Math.floor(((now || new Date()).getTime() - x.getTime()) / 86400000))
}
function fmtDate(d?: string | null) {
  if (!d) return '-'; const x = new Date(d); if (isNaN(x.getTime())) return '-'
  return `${x.getDate()}/${x.getMonth() + 1}/${(x.getFullYear() + 543) % 100}`
}

export type QGroup = {
  query: string; count: number; notFound: number; found: number
  models: string[]; lastAt: string | null; avgResult: number
}

// จัดกลุ่มคำค้น (normalize) → นับครั้ง/ไม่เจอ/รุ่น/ค้นล่าสุด
export function groupQueries(rows: Row[]): QGroup[] {
  const g: Record<string, any> = {}
  for (const r of rows) {
    const q = norm(r.query_text)
    if (!q) continue
    if (!g[q]) g[q] = { query: r.query_text || q, count: 0, notFound: 0, found: 0, models: new Set<string>(), lastAt: null, resSum: 0 }
    const e = g[q]
    e.count++
    const had = r.had_results === true || r.had_results === 'true'
    if (had) e.found++; else e.notFound++
    e.resSum += Number(r.result_count) || 0
    if (r.model) e.models.add(String(r.model))
    const t = r.created_at || null
    if (t && (!e.lastAt || new Date(t).getTime() > new Date(e.lastAt).getTime())) e.lastAt = t
    // ใช้ original ล่าสุดเป็น display
    if (r.query_text) e.query = r.query_text
  }
  return Object.values(g).map((e: any) => ({
    query: e.query, count: e.count, notFound: e.notFound, found: e.found,
    models: [...e.models], lastAt: e.lastAt, avgResult: e.count ? Math.round((e.resSum / e.count) * 10) / 10 : 0,
  }))
}

export function byModel(rows: Row[]) {
  const g: Record<string, { model: string; count: number; notFound: number }> = {}
  for (const r of rows) {
    const m = r.model ? String(r.model) : '(ไม่ระบุรุ่น)'
    if (!g[m]) g[m] = { model: m, count: 0, notFound: 0 }
    g[m].count++
    const had = r.had_results === true || r.had_results === 'true'
    if (!had) g[m].notFound++
  }
  return Object.values(g).sort((a, b) => b.count - a.count)
}

const WINDOWS = [
  { v: 7, label: '7 วัน' }, { v: 30, label: '30 วัน' }, { v: 90, label: '90 วัน' }, { v: 0, label: 'ทั้งหมด' },
]

export default function SearchDemandClient({ rows }: { rows: Row[] }) {
  const [win, setWin] = useState<number>(30)
  const [tab, setTab] = useState<'notfound' | 'top' | 'model'>('notfound')

  useEffect(() => {
    try { const s = window.localStorage.getItem('cb_demand_win'); if (s !== null) setWin(Number(s)) } catch {}
  }, [])
  const setWindow = (v: number) => { setWin(v); try { window.localStorage.setItem('cb_demand_win', String(v)) } catch {} }

  const now = new Date()
  const filtered = useMemo(
    () => (win ? rows.filter((r) => daysAgo(r.created_at, now) <= win) : rows),
    [rows, win]
  )
  const groups = useMemo(() => groupQueries(filtered), [filtered])
  const topGroups = useMemo(() => [...groups].sort((a, b) => b.count - a.count), [groups])
  const notFoundGroups = useMemo(
    () => groups.filter((g) => g.notFound > 0).sort((a, b) => b.notFound - a.notFound),
    [groups]
  )
  const models = useMemo(() => byModel(filtered), [filtered])

  const totalSearches = filtered.length
  const uniqueQueries = groups.length
  const notFoundSearches = filtered.filter((r) => !(r.had_results === true || r.had_results === 'true')).length
  const notFoundUnique = notFoundGroups.length

  // ===== export / copy =====
  const dl = (name: string, content: string, type: string) => {
    const b = new Blob([content], { type }); const u = URL.createObjectURL(b)
    const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u)
  }
  const todayStr = () => new Date().toISOString().slice(0, 10)
  const wantList = () =>
    `🔎 คำค้นที่ลูกค้าหาแต่ "ไม่เจอ" (ช่วง ${win || 'ทั้งหมด'}${win ? ' วัน' : ''}) — ควรพิจารณาหามาขาย / ถ่ายรูป / ทำคอนเทนต์\n` +
    notFoundGroups.map((g, i) => `${i + 1}. "${g.query}" — ไม่เจอ ${g.notFound} ครั้ง${g.models.length ? ` · รุ่น: ${g.models.join(', ')}` : ''} · ล่าสุด ${fmtDate(g.lastAt)}`).join('\n')
  const copy = (t: string, msg: string) => { navigator.clipboard?.writeText(t).then(() => alert(msg), () => alert('คัดลอกไม่สำเร็จ')) }
  const exportCsv = () => {
    const head = 'query,count,found,not_found,avg_result,models,last_searched\n'
    const body = topGroups.map((g) => `"${(g.query || '').replace(/"/g, '""')}",${g.count},${g.found},${g.notFound},${g.avgResult},"${g.models.join('|')}",${g.lastAt || ''}`).join('\n')
    dl(`search-demand-${todayStr()}.csv`, '﻿' + head + body, 'text/csv;charset=utf-8')
  }
  const exportTxt = () => dl(`search-demand-${todayStr()}.txt`, '﻿' + wantList(), 'text/plain;charset=utf-8')
  const exportJson = () => dl(`search-demand-${todayStr()}.json`, JSON.stringify({ window: win, generatedAt: new Date().toISOString(), top: topGroups, notFound: notFoundGroups, byModel: models }, null, 2), 'application/json')

  // ===== styles =====
  const card: any = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 12, padding: 12, marginBottom: 10 }
  const qbtn: any = { padding: '7px 12px', borderRadius: 9, border: '1px solid #ddd', background: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#333' }
  const stat = (label: string, val: string, color: string) => (
    <div style={{ flex: 1, minWidth: 110, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div><div style={{ fontSize: 10.5, color: '#777' }}>{label}</div></div>
  )
  const tbtn = (id: typeof tab, label: string) => (
    <button onClick={() => setTab(id)} style={{ ...qbtn, background: tab === id ? GREEN : '#fff', color: tab === id ? '#fff' : '#333', borderColor: tab === id ? GREEN : '#ddd' }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      {/* header */}
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>🔎 Search Demand · คำค้นลูกค้า</div>
            <div style={{ fontSize: 12, color: '#cbd8cf' }}>ลูกค้าค้นอะไรบ่อย + ค้นอะไรแล้ว "ไม่เจอ" (ดีมานด์ที่หลุด) → เอาไปตัดสินใจ สต็อก / ถ่ายรูป / คอนเทนต์ · อ่านจาก /search</div>
            <div style={{ fontSize: 11.5, color: '#a9bfb1', marginTop: 4 }}>เมนูย่อยใต้ Stock Source · อ่านล้วน ไม่แก้ข้อมูล</div>
          </div>
          <a href="/ops-x7k2m9/stock-source" style={{ ...qbtn, textDecoration: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>← กลับ Stock Source</a>
        </div>
      </div>

      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {/* ช่วงเวลา */}
        <div style={{ ...card, background: '#fbfaf6' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: '#555' }}>
            <span style={{ fontWeight: 700, color: GREEN }}>ช่วงเวลา:</span>
            {WINDOWS.map((w) => (
              <button key={w.v} onClick={() => setWindow(w.v)}
                style={{ ...qbtn, padding: '5px 12px', background: win === w.v ? BRASS : '#fff', color: win === w.v ? '#fff' : '#333', borderColor: win === w.v ? BRASS : '#ddd' }}>{w.label}</button>
            ))}
          </div>
        </div>

        {/* dashboard */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {stat('ค้นทั้งหมด', String(totalSearches), GREEN)}
          {stat('คำค้นไม่ซ้ำ', String(uniqueQueries), GREEN)}
          {stat('ค้นแล้วไม่เจอ', String(notFoundSearches), '#A32D2D')}
          {stat('คำที่ไม่เจอ (ไม่ซ้ำ)', String(notFoundUnique), '#A32D2D')}
        </div>

        {/* guidance */}
        <div style={{ ...card, background: '#fff7ed', borderColor: '#fed7aa', fontSize: 12, color: '#7c4a13' }}>
          💡 <b>อ่านผลยังไง:</b> คำที่ค้นบ่อย <b>+ ไม่เจอ</b> = ดีมานด์หลุด → หามาขาย/ถ่ายรูปด่วน · คำที่ค้นบ่อย <b>+ เจอแล้ว</b> = คนสนใจ → ทำคอนเทนต์/ดันโพสต์เพิ่มยอด
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {tbtn('notfound', `❓ ค้นแล้วไม่เจอ (${notFoundUnique})`)}
          {tbtn('top', `🔥 ค้นบ่อย (${uniqueQueries})`)}
          {tbtn('model', `🚗 ตามรุ่น (${models.length})`)}
          <button onClick={() => copy(wantList(), 'คัดลอกรายการ "ควรหามาขาย" แล้ว')} style={{ ...qbtn, background: BRASS, color: '#fff', borderColor: BRASS }}>📋 คัดลอกรายการควรหามาขาย</button>
          <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
          <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
          <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
        </div>

        {/* empty */}
        {totalSearches === 0 && (
          <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 28 }}>
            — ยังไม่มีข้อมูลการค้นหาในช่วงนี้ —<br />
            <span style={{ fontSize: 12 }}>ระบบเริ่มเก็บคำค้นตั้งแต่ P0a deploy · พอลูกค้าใช้ช่องค้นหาบนเว็บ ข้อมูลจะเข้ามาเอง</span>
          </div>
        )}

        {/* ❓ ค้นแล้วไม่เจอ */}
        {tab === 'notfound' && totalSearches > 0 && (
          <>
            {notFoundGroups.length === 0 && <div style={{ ...card, color: '#888', textAlign: 'center', padding: 20 }}>🎉 ไม่มีคำค้นที่ "ไม่เจอ" ในช่วงนี้ — ของในคลังตอบโจทย์คนค้นได้หมด</div>}
            {notFoundGroups.map((g, i) => (
              <div key={i} style={{ ...card, borderLeft: '4px solid #A32D2D' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>“{g.query}”</div>
                  <div style={{ fontSize: 12, color: '#A32D2D', fontWeight: 700 }}>🔴 ไม่เจอ {g.notFound} ครั้ง</div>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
                  ค้นทั้งหมด {g.count} ครั้ง{g.found ? ` (เจอ ${g.found})` : ''} · {g.models.length ? `รุ่น: ${g.models.join(', ')} · ` : ''}ล่าสุด {fmtDate(g.lastAt)}
                </div>
              </div>
            ))}
          </>
        )}

        {/* 🔥 ค้นบ่อย */}
        {tab === 'top' && totalSearches > 0 && (
          <>
            {topGroups.map((g, i) => (
              <div key={i} style={{ ...card, borderLeft: `4px solid ${g.notFound > 0 ? '#854F0B' : GREEN}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>“{g.query}”</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>ค้น {g.count} ครั้ง</div>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
                  {g.notFound > 0 ? <span style={{ color: '#A32D2D' }}>ไม่เจอ {g.notFound} · </span> : null}
                  เจอเฉลี่ย {g.avgResult} ชิ้น · {g.models.length ? `รุ่น: ${g.models.join(', ')} · ` : ''}ล่าสุด {fmtDate(g.lastAt)}
                </div>
              </div>
            ))}
          </>
        )}

        {/* 🚗 ตามรุ่น */}
        {tab === 'model' && totalSearches > 0 && (
          <>
            {models.map((m, i) => (
              <div key={i} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{m.model}</div>
                <div style={{ fontSize: 12.5, color: '#666' }}>ค้น {m.count} ครั้ง · {m.notFound > 0 ? <span style={{ color: '#A32D2D', fontWeight: 700 }}>ไม่เจอ {m.notFound}</span> : <span style={{ color: GREEN }}>เจอครบ</span>}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
