'use client'
// app/ops-x7k2m9/ledger/LedgerClient.tsx — Core Ledger P0 (ฐานข้อมูลกลาง)
// 2 แท็บ: Sales Record (ขายจริง+กำไร) · Stock Record (สต็อก+อายุ) · add/edit/filter/export · ไม่ลบ (ใช้ status)
// P3.3: เพิ่มช่อง "แหล่งซื้อ" (stock_records.source) — ฟอร์มเพิ่ม/แก้ + การ์ด + export
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

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

export default function LedgerClient({ sales, stock, addSale, updateSale, addStock, updateStock }:
  { sales: Row[]; stock: Row[]; addSale: (fd: FormData) => Promise<void>; updateSale: (fd: FormData) => Promise<void>; addStock: (fd: FormData) => Promise<void>; updateStock: (fd: FormData) => Promise<void> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [tab, setTab] = useState<'sales' | 'stock'>('sales')
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600) }

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
        {([['sales', `Sales Record (${sales.length})`], ['stock', `Stock Record (${stock.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: `1px solid ${tab === k ? GREEN : '#ddd'}`, background: tab === k ? GREEN : '#fff', color: tab === k ? '#fff' : GREEN, borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
        ))}
        {pending && <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>กำลังบันทึก…</span>}
      </div>

      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {tab === 'sales'
          ? <SalesTab rows={sales} onAdd={(fd, d) => submit(addSale, fd, 'บันทึกการขายแล้ว', d)} onSave={(fd) => submit(updateSale, fd, 'อัปเดตแล้ว')} flash={flash} />
          : <StockTab rows={stock} onAdd={(fd, d) => submit(addStock, fd, 'บันทึกสต็อกแล้ว', d)} onSave={(fd) => submit(updateStock, fd, 'อัปเดตแล้ว')} flash={flash} />}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}

function Stat({ label, val, color }: { label: string; val: string; color: string }) {
  return <div style={{ flex: 1, minWidth: 90, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
    <div style={{ fontSize: 19, fontWeight: 700, color }}>{val}</div><div style={{ fontSize: 11, color: '#777' }}>{label}</div></div>
}

/* ===================== SALES ===================== */
function
