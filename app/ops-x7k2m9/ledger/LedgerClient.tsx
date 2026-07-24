'use client'
// app/ops-x7k2m9/ledger/LedgerClient.tsx — Core Ledger P0 (ฐานข้อมูลกลาง)
// 2 แท็บ: Sales Record (ขายจริง+กำไร) · Stock Record (สต็อก+อายุ) · add/edit/filter/export · ไม่ลบ (ใช้ status)
// P3.3: เพิ่มช่อง "แหล่งซื้อ" (stock_records.source)
// PathB: เพิ่มช่อง SKU ในฟอร์มขาย (+datalist จาก stock) → เว็บตัดสต็อกตาม SKU (คงเหลือ=รับเข้า−ขาย)
// QuickEntry(22ก.ค.): ฟอร์มบันทึกขาย/สต็อกเปิดพร้อมใช้ทันที + ยุบ draft/suggestion เป็นแถบพับ (กันดันปุ่มบันทึกลงล่าง)
// #22: แท็บ Sales มี StockLinkDraft (ผูก SKU รายการขายที่ยังไม่มี SKU → ตัดสต็อก Path B · owner confirm)
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import FinanceClient from '../finance/FinanceClient'
import StockLinkDraft from './StockLinkDraft'
import StockSuggestion from './StockSuggestion'
type Row = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'
const PAY: Record<string, { th: string; bg: string; fg: string }> = {
  unpaid: { th: 'ค้างชำระ', bg: '#FCEBEB', fg: '#A32D2D' },
  partial: { th: 'มัดจำ', bg: '#FAEEDA', fg: '#854F0B' },
  paid: { th: 'ชำระแล้ว ✓', bg: '#E1F5EE', fg: '#0F6E56' },
}
const DELIV: Record<string, { th: string; bg: string; fg: string }> = {
  pending: { th: 'รอจัดส่ง', bg: '#EEF0F3', fg: '#455' },
  packed: { th: 'แพ็คแล้ว', bg: '#E6F1FB', fg: '#0C447C' },
  shipped: { th: 'ส่งแล้ว', bg: '#FAEEDA', fg: '#854F0B' },
  delivered: { th: 'ถึงแล้ว ✓', bg: '#E1F5EE', fg: '#0F6E56' },
}
const STK: Record<string, { th: string; bg: string; fg: string }> = {
  in_stock: { th: 'มีของ', bg: '#E1F5EE', fg: '#0F6E56' },
  reserved: { th: 'จองแล้ว', bg: '#E6F1FB', fg: '#0C447C' },
  sold: { th: 'ขายแล้ว', bg: '#F1EFE8', fg: '#5F5E5A' },
  hold: { th: 'พักไว้', bg: '#FAEEDA', fg: '#854F0B' },
}
const PAY_ORDER = ['unpaid', 'partial', 'paid']
const DELIV_ORDER = ['pending', 'packed', 'shipped', 'delivered']
const STK_ORDER = ['in_stock', 'reserved', 'sold', 'hold']
const todayStr = () => new Date().toISOString().slice(0, 10)
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }
const baht = (v: any) => '฿' + num(v).toLocaleString()
function daysSince(d?: string | null) { if (!d) return null; const t = new Date(d).getTime(); if (isNaN(t)) return null; return Math.floor((Date.now() - t) / 86400000) }
function fmtDate(d?: string | null) { if (!d) return '-'; const x = new Date(d); if (isNaN(x.getTime())) return '-'; return `${x.getDate()}/${x.getMonth() + 1}/${(x.getFullYear() + 543) % 100}` }
const profitOf = (r: Row) => num(r.sale_price) - num(r.cost)
const marginOf = (r: Row) => { const p = num(r.sale_price); return p > 0 ? Math.round((profitOf(r) / p) * 100) : 0 }
const ageOf = (r: Row) => daysSince(r.date_in)
function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const sel: React.CSSProperties = { padding: '7px 9px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }
const lbl: React.CSSProperties = { fontSize: 12, color: '#666', fontWeight: 600, display: 'block' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, marginTop: 4, boxSizing: 'border-box' }
function dl(name: string, text: string, type: string) { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
export default function LedgerClient({ sales, stock, addSale, updateSale, addStock, updateStock, entries = [], addEntry, deleteEntry }:
  { sales: Row[]; stock: Row[]; addSale: (fd: FormData) => Promise<void>; updateSale: (fd: FormData) => Promise<void>; addStock: (fd: FormData) => Promise<void>; updateStock: (fd: FormData) => Promise<void>; entries?: Row[]; addEntry?: (fd: FormData) => Promise<void>; deleteEntry?: (fd: FormData) => Promise<void> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [tab, setTab] = useState<'sales' | 'stock' | 'finance'>('sales')
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600) }
  const saleSkus = useMemo(() => Array.from(new Set((stock || []).map((s) => String(s.sku || '').trim()).filter(Boolean))).sort(), [stock])
  const saleStock = useMemo(() => (stock || []).map((s) => ({ sku: String(s.sku || '').trim(), part_name: s.part_name || '', car_model: s.car_model || '', cost: s.cost ?? '' })).filter((s) => s.sku), [stock])
  function submit(action: (fd: FormData) => Promise<void>, fd: FormData, msg: string, done?: () => void) {
    start(async () => { await action(fd); router.refresh(); flash(msg); done?.() })
  }
  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>📒 Core Ledger — ฐานข้อมูลกลาง</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>บันทึกการขายจริง + สต็อกจริง → ให้ทุกโมดูลอ่านต้นทุน/กำไร/สต็อกได้ · {new Date().toLocaleDateString('th-TH')}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e7e3d8', flexWrap: 'wrap' }}>
        {([['sales', `Sales Record (${sales.length})`], ['stock', `Stock Record (${stock.length})`], ['finance', `💰 Finance Lite (${entries.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: `1px solid ${tab === k ? GREEN : '#ddd'}`, background: tab === k ? GREEN : '#fff', color: tab === k ? '#fff' : GREEN, borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
        ))}
        {pending && <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>กำลังบันทึก…</span>}
      </div>
      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {tab === 'sales'
          ? <><Collapsible key="sales-link" title="🔗 ผูก SKU รายการขายที่ยังไม่ตัดสต็อก (Path B)"><StockLinkDraft sales={sales} stock={stock} /></Collapsible><SalesTab rows={sales} skus={saleSkus} saleStock={saleStock} onAdd={(fd, d) => submit(addSale, fd, 'บันทึกการขายแล้ว', d)} onSave={(fd) => submit(updateSale, fd, 'อัปเดตแล้ว')} flash={flash} /></>
          : tab === 'stock'
          ? <><Collapsible key="stock-suggest" title="🛒 คำแนะนำ: ของขายดีใกล้หมด ควรสั่งเพิ่ม"><StockSuggestion sales={sales} stock={stock} /></Collapsible><StockTab rows={stock} onAdd={(fd, d) => submit(addStock, fd, 'บันทึกสต็อกแล้ว', d)} onSave={(fd) => submit(updateStock, fd, 'อัปเดตแล้ว')} flash={flash} /></>
          : (addEntry && deleteEntry ? <FinanceClient entries={entries} addEntry={addEntry} deleteEntry={deleteEntry} /> : <div style={{ ...card, padding: 16, color: '#999' }}>Finance Lite ไม่พร้อมใช้</div>)}
      </div>
      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}
function Stat({ label, val, color }: { label: string; val: string; color: string }) {
  return <div style={{ flex: 1, minWidth: 90, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
    <div style={{ fontSize: 19, fontWeight: 700, color }}>{val}</div><div style={{ fontSize: 11, color: '#777' }}>{label}</div></div>
}
function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: '100%', textAlign: 'left', background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 600, color: GREEN, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{title}</span><span style={{ color: '#999', fontSize: 12 }}>{open ? '▲ ซ่อน' : '▼ เปิดดู'}</span>
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  )
}
/* ===================== SALES ===================== */
function SalesTab({ rows, skus, saleStock, onAdd, onSave, flash }: { rows: Row[]; skus: string[]; saleStock: { sku: string; part_name: string; car_model: string; cost: any }[]; onAdd: (fd: FormData, done: () => void) => void; onSave: (fd: FormData) => void; flash: (m: string) => void }) {
  const [showAdd, setShowAdd] = useState(false) // ลงขายใหม่ย้ายไปเมนู "ขายออก" — ที่นี่เหลือดู/แก้ (กันลงซ้ำ 2 ที่)
  const [q, setQ] = useState(''); const [payF, setPayF] = useState(''); const [openId, setOpenId] = useState<string | null>(null)
  const stockBySku = useMemo(() => { const m: Record<string, any> = {}; (saleStock || []).forEach((s) => { if (s.sku) m[s.sku] = s }); return m }, [saleStock])
  const [addForm, setAddForm] = useState<{ sku: string; part_sold: string; car_model: string; cost: string }>({ sku: '', part_sold: '', car_model: '', cost: '' })
  const pickSku = (v: string) => { const m = stockBySku[v.trim()]; setAddForm((p) => ({ ...p, sku: v, ...(m ? { part_sold: m.part_name || '', car_model: m.car_model || '', cost: m.cost != null && m.cost !== '' ? String(m.cost) : '' } : {}) })) }
  const totalSales = rows.reduce((a, r) => a + num(r.sale_price), 0)
  const totalProfit = rows.reduce((a, r) => a + profitOf(r), 0)
  const unpaid = rows.filter((r) => (r.payment_status || 'unpaid') === 'unpaid').length
  const toShip = rows.filter((r) => ['pending', 'packed'].includes(r.delivery_status || 'pending')).length
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (payF && (r.payment_status || 'unpaid') !== payF) return false
      if (!kw) return true
      return [r.customer, r.car_model, r.part_sold, r.sku, r.tracking_no, r.note].filter(Boolean).join(' ').toLowerCase().includes(kw)
    })
  }, [rows, q, payF])
  const COLS = ['sale_date', 'sku', 'customer', 'car_model', 'part_sold', 'sale_price', 'cost', 'profit', 'margin', 'payment_status', 'delivery_status', 'tracking_no', 'note']
  const row = (r: Row) => [r.sale_date, r.sku, r.customer, r.car_model, r.part_sold, num(r.sale_price), num(r.cost), profitOf(r), marginOf(r) + '%', PAY[r.payment_status || 'unpaid']?.th, DELIV[r.delivery_status || 'pending']?.th, r.tracking_no, r.note]
  const exportCsv = () => dl(`sales-${todayStr()}.csv`, '﻿' + [COLS.join(','), ...filtered.map((r) => row(r).map(esc).join(','))].join('\r\n'), 'text/csv;charset=utf-8')
  const exportTxt = () => dl(`sales-${todayStr()}.txt`, '﻿' + `ChutiBenz — Sales Record\n${new Date().toLocaleString('th-TH')} · ${filtered.length} รายการ · ยอดขาย ${baht(totalSales)} · กำไร ${baht(totalProfit)}\n${'─'.repeat(40)}\n` + filtered.map((r) => `▪ ${fmtDate(r.sale_date)} · ${r.customer || '(ไม่ระบุ)'} · ${r.part_sold || 'อะไหล่'} ${r.car_model || ''}${r.sku ? ` [${r.sku}]` : ''}\n ขาย ${baht(r.sale_price)} · ทุน ${baht(r.cost)} · กำไร ${baht(profitOf(r))} (${marginOf(r)}%) · ${PAY[r.payment_status || 'unpaid']?.th} · ${DELIV[r.delivery_status || 'pending']?.th}${r.tracking_no ? ` · พัสดุ ${r.tracking_no}` : ''}`).join('\n\n'), 'text/plain;charset=utf-8')
  const exportJson = () => dl(`sales-${todayStr()}.json`, JSON.stringify(filtered.map((r) => ({ sale_date: r.sale_date, sku: r.sku, customer: r.customer, car_model: r.car_model, part_sold: r.part_sold, sale_price: num(r.sale_price), cost: num(r.cost), profit: profitOf(r), margin_pct: marginOf(r), payment_status: r.payment_status || 'unpaid', delivery_status: r.delivery_status || 'pending', tracking_no: r.tracking_no, note: r.note })), null, 2), 'application/json')
  return (
    <>
      <datalist id="salesku">{saleStock.map((s2) => <option key={s2.sku} value={s2.sku}>{s2.sku} · {s2.part_name}{s2.car_model ? ' · ' + s2.car_model : ''}</option>)}</datalist>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Stat label="ยอดขายรวม" val={baht(totalSales)} color={GREEN} />
        <Stat label="กำไรรวม" val={baht(totalProfit)} color="#0F6E56" />
        <Stat label="ค้างชำระ" val={String(unpaid)} color="#A32D2D" />
        <Stat label="รอส่ง" val={String(toShip)} color="#854F0B" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <a href="/ops-x7k2m9/sell" style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>+ ลงขายที่เมนู “ขายออก” →</a>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ลูกค้า/อะไหล่/รุ่น/SKU/พัสดุ" style={{ flex: 1, minWidth: 150, padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
        <select value={payF} onChange={(e) => setPayF(e.target.value)} style={sel}><option value="">ทุกสถานะเงิน</option>{PAY_ORDER.map((p) => <option key={p} value={p}>{PAY[p].th}</option>)}</select>
        <button onClick={exportCsv} style={qbtn}>⬇ CSV</button><button onClick={exportTxt} style={qbtn}>⬇ TXT</button><button onClick={exportJson} style={qbtn}>⬇ JSON</button>
      </div>
      {showAdd && (
        <form action={(fd) => onAdd(fd, () => { setShowAdd(false); setAddForm({ sku: '', part_sold: '', car_model: '', cost: '' }) })} style={{ ...card, padding: 12, border: '1px solid #e7e3d8' }}>
          <div style={{ fontWeight: 700, color: GREEN, marginBottom: 4, fontSize: 14 }}>บันทึกการขายใหม่</div>
          <div style={{ fontSize: 11.5, color: '#888', marginBottom: 8 }}>💡 พิมพ์ชื่ออะไหล่ในช่อง SKU (เช่น “กันชน”) แล้วเลือก → ชื่อ/รุ่น/ต้นทุน เติมให้อัตโนมัติ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={lbl}>SKU — พิมพ์ชื่อหรือรหัส<input name="sku" list="salesku" value={addForm.sku} onChange={(e) => pickSku(e.target.value)} style={inp} placeholder='พิมพ์ เช่น "กันชน" หรือ 140-001' /></label>
            <label style={lbl}>อะไหล่ที่ขาย<input name="part_sold" value={addForm.part_sold} onChange={(e) => setAddForm((p) => ({ ...p, part_sold: e.target.value }))} style={inp} placeholder="เช่น ไฟหน้า" /></label>
            <label style={lbl}>ลูกค้า<input name="customer" style={inp} placeholder="ชื่อลูกค้า" /></label>
            <label style={lbl}>รุ่นรถ<input name="car_model" value={addForm.car_model} onChange={(e) => setAddForm((p) => ({ ...p, car_model: e.target.value }))} style={inp} placeholder="เช่น W124" /></label>
            <label style={lbl}>วันที่ขาย<input name="sale_date" type="date" defaultValue={todayStr()} style={inp} /></label>
            <label style={lbl}>ราคาขาย (฿)<input name="sale_price" type="number" inputMode="numeric" style={inp} /></label>
            <label style={lbl}>ต้นทุน (฿) — เติมจากสต็อก<input name="cost" type="number" inputMode="numeric" value={addForm.cost} onChange={(e) => setAddForm((p) => ({ ...p, cost: e.target.value }))} style={inp} /></label>
            <label style={lbl}>สถานะชำระเงิน<select name="payment_status" defaultValue="unpaid" style={inp}>{PAY_ORDER.map((p) => <option key={p} value={p}>{PAY[p].th}</option>)}</select></label>
            <label style={lbl}>สถานะส่งของ<select name="delivery_status" defaultValue="pending" style={inp}>{DELIV_ORDER.map((d) => <option key={d} value={d}>{DELIV[d].th}</option>)}</select></label>
            <label style={lbl}>เลขพัสดุ<input name="tracking_no" style={inp} /></label>
            <label style={lbl}>หมายเหตุ<input name="note" style={inp} /></label>
          </div>
          <button type="submit" style={{ marginTop: 10, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>บันทึก</button>
        </form>
      )}
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>แสดง {filtered.length} / {rows.length} รายการ</div>
      {filtered.length === 0 && <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 24 }}>— ยังไม่มีรายการขาย —</div>}
      {filtered.map((r) => {
        const open = openId === r.id, pf = profitOf(r)
        return (
          <div key={r.id} style={card}>
            <div onClick={() => setOpenId(open ? null : r.id)} style={{ padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.customer || '(ไม่ระบุ)'} · {r.part_sold || 'อะไหล่'}{r.sku ? ` [${r.sku}]` : ''}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={PAY[r.payment_status || 'unpaid']?.th} bg={PAY[r.payment_status || 'unpaid']?.bg} fg={PAY[r.payment_status || 'unpaid']?.fg} />
                  <Badge label={DELIV[r.delivery_status || 'pending']?.th} bg={DELIV[r.delivery_status || 'pending']?.bg} fg={DELIV[r.delivery_status || 'pending']?.fg} />
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>{r.car_model || '—'} · ขาย {baht(r.sale_price)} · ทุน {baht(r.cost)} · <b style={{ color: pf >= 0 ? '#0F6E56' : '#A32D2D' }}>กำไร {baht(pf)} ({marginOf(r)}%)</b></div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3 }}>{fmtDate(r.sale_date)}{r.tracking_no ? ` · 📦 ${r.tracking_no}` : ''}{r.note ? ` · ${String(r.note).slice(0, 40)}` : ''}</div>
            </div>
            {open && <SaleEdit r={r} skus={skus} onSave={onSave} />}
          </div>
        )
      })}
    </>
  )
}
function SaleEdit({ r, skus, onSave }: { r: Row; skus: string[]; onSave: (fd: FormData) => void }) {
  return (
    <form action={onSave} style={{ borderTop: '1px solid #eee', padding: 12, background: '#fbfaf6' }}>
      <input type="hidden" name="id" value={r.id} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {PAY_ORDER.map((p) => <button key={p} type="submit" name="payment_status" value={p} style={{ ...qbtn, ...((r.payment_status || 'unpaid') === p ? { background: PAY[p].bg, color: PAY[p].fg, borderColor: PAY[p].fg } : {}) }}>{PAY[p].th}</button>)}
        <span style={{ width: 8 }} />
        {DELIV_ORDER.map((d) => <button key={d} type="submit" name="delivery_status" value={d} style={{ ...qbtn, ...((r.delivery_status || 'pending') === d ? { background: DELIV[d].bg, color: DELIV[d].fg, borderColor: DELIV[d].fg } : {}) }}>{DELIV[d].th}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <label style={lbl}>SKU<input name="sku" list="salesku" defaultValue={r.sku || ''} style={inp} /></label>
        <label style={lbl}>สินค้า/อะไหล่<input name="part_sold" defaultValue={r.part_sold || ''} style={inp} /></label>
        <label style={lbl}>ลูกค้า<input name="customer" defaultValue={r.customer || ''} style={inp} /></label>
        <label style={lbl}>รุ่น<input name="car_model" defaultValue={r.car_model || ''} style={inp} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={lbl}>ราคาขาย<input name="sale_price" type="number" defaultValue={r.sale_price ?? ''} style={inp} /></label>
        <label style={lbl}>ต้นทุน<input name="cost" type="number" defaultValue={r.cost ?? ''} style={inp} /></label>
        <label style={lbl}>เลขพัสดุ<input name="tracking_no" defaultValue={r.tracking_no || ''} style={inp} /></label>
        <label style={lbl}>วันที่ขาย<input name="sale_date" type="date" defaultValue={r.sale_date || ''} style={inp} /></label>
      </div>
      <label style={{ ...lbl, marginTop: 8 }}>หมายเหตุ<input name="note" defaultValue={r.note || ''} style={inp} /></label>
      <button type="submit" style={{ marginTop: 10, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>บันทึกการแก้ไข</button>
    </form>
  )
}
/* ===================== STOCK ===================== */
function StockTab({ rows, onAdd, onSave, flash }: { rows: Row[]; onAdd: (fd: FormData, done: () => void) => void; onSave: (fd: FormData) => void; flash: (m: string) => void }) {
  const [showAdd, setShowAdd] = useState(true)
  const [q, setQ] = useState(''); const [stF, setStF] = useState(''); const [openId, setOpenId] = useState<string | null>(null)
  const inStock = rows.filter((r) => (r.status || 'in_stock') === 'in_stock')
  const stockValue = inStock.reduce((a, r) => a + num(r.cost), 0)
  const noImage = inStock.filter((r) => !r.has_image).length
  const aged = inStock.filter((r) => (ageOf(r) || 0) >= 365).length
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (stF && (r.status || 'in_stock') !== stF) return false
      if (!kw) return true
      return [r.part_name, r.car_model, r.location, r.sku, r.note].filter(Boolean).join(' ').toLowerCase().includes(kw)
    })
  }, [rows, q, stF])
  const COLS = ['date_in', 'part_name', 'car_model', 'cost', 'set_price', 'status', 'location', 'source', 'has_image', 'age_days', 'sku', 'note']
  const row = (r: Row) => [r.date_in, r.part_name, r.car_model, num(r.cost), num(r.set_price), STK[r.status || 'in_stock']?.th, r.location, r.source, r.has_image ? 'มีรูป' : 'ไม่มีรูป', ageOf(r) ?? '', r.sku, r.note]
  const exportCsv = () => dl(`stock-${todayStr()}.csv`, '﻿' + [COLS.join(','), ...filtered.map((r) => row(r).map(esc).join(','))].join('\r\n'), 'text/csv;charset=utf-8')
  const exportTxt = () => dl(`stock-${todayStr()}.txt`, '﻿' + `ChutiBenz — Stock Record\n${new Date().toLocaleString('th-TH')} · ${filtered.length} รายการ · มูลค่าสต็อก(ทุน) ${baht(stockValue)}\n${'─'.repeat(40)}\n` + filtered.map((r) => `▪ ${r.part_name || '(ไม่ระบุ)'} ${r.car_model || ''} · ${STK[r.status || 'in_stock']?.th}\n ทุน ${baht(r.cost)} · ตั้งขาย ${baht(r.set_price)} · เข้า ${fmtDate(r.date_in)} (อายุ ${ageOf(r) ?? '-'} วัน) · ${r.has_image ? 'มีรูป' : 'ไม่มีรูป'}${r.location ? ` · ที่เก็บ ${r.location}` : ''}`).join('\n\n'), 'text/plain;charset=utf-8')
  const exportJson = () => dl(`stock-${todayStr()}.json`, JSON.stringify(filtered.map((r) => ({ date_in: r.date_in, part_name: r.part_name, car_model: r.car_model, cost: num(r.cost), set_price: num(r.set_price), status: r.status || 'in_stock', location: r.location, source: r.source, has_image: !!r.has_image, age_days: ageOf(r), sku: r.sku, note: r.note })), null, 2), 'application/json')
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Stat label="มีของ (ชิ้น)" val={String(inStock.length)} color={GREEN} />
        <Stat label="มูลค่าสต็อก(ทุน)" val={baht(stockValue)} color="#854F0B" />
        <Stat label="ไม่มีรูป" val={String(noImage)} color="#0C447C" />
        <Stat label="ค้าง ≥365วัน" val={String(aged)} color="#A32D2D" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setShowAdd((v) => !v)} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{showAdd ? '× ปิดฟอร์ม' : '+ เพิ่มสต็อก'}</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา อะไหล่/รุ่น/ที่เก็บ/SKU" style={{ flex: 1, minWidth: 150, padding: '8px 11px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
        <select value={stF} onChange={(e) => setStF(e.target.value)} style={sel}><option value="">ทุกสถานะ</option>{STK_ORDER.map((s2) => <option key={s2} value={s2}>{STK[s2].th}</option>)}</select>
        <button onClick={exportCsv} style={qbtn}>⬇ CSV</button><button onClick={exportTxt} style={qbtn}>⬇ TXT</button><button onClick={exportJson} style={qbtn}>⬇ JSON</button>
      </div>
      {showAdd && (
        <form action={(fd) => onAdd(fd, () => setShowAdd(false))} style={{ ...card, padding: 12, border: '1px solid #e7e3d8' }}>
          <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8, fontSize: 14 }}>เพิ่มสต็อกใหม่</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={lbl}>ชื่ออะไหล่<input name="part_name" style={inp} placeholder="เช่น ไฟท้าย" /></label>
            <label style={lbl}>รุ่นรถ<input name="car_model" style={inp} placeholder="เช่น W124" /></label>
            <label style={lbl}>วันที่เข้าสต็อก<input name="date_in" type="date" defaultValue={todayStr()} style={inp} /></label>
            <label style={lbl}>SKU (ถ้ามี)<input name="sku" style={inp} placeholder="รหัส" /></label>
            <label style={lbl}>ต้นทุน (฿)<input name="cost" type="number" inputMode="numeric" style={inp} /></label>
            <label style={lbl}>ราคาขายตั้งไว้ (฿)<input name="set_price" type="number" inputMode="numeric" style={inp} /></label>
            <label style={lbl}>สถานะ<select name="status" defaultValue="in_stock" style={inp}>{STK_ORDER.map((s2) => <option key={s2} value={s2}>{STK[s2].th}</option>)}</select></label>
            <label style={lbl}>ตำแหน่งเก็บ<input name="location" style={inp} placeholder="เช่น ชั้น A-3" /></label>
            <label style={lbl}>แหล่งซื้อ<input name="source" style={inp} placeholder="ร้าน/ผู้นำเข้าที่ได้ของมา" /></label>
            <label style={lbl}>มีรูปหรือยัง<select name="has_image" defaultValue="false" style={inp}><option value="false">ยังไม่มีรูป</option><option value="true">มีรูปแล้ว</option></select></label>
            <label style={lbl}>หมายเหตุ<input name="note" style={inp} /></label>
          </div>
          <button type="submit" style={{ marginTop: 10, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>บันทึก</button>
        </form>
      )}
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>แสดง {filtered.length} / {rows.length} รายการ</div>
      {filtered.length === 0 && <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 24 }}>— ยังไม่มีสต็อก —</div>}
      {filtered.map((r) => {
        const open = openId === r.id, age = ageOf(r)
        return (
          <div key={r.id} style={card}>
            <div onClick={() => setOpenId(open ? null : r.id)} style={{ padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.part_name || '(ไม่ระบุ)'} {r.car_model ? `· ${r.car_model}` : ''}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!r.has_image && <Badge label="ไม่มีรูป" bg="#FCEBEB" fg="#A32D2D" />}
                  <Badge label={STK[r.status || 'in_stock']?.th} bg={STK[r.status || 'in_stock']?.bg} fg={STK[r.status || 'in_stock']?.fg} />
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>ทุน {baht(r.cost)} · ตั้งขาย {baht(r.set_price)}{r.location ? ` · 📍${r.location}` : ''}{r.source ? ` · 🏬 ${r.source}` : ''}</div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3 }}>เข้า {fmtDate(r.date_in)}{age !== null && <span style={{ color: age >= 365 ? '#A32D2D' : '#999' }}> · อายุ {age} วัน{age >= 365 ? ' (ค้างนาน)' : ''}</span>}{r.sku ? ` · ${r.sku}` : ''}</div>
            </div>
            {open && <StockEdit r={r} onSave={onSave} />}
          </div>
        )
      })}
    </>
  )
}
function StockEdit({ r, onSave }: { r: Row; onSave: (fd: FormData) => void }) {
  return (
    <form action={onSave} style={{ borderTop: '1px solid #eee', padding: 12, background: '#fbfaf6' }}>
      <input type="hidden" name="id" value={r.id} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {STK_ORDER.map((s2) => <button key={s2} type="submit" name="status" value={s2} style={{ ...qbtn, ...((r.status || 'in_stock') === s2 ? { background: STK[s2].bg, color: STK[s2].fg, borderColor: STK[s2].fg } : {}) }}>{STK[s2].th}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={lbl}>ต้นทุน<input name="cost" type="number" defaultValue={r.cost ?? ''} style={inp} /></label>
        <label style={lbl}>ราคาขายตั้งไว้<input name="set_price" type="number" defaultValue={r.set_price ?? ''} style={inp} /></label>
        <label style={lbl}>ตำแหน่งเก็บ<input name="location" defaultValue={r.location || ''} style={inp} /></label>
        <label style={lbl}>มีรูปหรือยัง<select name="has_image" defaultValue={r.has_image ? 'true' : 'false'} style={inp}><option value="false">ยังไม่มีรูป</option><option value="true">มีรูปแล้ว</option></select></label>
        <label style={lbl}>แหล่งซื้อ<input name="source" defaultValue={r.source || ''} style={inp} placeholder="ร้าน/ผู้นำเข้าที่ได้ของมา" /></label>
      </div>
      <label style={{ ...lbl, marginTop: 8 }}>หมายเหตุ<input name="note" defaultValue={r.note || ''} style={inp} /></label>
      <button type="submit" style={{ marginTop: 10, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>บันทึกการแก้ไข</button>
    </form>
  )
}
