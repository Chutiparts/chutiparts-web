'use client'
// app/ops-x7k2m9/sell/SellClient.tsx — ฟอร์มขายฝั่งทีม (team-safe: ไม่มีทุน/กำไรทุกที่)
// เลือก SKU (ค้นด้วยชื่อ) → จำนวน → ราคา/ชิ้น (read-only จาก stock) → รวมโชว์อัตโนมัติ → ลูกค้า → ผู้ขาย → บันทึก
// ค้างชำระ = บังคับระบุผู้ขาย · ราคาแก้ไม่ได้ (กันลดราคาเอง) · server เป็นคนคำนวณ/ตัดสต็อกจริง
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Opt = { sku: string; part_name: string; car_model: string; set_price: number | null; left: number }
type Sale = { part_sold: string | null; car_model: string | null; customer: string | null; qty: number; total: number; sold_by: string | null; payment_status: string }
const GREEN = '#17301F', CREAM = '#F4EFE4'
const baht = (v: number) => '฿' + (Number(v) || 0).toLocaleString()
const lbl: React.CSSProperties = { fontSize: 12, color: '#666', fontWeight: 600, display: 'block' }
const inp: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginTop: 4, boxSizing: 'border-box' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, marginBottom: 8, padding: 12 }

export default function SellClient({ stockOpts, todaySales, addTeamSale }: { stockOpts: Opt[]; todaySales: Sale[]; addTeamSale: (fd: FormData) => Promise<{ ok: boolean; msg: string }> }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ sku: '', qty: '1', customer: '', sold_by: '', payment_status: 'paid' })
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const bySku = useMemo(() => { const m: Record<string, Opt> = {}; stockOpts.forEach((o) => { m[o.sku.toUpperCase()] = o }); return m }, [stockOpts])
  const sel = bySku[f.sku.trim().toUpperCase()]
  const unit = sel?.set_price ?? null
  const qtyN = Math.max(1, Math.floor(Number(f.qty) || 1))
  const total = unit != null ? unit * qtyN : null

  function submit() {
    if (!sel) { setToast({ ok: false, msg: 'กรุณาเลือก SKU จากรายการ' }); return }
    if (unit == null || unit <= 0) { setToast({ ok: false, msg: 'สินค้านี้ยังไม่ตั้งราคา — แจ้งเจ้าของ' }); return }
    if (f.payment_status === 'unpaid' && !f.sold_by.trim()) { setToast({ ok: false, msg: 'ค้างชำระต้องระบุผู้ขาย' }); return }
    const fd = new FormData()
    fd.set('sku', sel.sku); fd.set('qty', String(qtyN)); fd.set('customer', f.customer); fd.set('sold_by', f.sold_by); fd.set('payment_status', f.payment_status)
    start(async () => {
      const r = await addTeamSale(fd)
      setToast(r)
      if (r.ok) { setF({ sku: '', qty: '1', customer: '', sold_by: '', payment_status: 'paid' }); router.refresh() }
      setTimeout(() => setToast(null), 2800)
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>🧾 ขายออก — ลงขายอะไหล่</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>เลือกอะไหล่ → จำนวน → ลูกค้า → บันทึก · ระบบตัดสต็อกให้อัตโนมัติ · {new Date().toLocaleDateString('th-TH')}</div>
      </div>

      <div style={{ padding: 12, maxWidth: 720, margin: '0 auto' }}>
        <datalist id="sellsku">{stockOpts.map((o) => <option key={o.sku} value={o.sku}>{o.sku} · {o.part_name}{o.car_model ? ' · ' + o.car_model : ''} · เหลือ {o.left}</option>)}</datalist>

        <div style={{ ...card, padding: 14 }}>
          <div style={{ fontWeight: 700, color: GREEN, marginBottom: 4, fontSize: 15 }}>บันทึกการขาย</div>
          <div style={{ fontSize: 11.5, color: '#888', marginBottom: 10 }}>💡 พิมพ์ชื่ออะไหล่หรือรหัสในช่องแรก แล้วเลือก · ราคาระบบดึงให้ (แก้ไม่ได้)</div>

          <label style={lbl}>อะไหล่ (พิมพ์ชื่อ/รหัส แล้วเลือก)
            <input list="sellsku" value={f.sku} onChange={(e) => setF((p) => ({ ...p, sku: e.target.value }))} style={inp} placeholder='เช่น "กันชน" หรือ 140-003' />
          </label>

          {f.sku.trim() && !sel && <div style={{ fontSize: 12, color: '#A32D2D', marginTop: 6 }}>⚠️ ยังไม่ตรงรายการ — เลือกจากที่ระบบขึ้นให้</div>}
          {sel && (
            <div style={{ marginTop: 8, background: '#F1EFE8', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
              <b>{sel.part_name || sel.sku}</b>{sel.car_model ? ` · ${sel.car_model}` : ''} · คงเหลือ <b style={{ color: sel.left <= 0 ? '#A32D2D' : GREEN }}>{sel.left}</b> ชิ้น
              {sel.left <= 0 && <span style={{ color: '#A32D2D' }}> (หมดสต็อก — เช็คก่อนขาย)</span>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <label style={lbl}>จำนวน (ชิ้น)
              <input type="number" min={1} inputMode="numeric" value={f.qty} onChange={(e) => setF((p) => ({ ...p, qty: e.target.value }))} style={inp} />
            </label>
            <label style={lbl}>ราคา/ชิ้น (ระบบตั้ง · แก้ไม่ได้)
              <input value={unit != null ? baht(unit) : '—'} readOnly disabled style={{ ...inp, background: '#f3f1ea', color: '#555' }} />
            </label>
            <label style={lbl}>ลูกค้า
              <input value={f.customer} onChange={(e) => setF((p) => ({ ...p, customer: e.target.value }))} style={inp} placeholder="ชื่อลูกค้า (ถ้ามี)" />
            </label>
            <label style={lbl}>ผู้ขาย (พนักงาน){f.payment_status === 'unpaid' && <span style={{ color: '#A32D2D' }}> *จำเป็น</span>}
              <input value={f.sold_by} onChange={(e) => setF((p) => ({ ...p, sold_by: e.target.value }))} style={inp} placeholder="ชื่อคนขาย" />
            </label>
            <label style={lbl}>สถานะเงิน
              <select value={f.payment_status} onChange={(e) => setF((p) => ({ ...p, payment_status: e.target.value }))} style={inp}>
                <option value="paid">ชำระแล้ว</option>
                <option value="unpaid">ค้างชำระ</option>
              </select>
            </label>
            <div style={{ alignSelf: 'end' }}>
              <div style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>รวมทั้งรายการ</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: GREEN, marginTop: 2 }}>{total != null ? baht(total) : '—'}</div>
            </div>
          </div>

          {f.payment_status === 'unpaid' && <div style={{ fontSize: 11.5, color: '#854F0B', marginTop: 8, background: '#FAEEDA', borderRadius: 8, padding: '7px 10px' }}>⚠️ ค้างชำระ: ผู้ขายที่ระบุต้องรับผิดชอบนำเงินเข้าบัญชี</div>}

          <button onClick={submit} disabled={pending} style={{ marginTop: 12, width: '100%', background: pending ? '#889' : GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700, cursor: pending ? 'default' : 'pointer' }}>
            {pending ? 'กำลังบันทึก…' : '💾 บันทึกการขาย'}
          </button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, margin: '14px 4px 8px' }}>ขายวันนี้ ({todaySales.length})</div>
        {todaySales.length === 0 && <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 20 }}>— ยังไม่มีรายการขายวันนี้ —</div>}
        {todaySales.map((s, i) => (
          <div key={i} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.part_sold || 'อะไหล่'}{s.car_model ? ` · ${s.car_model}` : ''} × {s.qty}</div>
              <div style={{ fontWeight: 700, color: GREEN }}>{baht(s.total)}</div>
            </div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>
              {s.customer ? `ลูกค้า: ${s.customer} · ` : ''}{s.sold_by ? `ผู้ขาย: ${s.sold_by} · ` : ''}
              <span style={{ color: s.payment_status === 'unpaid' ? '#A32D2D' : '#0F6E56' }}>{s.payment_status === 'unpaid' ? 'ค้างชำระ' : 'ชำระแล้ว ✓'}</span>
            </div>
          </div>
        ))}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? GREEN : '#A32D2D', color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, zIndex: 20, maxWidth: '90%' }}>{toast.msg}</div>}
    </div>
  )
}
