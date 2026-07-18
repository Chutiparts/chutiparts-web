'use client'
// app/ops-x7k2m9/sync/SyncClient.tsx — Sheet → Supabase Sync (ทาง C: products catalog)
// flow: upload/paste CSV → parse → map field → PREVIEW (New/Update/No change/Warning/Error) → owner กดยืนยัน → เขียน
// KEY = part_number (sheet SKU → products.part_number) · กรองแถวหมวด (SKU ไม่มีตัวเลข = ข้าม)
// SAFETY: dry-run เสมอ · ไม่เขียนจนกดยืนยัน · ไม่ทับด้วยว่าง (server) · เตือน SKU ซ้ำ · backup ก่อนเขียน · import report
import { useMemo, useState } from 'react'

type Row = Record<string, any>
type SyncRow = { id?: string | null; part_number: string; name?: string | null; car_model?: string | null; price?: number | null; oem_number?: string | null }
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

// ---------- CSV parser (รองรับ quote/คอมมาในเซลล์/\r\n) ----------
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else {
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

type PreviewRow = { status: 'new' | 'update' | 'nochange' | 'warning' | 'error'; part_number: string; name: string; car_model: string; price: number | null; oem_number: string; note: string; id?: string | null; write: boolean }

export default function SyncClient({ products, applyProductSync }: { products: Row[]; applyProductSync: (rows: SyncRow[]) => Promise<{ ok: boolean; added: number; updated: number; errors: { pn: string; msg: string }[]; batchId: string; at: string }> }) {
  const [raw, setRaw] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; updated: number; errors: { pn: string; msg: string }[]; batchId: string; at: string } | null>(null)

  const byPn = useMemo(() => { const m: Record<string, Row> = {}; products.forEach((p) => { const k = normKey(p.part_number); if (k) m[k] = p }); return m }, [products])

  const analysis = useMemo(() => {
    if (!raw.trim()) return null
    const grid = parseCSV(raw)
    if (!grid.length) return null
    let hi = grid.findIndex((r) => r.some((c) => norm(c).toLowerCase() === 'sku'))
    if (hi < 0) hi = 0
    const header = grid[hi]
    const ci = {
      sku: findCol(header, ['sku']),
      name: findCol(header, ['ชื่ออะไหล่', 'ชื่อ', 'name']),
      model: findCol(header, ['รุ่น', 'model']),
      price: findCol(header, ['ราคาขาย', 'ราคา', 'price']),
      oem: findCol(header, ['oem']),
    }
    if (ci.sku < 0) return { error: 'ไม่พบคอลัมน์ SKU ใน CSV (ตรวจว่า export ถูกแท็บ)', rows: [] as PreviewRow[], counts: {} as any, seenDup: [] as string[], orphans: 0, skipped: 0, headerRow: hi + 1 }
    const seen: Record<string, number> = {}
    const out: PreviewRow[] = []
    const usedPn = new Set<string>()
    let skipped = 0
    for (let i = hi + 1; i < grid.length; i++) {
      const r = grid[i]
      const sku = norm(r[ci.sku])
      if (!sku) continue
      if (!hasDigit(sku)) { skipped++; continue } // แถวหมวด (ENGINE/COOLING...) = ข้าม
      const key = normKey(sku)
      seen[key] = (seen[key] || 0) + 1
      const name = ci.name >= 0 ? norm(r[ci.name]) : ''
      const model = ci.model >= 0 ? norm(r[ci.model]) : ''
      const price = ci.price >= 0 ? toNum(r[ci.price]) : null
      const oem = ci.oem >= 0 ? norm(r[ci.oem]) : ''
      if (usedPn.has(key)) continue // SKU ซ้ำ (หลายรับเข้า) → ใช้แถวแรก
      usedPn.add(key)
      const ex = byPn[key]
      let status: PreviewRow['status'], note = ''
      if (!name && price == null && !oem && !model) { status = 'error'; note = 'แถวข้อมูลว่าง' }
      else if (!ex) { status = 'new'; note = name ? 'ใหม่ (จะซ่อนไว้ก่อน is_published=false)' : 'ใหม่ แต่ไม่มีชื่อ' }
      else {
        const diffs: string[] = []
        if (name && norm(ex.name) !== name) diffs.push('ชื่อ')
        const exModels = Array.isArray(ex.compatible_models) ? ex.compatible_models.map((m: any) => normKey(m)) : (ex.car_model ? [normKey(ex.car_model)] : [])
        if (model && !exModels.includes(normKey(model))) diffs.push('รุ่น')
        if (price != null && Number(ex.price || 0) !== price) diffs.push('ราคา')
        if (oem && norm(ex.oem_number) !== oem) diffs.push('OEM')
        if (diffs.length) { status = 'update'; note = 'อัปเดต: ' + diffs.join(', ') }
        else { status = 'nochange'; note = 'เหมือนเดิม' }
      }
      out.push({ status, part_number: sku, name, car_model: model, price, oem_number: oem, note, id: ex ? ex.id : null, write: status === 'new' || status === 'update' })
    }
    const seenDup = Object.keys(seen).filter((k) => seen[k] > 1)
    const sheetKeys = new Set(out.map((o) => normKey(o.part_number)))
    const orphans = products.filter((p) => normKey(p.part_number) && !sheetKeys.has(normKey(p.part_number))).length
    const counts = {
      new: out.filter((o) => o.status === 'new').length,
      update: out.filter((o) => o.status === 'update').length,
      nochange: out.filter((o) => o.status === 'nochange').length,
      error: out.filter((o) => o.status === 'error').length,
    }
    return { error: '', rows: out, counts, seenDup, orphans, skipped, headerRow: hi + 1 }
  }, [raw, byPn, products])

  const toWrite = useMemo(() => (analysis?.rows || []).filter((r) => r.write), [analysis])

  const onFile = (f?: File) => { if (!f) return; setFileName(f.name); const rd = new FileReader(); rd.onload = () => setRaw(String(rd.result || '')); rd.readAsText(f, 'utf-8') }
  const dl = (name: string, content: string, type: string) => { const b = new Blob(['﻿' + content], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
  const backup = () => dl(`products-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(products, null, 2), 'application/json')
  async function confirmWrite() {
    if (!toWrite.length || busy) return
    if (!window.confirm(`ยืนยันเขียน ${toWrite.length} รายการลง products?\n(เพิ่ม ${analysis?.counts.new} · แก้ ${analysis?.counts.update})\nระบบจะดาวน์โหลด backup ให้ก่อน`)) return
    setBusy(true)
    backup()
    try {
      const payload: SyncRow[] = toWrite.map((r) => ({ id: r.id, part_number: r.part_number, name: r.name || null, car_model: r.car_model || null, price: r.price, oem_number: r.oem_number || null }))
      const res = await applyProductSync(payload)
      setResult(res)
      dl(`import-report-${res.batchId}.json`, JSON.stringify({ ...res, fileName, wrote: payload.length }, null, 2), 'application/json')
    } catch (e: any) { setResult({ added: 0, updated: 0, errors: [{ pn: '-', msg: String(e?.message || e) }], batchId: 'err', at: new Date().toISOString() }) }
    setBusy(false)
  }

  const card: any = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 12, padding: 14, marginBottom: 12 }
  const btn: any = { padding: '8px 14px', borderRadius: 9, border: '1px solid #ddd', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#333' }
  const SC: Record<string, { bg: string; fg: string; th: string }> = {
    new: { bg: '#EAF3DE', fg: '#3B6D11', th: 'ใหม่' }, update: { bg: '#FAEEDA', fg: '#854F0B', th: 'อัปเดต' },
    nochange: { bg: '#F1EFE8', fg: '#5F5E5A', th: 'เหมือนเดิม' }, warning: { bg: '#FEF3C7', fg: '#92400E', th: 'เตือน' }, error: { bg: '#FCEBEB', fg: '#A32D2D', th: 'error' },
  }
  const chip = (label: string, n: number, c: { bg: string; fg: string }) => (
    <div style={{ background: c.bg, color: c.fg, borderRadius: 10, padding: '8px 10px', minWidth: 84, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{n}</div><div style={{ fontSize: 11, fontWeight: 600 }}>{label}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>🔄 Sheet Sync — อัปเดตแคตตาล็อกจาก Google Sheet</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>Google Sheet = แม่ · export CSV → อัปโหลด → ดู preview → กดยืนยันจึงเขียน · เขียนเฉพาะ products (ไม่แตะ stock/ยอดขาย/schema)</div>
        <div style={{ fontSize: 11.5, color: '#a9bfb1', marginTop: 4 }}>จับคู่ด้วย part_number (รหัสร้าน) · แถวหมวดไม่มีตัวเลข = ข้าม · dry-run เสมอ · backup ก่อนเขียน · เฉพาะ owner</div>
      </div>

      <div style={{ padding: 12, maxWidth: 1000, margin: '0 auto' }}>
        <div style={card}>
          <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8 }}>1) วาง CSV หรือเลือกไฟล์ (export จากแท็บ "รับเข้า")</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} style={{ fontSize: 13 }} />
            {fileName && <span style={{ fontSize: 12, color: '#555' }}>📄 {fileName}</span>}
            {raw && <button style={btn} onClick={() => { setRaw(''); setFileName(''); setResult(null) }}>ล้าง</button>}
          </div>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="หรือวางข้อความ CSV ที่นี่ (บรรทัดหัวต้องมีคอลัมน์ SKU / ชื่ออะไหล่ / รุ่น / ราคาขาย / OEM)"
            style={{ width: '100%', minHeight: 90, border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 12.5, fontFamily: 'monospace' }} />
        </div>

        {analysis && analysis.error && <div style={{ ...card, background: '#FCEBEB', color: '#A32D2D', fontWeight: 600 }}>⛔ {analysis.error}</div>}
        {analysis && !analysis.error && (
          <>
            <div style={card}>
              <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8 }}>2) Preview (ยังไม่เขียนอะไร) · หัวตารางแถวที่ {analysis.headerRow}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {chip('ใหม่', analysis.counts.new, SC.new)}
                {chip('อัปเดต', analysis.counts.update, SC.update)}
                {chip('เหมือนเดิม', analysis.counts.nochange, SC.nochange)}
                {chip('error', analysis.counts.error, SC.error)}
              </div>
              {analysis.skipped > 0 && <div style={{ fontSize: 12.5, color: '#5F5E5A', marginBottom: 4 }}>ℹ️ ข้ามแถวหมวด/ไม่มีรหัส {analysis.skipped} แถว (เช่น ENGINE, COOLING)</div>}
              {analysis.seenDup.length > 0 && <div style={{ fontSize: 12.5, color: '#92400E', marginBottom: 4 }}>⚠️ รหัสซ้ำใน CSV {analysis.seenDup.length} ตัว (หลายรับเข้า) — ใช้แถวแรก: {analysis.seenDup.slice(0, 8).join(', ')}{analysis.seenDup.length > 8 ? ' …' : ''}</div>}
              {analysis.orphans > 0 && <div style={{ fontSize: 12.5, color: '#5F5E5A' }}>ℹ️ มีในเว็บแต่ไม่มีในชีต {analysis.orphans} รายการ — <b>ไม่ลบ</b> (ปล่อยไว้ให้พี่ตรวจเอง)</div>}
            </div>

            <div style={{ ...card, padding: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ background: '#f3f1ea', textAlign: 'left' }}>
                  {['สถานะ', 'รหัส', 'ชื่อ', 'รุ่น', 'ราคา', 'OEM', 'หมายเหตุ'].map((h) => <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #e7e3d8', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {analysis.rows.slice(0, 400).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0eee6' }}>
                      <td style={{ padding: '6px 10px' }}><span style={{ background: SC[r.status].bg, color: SC[r.status].fg, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{SC[r.status].th}</span></td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.part_number}</td>
                      <td style={{ padding: '6px 10px' }}>{r.name || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>{r.car_model || '—'}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{r.price != null ? '฿' + r.price.toLocaleString() : '—'}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{r.oem_number || '—'}</td>
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
                  {busy ? 'กำลังเขียน…' : `✅ ยืนยันเขียน ${toWrite.length} รายการลง Supabase`}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>กดยืนยัน = ดาวน์โหลด backup ให้อัตโนมัติ แล้วเขียน · อัปเดต=แตะแค่ ชื่อ/รุ่น/ราคา/OEM · ใหม่=is_published:false (ไปเปิด publish + ใส่รูปเองทีหลัง)</div>
            </div>
          </>
        )}

        {result && (
          <div style={{ ...card, background: result.errors.length ? '#FCEBEB' : '#EAF3DE' }}>
            <div style={{ fontWeight: 700, color: result.errors.length ? '#A32D2D' : '#3B6D11', marginBottom: 6 }}>
              {result.errors.length ? '⚠️ เขียนเสร็จ (มี error บางรายการ)' : '✅ เขียนสำเร็จ'} · batch {result.batchId}
            </div>
            <div style={{ fontSize: 13 }}>เพิ่มใหม่ {result.added} · อัปเดต {result.updated} · error {result.errors.length}</div>
            {result.errors.length > 0 && <div style={{ fontSize: 12, color: '#A32D2D', marginTop: 4 }}>{result.errors.slice(0, 10).map((e, i) => <div key={i}>• {e.pn}: {e.msg}</div>)}</div>}
            <div style={{ fontSize: 11.5, color: '#777', marginTop: 6 }}>ดาวน์โหลด import report + backup ไว้แล้ว (ในโฟลเดอร์ดาวน์โหลด) · SKU ใหม่ไปเปิด publish + ใส่รูปที่หน้าจัดการสินค้า</div>
          </div>
        )}
      </div>
    </div>
  )
}
