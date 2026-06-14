'use client'
// app/ops-x7k2m9/brief/SalesPanel.tsx
// Phase B — eBook leads + orders จริง + ติดตามสถานะการขาย (โหลดข้อมูลเอง)
// + test data: ซ่อนโดย default, มี badge TEST, ไม่นับใน revenue
import { useEffect, useState, useTransition } from 'react'
import { loadSales, setSaleStatus, type SalesData } from './actions-sales'

const SSTATUS = [
  { key: 'new',             label: 'ใหม่',        cls: 'bg-white/5 text-[#B8B3A7] border-white/15' },
  { key: 'contacted',       label: 'ติดต่อแล้ว',  cls: 'bg-sky-500/10 text-sky-300 border-sky-400/30' },
  { key: 'waiting_payment', label: 'รอชำระเงิน',  cls: 'bg-amber-500/10 text-amber-300 border-amber-400/30' },
  { key: 'paid',            label: 'ชำระแล้ว',    cls: 'bg-[#C9A961]/15 text-[#E7C977] border-[#C9A961]/40' },
  { key: 'file_sent',       label: 'ส่งไฟล์แล้ว', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30' },
  { key: 'follow_up',       label: 'ติดตามต่อ',   cls: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/30' },
] as const
const SCLS: Record<string, string> = Object.fromEntries(SSTATUS.map((s) => [s.key, s.cls]))
const baht = (n: number) => new Intl.NumberFormat('th-TH').format(n || 0)
const fmt = (d: string) => { try { return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) } catch { return '' } }

export default function SalesPanel() {
  const [data, setData] = useState<SalesData | null>(null)
  const [pending, startTransition] = useTransition()
  const [showTest, setShowTest] = useState(false)

  function apply(res: SalesData) {
    if (res.ok) setData(res)
    else if (res.error === 'unauthorized') location.reload()
  }
  useEffect(() => { startTransition(async () => apply(await loadSales())) }, [])

  const save = (ref_type: string, ref_id: string, patch: { status: string; amount: any; note: string }) =>
    startTransition(async () => apply(await setSaleStatus({ ref_type, ref_id, ...patch })))

  const allLeads = data?.leads ?? []
  const allOrders = data?.orders ?? []
  const leads = allLeads.filter((l) => showTest || !l.is_test)
  const orders = allOrders.filter((o) => showTest || !o.is_test)
  const testCount = allLeads.filter((l) => l.is_test).length + allOrders.filter((o) => o.is_test).length
  const rev = data?.revenue

  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><span>💰</span>eBook Leads &amp; Orders (ข้อมูลจริง)</h2>
        <div className="flex items-center gap-3">
          {testCount > 0 && (
            <label className="flex items-center gap-1.5 text-[11px] text-[#9ba0b0] cursor-pointer select-none">
              <input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} className="accent-[#C9A961]" />
              แสดง test ({testCount})
            </label>
          )}
          <span className="text-[11px] text-[#7c8090]">{pending ? 'กำลังโหลด…' : `lead ${leads.length} · order ${orders.length}`}</span>
        </div>
      </div>

      {/* สรุปรายได้ eBook (ไม่รวม test) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
          <div className="text-lg font-semibold text-[#E7C977]">฿{baht(rev?.total || 0)}</div>
          <div className="text-[10px] text-[#7c8090]">รายได้ eBook (ชำระแล้ว · ไม่รวม test)</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
          <div className="text-lg font-semibold text-emerald-300">{rev?.paidCount || 0}</div>
          <div className="text-[10px] text-[#7c8090]">รายการที่ปิดการขาย</div>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
          <div className="text-lg font-semibold text-[#E7E3D8]">{leads.length}</div>
          <div className="text-[10px] text-[#7c8090]">eBook leads {showTest ? 'ทั้งหมด' : '(จริง)'}</div>
        </div>
      </div>

      {/* eBook leads */}
      <h3 className="text-xs font-semibold text-[#9ba0b0] mb-2">📘 eBook Leads (topic=ebook)</h3>
      <div className="space-y-2 mb-4">
        {leads.length === 0 && <p className="text-xs text-[#5b6070] py-3 text-center">— ยังไม่มี lead —</p>}
        {leads.map((r) => <SaleRow key={`lead-${r.ref_id}`} r={r} pending={pending} onSave={save} amountHint="199 / 349" />)}
      </div>

      {/* orders */}
      <h3 className="text-xs font-semibold text-[#9ba0b0] mb-2">🛒 Orders (ตะกร้า/อะไหล่)</h3>
      <div className="space-y-2">
        {orders.length === 0 && <p className="text-xs text-[#5b6070] py-3 text-center">— ยังไม่มี order —</p>}
        {orders.map((r) => <SaleRow key={`order-${r.ref_id}`} r={r} pending={pending} onSave={save} amountHint={String(r.subtotal || '')} />)}
      </div>
    </section>
  )
}

function SaleRow({ r, pending, onSave, amountHint }: { r: any; pending: boolean; onSave: (t: string, id: string, p: { status: string; amount: any; note: string }) => void; amountHint?: string }) {
  const [status, setStatus] = useState(r.status)
  const [amount, setAmount] = useState<string>(r.amount == null ? '' : String(r.amount))
  const [note, setNote] = useState(r.note || '')
  const dirty = status !== r.status || (amount === '' ? r.amount != null : Number(amount) !== r.amount) || note !== (r.note || '')

  return (
    <div className={`rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 ${r.is_test ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-sm text-[#E7E3D8] truncate">
            {r.is_test && <span className="text-[9px] font-bold tracking-wide mr-1.5 px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-400/30 align-middle">TEST</span>}
            {r.title} <span className="text-[11px] text-[#7c8090]">· {r.contact}</span>
          </div>
          {r.detail && <div className="text-[11px] text-[#8a8f9f] mt-0.5 line-clamp-2">{r.detail}</div>}
        </div>
        <span className="text-[10px] text-[#5b6070] shrink-0">{fmt(r.created_at)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`text-[10px] px-1.5 py-0.5 rounded border bg-transparent focus:outline-none ${SCLS[status] || ''}`}>
          {SSTATUS.map((s) => <option key={s.key} value={s.key} className="bg-[#15172A] text-white">{s.label}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder={amountHint ? `฿ ${amountHint}` : '฿'} inputMode="numeric"
          className="w-20 text-[11px] bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="โน้ต"
          className="flex-1 min-w-[120px] text-[11px] bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <button disabled={pending || !dirty} onClick={() => onSave(r.ref_type, r.ref_id, { status, amount, note })}
          className="text-[10px] font-semibold px-2.5 py-1 rounded bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-40 text-[#1C1D2C]">บันทึก</button>
      </div>
    </div>
  )
}
