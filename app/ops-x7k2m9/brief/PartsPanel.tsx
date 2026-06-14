'use client'
// app/ops-x7k2m9/brief/PartsPanel.tsx
// Phase D — Premium Parts Pipeline (อะไหล่พรีเมียม, จัดกลุ่มตามสถานะ)
// + กรอก/แก้ URL เว็บสินค้า inline ได้ทันที + ลิงก์ 🔗 เปิดหน้าสินค้า
import { useEffect, useState, useTransition } from 'react'
import { loadParts, createPart, updatePart, setPartStatus, deletePart, type PartsData } from './actions-parts'

const PSTATUS = [
  { key: 'not_uploaded', label: 'ยังไม่ขึ้นเว็บ' },
  { key: 'uploaded',     label: 'ขึ้นเว็บแล้ว' },
  { key: 'posted',       label: 'โพสต์แล้ว' },
  { key: 'inquiry',      label: 'มีลูกค้าถาม' },
  { key: 'negotiating',  label: 'กำลังต่อรอง' },
  { key: 'sold',         label: 'ขายแล้ว' },
  { key: 'needs_photo',  label: 'ต้องถ่ายรูป' },
  { key: 'needs_detail', label: 'ต้องเติมรายละเอียด' },
] as const

const GROUPS = [
  { label: '① ยังไม่ขึ้นเว็บ',            test: (s: string) => s === 'not_uploaded' },
  { label: '② ขึ้นเว็บแล้ว ยังไม่โพสต์',   test: (s: string) => s === 'uploaded' },
  { label: '③ โพสต์แล้ว รอติดตาม',        test: (s: string) => s === 'posted' },
  { label: '④ มีลูกค้าถาม / ต่อรอง',       test: (s: string) => s === 'inquiry' || s === 'negotiating' },
  { label: '⑤ ต้องถ่ายรูป / เติมรายละเอียด', test: (s: string) => s === 'needs_photo' || s === 'needs_detail' },
  { label: '✓ ขายแล้ว',                   test: (s: string) => s === 'sold' },
]
const baht = (n: any) => (n == null ? '—' : '฿' + new Intl.NumberFormat('th-TH').format(Number(n) || 0))

