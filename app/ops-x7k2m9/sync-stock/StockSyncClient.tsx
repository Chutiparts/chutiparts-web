'use client'
// app/ops-x7k2m9/sync-stock/StockSyncClient.tsx — Path B: Sheet(รับเข้า tab) → stock_records "คลังตั้งต้น (received)"
// flow: upload CSV แท็บ "รับเข้า" → รวมจำนวนต่อ SKU (received) → PREVIEW → owner กดยืนยัน → เขียน qty(=received)
// เว็บจะหักยอดขาย (sales by sku) เอง = คงเหลือจริง (คิดที่ Daily Brief) · KEY = sku
// SAFETY: dry-run · ไม่เขียนจนกดยืนยัน · backup ก่อนเขียน · import report · owner-only
import { useMemo, useState } from 'react'

type Row = Record<string, any>
type StockRow = { id?: string | null; sku: string; qty: number; part_name?: string | null; car_model?: string | null; cost?: number | null; set_price?: number | null; location?: string | null }
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else {
      if (c === '"') q = true
      else if (c === ',') { row.push(cell); cell = '' }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else if (c === '\r') { /* skip */ }
      else cell += c
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''))
}
const norm = (s: any) => String(s || '').trim()
const normKey = (s: any) => norm(s).toUpperCase()
const toNum = (s: any) => { const n = Number(String(s || '').replace(/[,฿\s]/g, '')); return isNaN(n) ? null : n }
const hasDigit = (s: any) => /[0-9]/.test(String(s || ''))
function findCol(header: string[], keys: string[]) {
  for (let i = 0; i < header.length; i++) { const h = norm(header[i]).toLowerCase(); if (keys.some((k) => h.includes(k))) return i }
  return -1
}

type PreviewRow = { status: 'new' | 'update' | 'nochange' | 'error'; sku: string; part_name: string; car_model: string; qty: number; cost: number | null; set_price: number | null; location: string; note: string; id?: string | null; write: boolean }

