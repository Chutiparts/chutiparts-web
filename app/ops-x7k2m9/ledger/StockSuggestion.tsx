'use client'
// app/ops-x7k2m9/ledger/StockSuggestion.tsx — P2 #23 Stock Suggestion → สร้าง Task หาของ (owner-facing · Ledger owner-only)
// อ่าน sales+stock (Path B) → หา SKU "ขายดีใกล้หมด" (คงเหลือ=รับเข้า−ขาย ≤1 + ขาย90วัน≥1) → เสนอ draft
// owner กด "ยืนยันสร้าง Task" → POST /api/stock-reorder-task (สร้าง ops_tasks + audit) · ไม่ auto · confirm เท่านั้น
import { useMemo, useState } from 'react'

type Row = Record<string, any>
const U = (s: any) => String(s || '').trim().toUpperCase()
const daysSince = (d?: string | null) => { if (!d) return 9999; const t = new Date(d).getTime(); return isNaN(t) ? 9999 : Math.floor((Date.now() - t) / 86400000) }

export default function StockSuggestion({ sales = [], stock = [] }: { sales?: Row[]; stock?: Row[] }) {
  const [done, setDone] = useState<Record<string, string>>({})   // sku -> 'created' | 'skipped'
  const [note, setNote] = useState<Record<string, string>>({})   // sku -> note
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2000) }

  // Path B: คงเหลือ = รับเข้า(stock.qty) − ขาย(นับ sales ตาม sku) · + ขาย 90 วัน (ดีมานด์)
  const soldBySku = useMemo(() => { const m: Record<string, number> = {}; sales.forEach((s) => { const k = U(s.sku); if (k) m[k] = (m[k] || 0) + Number(s.qty || 1) }); return m }, [sales])
  const sold90BySku = useMemo(() => { const m: Record<string, number> = {}; sales.forEach((s) => { const k = U(s.sku); if (k && s.sale_date && daysSince(s.sale_date) <= 90) m[k] = (m[k] || 0) + 1 }); return m }, [sales])

  const suggestions = useMemo(() => {
    return stock
      .filter((s) => String(s.sku || '').trim() && s.qty != null && !isNaN(Number(s.qty)))
      .map((s) => {
        const sku = String(s.sku).trim()
        const received = Number(s.qty) || 0
        const sold = soldBySku[U(sku)] || 0
        const left = received - sold
        const sold90 = sold90BySku[U(sku)] || 0
        return { sku, part_name: s.part_name || '(ไม่ระบุ)', car_model: s.car_model || '', left, sold90 }
      })
      .filter((x) => x.left <= 1 && x.sold90 >= 1)
      .sort((a, b) => b.sold90 - a.sold90 || a.left - b.left)
  }, [stock, soldBySku, sold90BySku])

  const visible = suggestions.filter((x) => !done[x.sku])

  async function create(x: typeof suggestions[number]) {
    const reason = `ขายดี ${x.sold90} ครั้ง/90วัน · คงเหลือ ${x.left} ชิ้น — ควรหา/สั่งเพิ่ม`
    setBusy(x.sku)
    try {
      const r = await fetch('/api/stock-reorder-task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: x.sku, part_name: x.part_name, car_model: x.car_model, reason, note: note[x.sku] || '' }),
      })
      const j = await r.json().catch(() => ({ ok: false }))
      if (j.ok) { setDone((p) => ({ ...p, [x.sku]: 'created' })); flash('สร้าง Task หาของแล้ว → ดูใน Tasks') }
      else if (j.error === 'already_requested') { setDone((p) => ({ ...p, [x.sku]: 'created' })); flash('มี Task หาของของ SKU นี้อยู่แล้ว (14 วันล่าสุด)') }
      else flash('ไม่สำเร็จ: ' + (j.error || 'error'))
    } catch { flash('เชื่อมต่อไม่สำเร็จ') }
    setBusy('')
  }

  if (!suggestions.length) {
    return (
      <div style={box}>
        <div style={head}>🛒 ควรสั่งเพิ่ม / หาของ (Draft)</div>
        <div style={{ fontSize: 12.5, color: '#0F6E56' }}>✅ ไม่มีของขายดีที่ใกล้หมดตอนนี้ — สต็อกพอ</div>
      </div>
    )
  }

  return (
    <div style={box}>
      <div style={head}>🛒 ควรสั่งเพิ่ม / หาของ (Draft) · {visible.length}</div>
      <div style={{ fontSize: 11.5, color: '#777', marginBottom: 8 }}>
        ของ <b>ขายดีแต่ใกล้หมด</b> (คงเหลือ = รับเข้า − ขาย · Path B) · ยืนยันเพื่อ <b>สร้าง Task หาของ</b> ให้ทีม · <b>ไม่สั่งอัตโนมัติ · owner กดยืนยันเอง</b>
      </div>
      {visible.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#0F6E56' }}>✅ จัดการครบทุกรายการในรอบนี้แล้ว</div>
      ) : visible.map((x) => (
        <div key={x.sku} style={rowBox}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
            {x.part_name}{x.car_model ? ` · ${x.car_model}` : ''} <span style={{ color: '#0C447C' }}>[{x.sku}]</span>
          </div>
          <div style={{ fontSize: 12, color: x.left <= 0 ? '#A32D2D' : '#854F0B', margin: '2px 0 6px' }}>
            {x.left <= 0 ? '🔴 ขายดีแต่หมดสต็อก' : '🟡 เหลือน้อย'} · ขาย {x.sold90} ครั้ง/90วัน · คงเหลือ {x.left} ชิ้น
          </div>
          <input value={note[x.sku] || ''} onChange={(e) => setNote((p) => ({ ...p, [x.sku]: e.target.value }))} placeholder="โน้ตเพิ่ม (จำนวนที่อยากได้ / แหล่ง / งบ) — ไม่บังคับ" style={inp} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <button disabled={busy === x.sku} onClick={() => create(x)} style={{ ...btn, opacity: busy === x.sku ? 0.6 : 1 }}>
              {busy === x.sku ? '...' : '➕ ยืนยันสร้าง Task หาของ'}
            </button>
            <button disabled={busy === x.sku} onClick={() => setDone((p) => ({ ...p, [x.sku]: 'skipped' }))} style={btnGhost}>ข้าม</button>
          </div>
        </div>
      ))}
      {toast && <div style={{ marginTop: 8, fontSize: 12, color: '#17301F', fontWeight: 600 }}>{toast}</div>}
    </div>
  )
}

const box: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 12, padding: 14, marginBottom: 14 }
const head: React.CSSProperties = { fontSize: 15, color: '#17301F', fontWeight: 700, marginBottom: 6 }
const rowBox: React.CSSProperties = { border: '1px solid #eee', borderRadius: 9, padding: '9px 11px', marginBottom: 8, background: '#fbfaf6' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }
const btn: React.CSSProperties = { background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