export default function PartsPanel() {
  const [data, setData] = useState<PartsData | null>(null)
  const [pending, startTransition] = useTransition()
  const [editId, setEditId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [model, setModel] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')

  function apply(res: PartsData) {
    if (res.ok) setData(res)
    else if (res.error === 'unauthorized') location.reload()
  }
  const run = (fn: () => Promise<PartsData>) => startTransition(async () => apply(await fn()))
  useEffect(() => { run(loadParts) }, [])

  const add = () => {
    if (!title.trim()) return
    run(() => createPart({ title, model, price, stock }))
    setTitle(''); setModel(''); setPrice(''); setStock('')
  }

  const parts = data?.parts ?? []

  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><span>💎</span>Premium Parts Pipeline</h2>
        <span className="text-[11px] text-[#7c8090]">{pending ? 'กำลังโหลด…' : `${parts.length} ชิ้น`}</span>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ชื่อสินค้า *" className="col-span-2 text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="รุ่น เช่น W140" className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <div className="flex gap-1.5">
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="ราคา" inputMode="numeric" className="w-1/2 text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
          <input value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ''))} placeholder="จำนวน" inputMode="numeric" className="w-1/2 text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        </div>
        <button onClick={add} disabled={pending} className="col-span-2 sm:col-span-4 text-xs font-semibold py-1.5 rounded bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-40 text-[#1C1D2C]">+ เพิ่มสินค้าพรีเมียม</button>
      </div>

      <div className="space-y-4">
        {GROUPS.map((g) => {
          const rows = parts.filter((p) => g.test(p.status))
          return (
            <div key={g.label}>
              <h3 className="text-xs font-semibold text-[#9ba0b0] mb-2">{g.label} <span className="text-[#5b6070]">({rows.length})</span></h3>
              <div className="space-y-2">
                {rows.length === 0 && <p className="text-[11px] text-[#5b6070] pl-1">—</p>}
                {rows.map((p) =>
                  editId === p.id
                    ? <PartEdit key={p.id} p={p} onCancel={() => setEditId(null)} onSave={(patch) => { setEditId(null); run(() => updatePart({ id: p.id, ...patch })) }} />
                    : <PartRow key={p.id} p={p} pending={pending} onStatus={(s) => run(() => setPartStatus(p.id, s))} onSavePatch={(patch) => run(() => updatePart({ id: p.id, ...patch }))} onEdit={() => setEditId(p.id)} onDelete={() => run(() => deletePart(p.id))} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PartRow({ p, pending, onStatus, onSavePatch, onEdit, onDelete }: { p: any; pending: boolean; onStatus: (s: string) => void; onSavePatch: (patch: any) => void; onEdit: () => void; onDelete: () => void }) {
  const [inq, setInq] = useState(p.inquiry_note || '')
  const [web, setWeb] = useState(p.website_url || '')
  const dirty = inq !== (p.inquiry_note || '') || web !== (p.website_url || '')
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-sm text-[#E7E3D8]">
            {p.model && <span className="text-[10px] text-[#C9A961] mr-1.5">[{p.model}]</span>}{p.title}
          </div>
          <div className="text-[11px] text-[#8a8f9f] mt-0.5">
            {p.condition && <span>{p.condition} · </span>}{baht(p.price)}{p.stock != null && <span> · เหลือ {p.stock}</span>}{p.sku && <span> · {p.sku}</span>}
          </div>
          {p.fitment_note && <div className="text-[10px] text-[#7c8090] mt-0.5">⚙ {p.fitment_note}</div>}
          <div className="flex gap-3 mt-0.5">
            {p.website_url
              ? <a href={p.website_url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-300 hover:underline">🔗 เปิดหน้าสินค้า</a>
              : <span className="text-[10px] text-[#5b6070]">🔗 ยังไม่ได้ใส่ URL เว็บ</span>}
            {p.social_url && <a href={p.social_url} target="_blank" rel="noreferrer" className="text-[10px] text-[#9ba0b0] hover:underline">↗ โพสต์</a>}
          </div>
        </div>
        <select value={p.status} disabled={pending} onChange={(e) => onStatus(e.target.value)} className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 bg-transparent text-[#E7E3D8] focus:outline-none shrink-0">
          {PSTATUS.map((s) => <option key={s.key} value={s.key} className="bg-[#15172A] text-white">{s.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <input value={web} onChange={(e) => setWeb(e.target.value)} placeholder="URL เว็บสินค้า (วางลิงก์หน้าสินค้า)" className="flex-1 min-w-[160px] text-[11px] bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <input value={inq} onChange={(e) => setInq(e.target.value)} placeholder="โน้ตลูกค้าถาม / ติดตาม" className="flex-1 min-w-[140px] text-[11px] bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <button disabled={pending || !dirty} onClick={() => onSavePatch({ website_url: web, inquiry_note: inq })} className="text-[10px] font-semibold px-2.5 py-1 rounded bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-40 text-[#1C1D2C]">บันทึก</button>
        <button onClick={onEdit} className="text-[10px] text-[#7c8090] hover:text-[#C9A961] px-1">แก้</button>
        <button onClick={() => { if (confirm('ลบสินค้านี้?')) onDelete() }} className="text-[10px] text-[#7c8090] hover:text-red-400 px-1">ลบ</button>
      </div>
    </div>
  )
}

function PartEdit({ p, onCancel, onSave }: { p: any; onCancel: () => void; onSave: (patch: any) => void }) {
  const [f, setF] = useState({
    title: p.title || '', model: p.model || '', sku: p.sku || '', condition: p.condition || '',
    price: p.price == null ? '' : String(p.price), stock: p.stock == null ? '' : String(p.stock),
    website_url: p.website_url || '', social_url: p.social_url || '', fitment_note: p.fitment_note || '',
  })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))
  const inp = 'text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none'
  return (
    <div className="rounded-lg border border-[#C9A961]/40 bg-white/[0.04] p-3 space-y-2">
      <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="ชื่อสินค้า" className={`w-full ${inp}`} />
      <div className="grid grid-cols-2 gap-2">
        <input value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="รุ่น" className={inp} />
        <input value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="SKU / OEM" className={inp} />
        <input value={f.condition} onChange={(e) => set('condition', e.target.value)} placeholder="สภาพ" className={`col-span-2 ${inp}`} />
        <input value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^0-9]/g, ''))} placeholder="ราคา" inputMode="numeric" className={inp} />
        <input value={f.stock} onChange={(e) => set('stock', e.target.value.replace(/[^0-9]/g, ''))} placeholder="จำนวน" inputMode="numeric" className={inp} />
        <input value={f.website_url} onChange={(e) => set('website_url', e.target.value)} placeholder="URL เว็บ" className={`col-span-2 ${inp}`} />
        <input value={f.social_url} onChange={(e) => set('social_url', e.target.value)} placeholder="URL โพสต์ social" className={`col-span-2 ${inp}`} />
        <input value={f.fitment_note} onChange={(e) => set('fitment_note', e.target.value)} placeholder="fitment note (ความเข้ากันได้)" className={`col-span-2 ${inp}`} />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-[#7c8090] hover:text-white px-2 py-1">ยกเลิก</button>
        <button onClick={() => { if (f.title.trim()) onSave(f) }} className="bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] text-xs font-semibold px-3 py-1 rounded">บันทึก</button>
      </div>
    </div>
  )
}