export default function StockSyncClient({ stock, applyStockSync }: { stock: Row[]; applyStockSync: (rows: StockRow[]) => Promise<{ ok: boolean; added: number; updated: number; errors: { sku: string; msg: string }[]; batchId: string; at: string }> }) {
  const [raw, setRaw] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; updated: number; errors: { sku: string; msg: string }[]; batchId: string; at: string } | null>(null)

  const bySku = useMemo(() => { const m: Record<string, Row> = {}; stock.forEach((s) => { const k = normKey(s.sku); if (k) m[k] = s }); return m }, [stock])

  const analysis = useMemo(() => {
    if (!raw.trim()) return null
    const grid = parseCSV(raw)
    if (!grid.length) return null
    let hi = grid.findIndex((r) => r.some((c) => norm(c).toLowerCase() === 'sku'))
    if (hi < 0) hi = 0
    const header = grid[hi]
    const ci = {
      sku: findCol(header, ['sku']),
      qty: findCol(header, ['จำนวน', 'รับเข้า', 'qty', 'คงเหลือ']),
      name: findCol(header, ['ชื่ออะไหล่', 'ชื่อ', 'name']),
      model: findCol(header, ['รุ่น', 'model']),
      cost: findCol(header, ['ต้นทุน', 'cost']),
      price: findCol(header, ['ราคาขาย', 'ราคา', 'price']),
      loc: findCol(header, ['ที่เก็บ', 'location', 'ตำแหน่ง']),
    }
    if (ci.sku < 0) return { error: 'ไม่พบคอลัมน์ SKU (export แท็บ "รับเข้า" ให้ถูก)', rows: [] as PreviewRow[], counts: {} as any, skipped: 0, orphans: 0, headerRow: hi + 1, hasQty: false }
    if (ci.qty < 0) return { error: 'ไม่พบคอลัมน์ "จำนวน" (ต้อง export แท็บ "รับเข้า")', rows: [] as PreviewRow[], counts: {} as any, skipped: 0, orphans: 0, headerRow: hi + 1, hasQty: false }
    // รวมจำนวนต่อ SKU (received = SUM ของทุกแถวรับเข้า) · เก็บ meta จากแถวแรก
    const agg: Record<string, { sku: string; recv: number; name: string; model: string; cost: number | null; price: number | null; loc: string }> = {}
    let skipped = 0
    for (let i = hi + 1; i < grid.length; i++) {
      const r = grid[i]
      const sku = norm(r[ci.sku])
      if (!sku) continue
      if (!hasDigit(sku)) { skipped++; continue }
      const key = normKey(sku)
      const q = toNum(r[ci.qty]) || 0
      if (!agg[key]) agg[key] = { sku, recv: 0, name: ci.name >= 0 ? norm(r[ci.name]) : '', model: ci.model >= 0 ? norm(r[ci.model]) : '', cost: ci.cost >= 0 ? toNum(r[ci.cost]) : null, price: ci.price >= 0 ? toNum(r[ci.price]) : null, loc: ci.loc >= 0 ? norm(r[ci.loc]) : '' }
      agg[key].recv += q
    }
    const out: PreviewRow[] = []
    for (const key of Object.keys(agg)) {
      const a = agg[key]
      const qtyN = a.recv
      const ex = bySku[key]
      let status: PreviewRow['status'], note = ''
      if (!ex) { status = 'new'; note = `ตั้งคลังตั้งต้น (รับเข้า) ${qtyN}` }
      else {
        const exQty = Number(ex.qty)
        if (!isNaN(exQty) && exQty === qtyN) { status = 'nochange'; note = 'เหมือนเดิม' }
        else { status = 'update'; note = `รับเข้า ${isNaN(exQty) ? '—' : exQty} → ${qtyN}` }
      }
      out.push({ status, sku: a.sku, part_name: a.name, car_model: a.model, qty: qtyN, cost: a.cost, set_price: a.price, location: a.loc, note, id: ex ? ex.id : null, write: status === 'new' || status === 'update' })
    }
    out.sort((x, y) => (x.car_model + x.sku).localeCompare(y.car_model + y.sku))
    const sheetKeys = new Set(out.map((o) => normKey(o.sku)))
    const orphans = stock.filter((s) => normKey(s.sku) && !sheetKeys.has(normKey(s.sku))).length
    const counts = {
      new: out.filter((o) => o.status === 'new').length,
      update: out.filter((o) => o.status === 'update').length,
      nochange: out.filter((o) => o.status === 'nochange').length,
      error: 0,
    }
    return { error: '', rows: out, counts, skipped, orphans, headerRow: hi + 1, hasQty: true }
  }, [raw, bySku, stock])

  const toWrite = useMemo(() => (analysis?.rows || []).filter((r) => r.write), [analysis])
  const totalUnits = useMemo(() => (analysis?.rows || []).reduce((s, r) => s + (r.qty || 0), 0), [analysis])

  const onFile = (f?: File) => { if (!f) return; setFileName(f.name); const rd = new FileReader(); rd.onload = () => setRaw(String(rd.result || '')); rd.readAsText(f, 'utf-8') }
  const dl = (name: string, content: string, type: string) => { const b = new Blob(['﻿' + content], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
  const backup = () => dl(`stock-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(stock, null, 2), 'application/json')
  async function confirmWrite() {
    if (!toWrite.length || busy) return
    if (!window.confirm(`ยืนยันเขียนคลังตั้งต้น (รับเข้า) ${toWrite.length} รายการลง stock_records?\n(เพิ่ม ${analysis?.counts.new} · แก้ ${analysis?.counts.update})\nเว็บจะหักยอดขายเอง = คงเหลือจริง · ระบบดาวน์โหลด backup ให้ก่อน`)) return
    setBusy(true)
    backup()
    try {
      const payload: StockRow[] = toWrite.map((r) => ({ id: r.id, sku: r.sku, qty: r.qty, part_name: r.part_name || null, car_model: r.car_model || null, cost: r.cost, set_price: r.set_price, location: r.location || null }))
      const res = await applyStockSync(payload)
      setResult(res)
      dl(`stock-import-report-${res.batchId}.json`, JSON.stringify({ ...res, fileName, wrote: payload.length }, null, 2), 'application/json')
    } catch (e: any) { setResult({ added: 0, updated: 0, errors: [{ sku: '-', msg: String(e?.message || e) }], batchId: 'err', at: new Date().toISOString() }) }
    setBusy(false)
  }

  const card: any = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 12, padding: 14, marginBottom: 12 }
  const btn: any = { padding: '8px 14px', borderRadius: 9, border: '1px solid #ddd', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#333' }
  const SC: Record<string, { bg: string; fg: string; th: string }> = {
    new: { bg: '#EAF3DE', fg: '#3B6D11', th: 'ใหม่' }, update: { bg: '#FAEEDA', fg: '#854F0B', th: 'อัปเดต' },
    nochange: { bg: '#F1EFE8', fg: '#5F5E5A', th: 'เหมือนเดิม' }, error: { bg: '#FCEBEB', fg: '#A32D2D', th: 'error' },
  }
  const chip = (label: string, n: number, c: { bg: string; fg: string }) => (
    <div style={{ background: c.bg, color: c.fg, borderRadius: 10, padding: '8px 10px', minWidth: 84, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{n}</div><div style={{ fontSize: 11, fontWeight: 600 }}>{label}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>📦 Sync คลังตั้งต้น (รับเข้า) จากชีต</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>Path B · export แท็บ "รับเข้า" → อัปโหลด → ดู preview → ยืนยัน · เขียน "รับเข้ารวม" ต่อ SKU · <b>เว็บหักยอดขายเอง = คงเหลือจริง</b> (ดู Daily Brief)</div>
        <div style={{ fontSize: 11.5, color: '#a9bfb1', marginTop: 4 }}>รวมจำนวนต่อ SKU · จับคู่ด้วย SKU · upsert 1 แถว/SKU · dry-run + backup ก่อนเขียน · เฉพาะ owner</div>
      </div>

      <div style={{ padding: 12, maxWidth: 1000, margin: '0 auto' }}>
        <div style={card}>
          <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8 }}>1) วาง CSV หรือเลือกไฟล์ (export จากแท็บ <b>"รับเข้า"</b> — มีคอลัมน์ SKU + จำนวน)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} style={{ fontSize: 13 }} />
            {fileName && <span style={{ fontSize: 12, color: '#555' }}>📄 {fileName}</span>}
            {raw && <button style={btn} onClick={() => { setRaw(''); setFileName(''); setResult(null) }}>ล้าง</button>}
          </div>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder='วางข้อความ CSV แท็บ "รับเข้า" ที่นี่ (ต้องมีคอลัมน์ SKU และ จำนวน)'
            style={{ width: '100%', minHeight: 80, border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 12.5, fontFamily: 'monospace' }} />
        </div>

        {analysis && analysis.error && <div style={{ ...card, background: '#FCEBEB', color: '#A32D2D', fontWeight: 600 }}>⛔ {analysis.error}</div>}
        {analysis && !analysis.error && (
          <>
            <div style={card}>
              <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8 }}>2) Preview (ยังไม่เขียนอะไร) · หัวตารางแถวที่ {analysis.headerRow} · รับเข้ารวม {totalUnits} ชิ้น</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {chip('ใหม่', analysis.counts.new, SC.new)}
                {chip('อัปเดต', analysis.counts.update, SC.update)}
                {chip('เหมือนเดิม', analysis.counts.nochange, SC.nochange)}
              </div>
              {analysis.skipped > 0 && <div style={{ fontSize: 12.5, color: '#5F5E5A', marginBottom: 4 }}>ℹ️ ข้ามแถวหมวด/ไม่มีรหัส {analysis.skipped} แถว</div>}
              {analysis.orphans > 0 && <div style={{ fontSize: 12.5, color: '#5F5E5A' }}>ℹ️ มีในเว็บแต่ไม่มีในชีต {analysis.orphans} รายการ — ไม่ลบ</div>}
              <div style={{ fontSize: 11.5, color: '#7c4a13', marginTop: 4 }}>💡 ตัวเลขนี้ = "รับเข้ารวม" (คลังตั้งต้น) · คงเหลือจริง = รับเข้า − ยอดขาย (เว็บคิดให้ที่ Daily Brief)</div>
            </div>

            <div style={{ ...card, padding: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ background: '#f3f1ea', textAlign: 'left' }}>
                  {['สถานะ', 'SKU', 'ชื่อ', 'รุ่น', 'รับเข้ารวม', 'ที่เก็บ', 'หมายเหตุ'].map((h) => <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #e7e3d8', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {analysis.rows.slice(0, 400).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0eee6' }}>
                      <td style={{ padding: '6px 10px' }}><span style={{ background: SC[r.status].bg, color: SC[r.status].fg, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{SC[r.status].th}</span></td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.sku}</td>
                      <td style={{ padding: '6px 10px' }}>{r.part_name || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>{r.car_model || '—'}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: '#3B6D11', whiteSpace: 'nowrap' }}>{r.qty}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{r.location || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#777' }}>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {analysis.rows.length > 400 && <div style={{ padding: 8, fontSize: 12, color: '#999' }}>…แสดง 400 แถวแรก (ทั้งหมด {analysis.rows.length})</div>}
            </div>

            <div style={{ ...card, background: '#fbfaf6' }}>
              <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8 }}>3) ยืนยัน (เขียนเฉพาะ "ใหม่ + อัปเดต" = {toWrite.length} รายการ)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={btn} onClick={backup}>⬇ ดาวน์โหลด backup ปัจจุบัน</button>
                <button onClick={confirmWrite} disabled={busy || toWrite.length === 0}
                  style={{ ...btn, background: toWrite.length ? GREEN : '#ccc', color: '#fff', borderColor: GREEN, cursor: toWrite.length ? 'pointer' : 'default' }}>
                  {busy ? 'กำลังเขียน…' : `✅ ยืนยันเขียนคลังตั้งต้น ${toWrite.length} รายการ`}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>กดยืนยัน = ดาวน์โหลด backup ให้อัตโนมัติ แล้วเขียน · re-sync = ทับรับเข้ารวมตัวใหม่ (ปลอดภัย ไม่สร้างซ้ำ)</div>
            </div>
          </>
        )}

        {result && (
          <div style={{ ...card, background: result.errors.length ? '#FCEBEB' : '#EAF3DE' }}>
            <div style={{ fontWeight: 700, color: result.errors.length ? '#A32D2D' : '#3B6D11', marginBottom: 6 }}>
              {result.errors.length ? '⚠️ เขียนเสร็จ (มี error บางรายการ)' : '✅ เขียนสำเร็จ'} · batch {result.batchId}
            </div>
            <div style={{ fontSize: 13 }}>เพิ่มใหม่ {result.added} · อัปเดต {result.updated} · error {result.errors.length}</div>
            {result.errors.length > 0 && <div style={{ fontSize: 12, color: '#A32D2D', marginTop: 4 }}>{result.errors.slice(0, 10).map((e, i) => <div key={i}>• {e.sku}: {e.msg}</div>)}</div>}
            <div style={{ fontSize: 11.5, color: '#777', marginTop: 6 }}>ดาวน์โหลด report + backup ไว้แล้ว · คลังตั้งต้นในเว็บตรงกับ "รับเข้า" ในชีตแล้ว · คงเหลือจริงดูที่ Daily Brief</div>
          </div>
        )}
      </div>
    </div>
  )
}
