'use client'
// app/ops-x7k2m9/brief/OpsBriefClient.tsx
// OpsBrief Private — dark executive command room (ไทย, iPad + desktop)
import { useMemo, useState, useTransition } from 'react'
import {
  createItem, updateItem, setItemStatus, archiveItem, deleteItem,
  addDecision, archiveDecision, deleteDecision, exportMarkdown, logout,
} from './actions'; import SalesPanel from './SalesPanel'; import SalesPanel from './SalesPanel'

type OpsData = { ok: boolean; items?: any[]; decisions?: any[]; error?: string }
type Item ={ id: string; module: string; title: string; detail: string | null; status: string; priority: string; archived: boolean; updated_at?: string }
type Decision = { id: string; decided_on: string; topic: string; reason: string | null; next_action: string | null; follow_up_date: string | null; archived: boolean }

const MODULES = [
  { key: 'dev',    label: 'Dev Control',           icon: '🛠️' },
  { key: 'social', label: 'Social Control',         icon: '📣' },
  { key: 'ebook',  label: 'eBook Sales Control',    icon: '📘' },
  { key: 'parts',  label: 'Premium Parts Control',  icon: '💎' },
  { key: 'tools',  label: 'Future Tools Pipeline',  icon: '🚀' },
] as const

const STATUS = [
  { key: 'todo',    label: 'รอทำ',     cls: 'bg-white/5 text-[#B8B3A7] border-white/15' },
  { key: 'doing',   label: 'กำลังทำ',  cls: 'bg-[#C9A961]/15 text-[#E7C977] border-[#C9A961]/40' },
  { key: 'waiting', label: 'รอข้อมูล', cls: 'bg-sky-500/10 text-sky-300 border-sky-400/30' },
  { key: 'done',    label: 'เสร็จ',    cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30' },
] as const

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS.map((s) => [s.key, s.label]))
const STATUS_CLS: Record<string, string> = Object.fromEntries(STATUS.map((s) => [s.key, s.cls]))
const PRIO_DOT: Record<string, string> = { low: '#5b6070', normal: '#8B7355', high: '#E0584F' }
const PRIO_LABEL: Record<string, string> = { low: 'ต่ำ', normal: 'ปกติ', high: 'สูง' }

function downloadMd(md: string) {
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `opsbrief-${new Date().toISOString().slice(0, 10)}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function OpsBriefClient({ initialItems, initialDecisions }: { initialItems: Item[]; initialDecisions: Decision[] }) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [decisions, setDecisions] = useState<Decision[]>(initialDecisions)
  const [showArchived, setShowArchived] = useState(false)
  const [pending, startTransition] = useTransition()
  const [editId, setEditId] = useState<string | null>(null)

  function apply(res: OpsData) {
    if (res.ok) {
      setItems((res.items as Item[]) || [])
      setDecisions((res.decisions as Decision[]) || [])
    } else if (res.error === 'unauthorized') {
      location.reload()
    }
  }
  const run = (fn: () => Promise<OpsData>) => startTransition(async () => apply(await fn()))

  const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const visible = useMemo(() => items.filter((i) => showArchived || !i.archived), [items, showArchived])
  const kpi = useMemo(() => {
    const act = items.filter((i) => !i.archived)
    return {
      open: act.filter((i) => i.status !== 'done').length,
      doing: act.filter((i) => i.status === 'doing').length,
      high: act.filter((i) => i.priority === 'high' && i.status !== 'done').length,
      done: act.filter((i) => i.status === 'done').length,
    }
  }, [items])

  async function doExport() {
    const res = await exportMarkdown()
    if (res.ok && res.md) downloadMd(res.md)
    else if (res.error === 'unauthorized') location.reload()
  }
  async function doLogout() {
    await logout()
    location.reload()
  }

  return (
    <div className="min-h-screen bg-[#0B0C14] text-[#E7E3D8]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">

        {/* HEADER */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <p className="text-[10px] tracking-[0.34em] text-[#C9A961] mb-1">PRIVATE · COMMAND ROOM</p>
            <h1 className="text-2xl md:text-3xl font-serif font-medium text-white">OpsBrief</h1>
            <p className="text-xs text-[#7c8090] mt-1">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[#9ba0b0] cursor-pointer select-none mr-1">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[#C9A961]" />
              แสดงที่เก็บถาวร
            </label>
            <button onClick={doExport} className="bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] text-xs font-semibold px-3 py-2 rounded-lg transition-colors">⬇ Export .md</button>
            <button onClick={doLogout} className="border border-white/15 hover:bg-white/5 text-[#B8B3A7] text-xs px-3 py-2 rounded-lg transition-colors">ออกจากระบบ</button>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          <Kpi label="งานค้างทั้งหมด" value={kpi.open} accent="#E7E3D8" />
          <Kpi label="กำลังทำ" value={kpi.doing} accent="#E7C977" />
          <Kpi label="สำคัญสูง (ค้าง)" value={kpi.high} accent="#E0584F" />
          <Kpi label="เสร็จแล้ว" value={kpi.done} accent="#6ee7a8" />
        </div>

        {/* MODULES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {MODULES.map((m) => (
            <ModuleCard
              key={m.key}
              module={m}
              items={visible.filter((i) => i.module === m.key)}
              pending={pending}
              editId={editId}
              setEditId={setEditId}
              onAdd={(title) => run(() => createItem({ module: m.key, title }))}
              onStatus={(id, s) => run(() => setItemStatus(id, s))}
              onArchive={(id, a) => run(() => archiveItem(id, a))}
              onDelete={(id) => run(() => deleteItem(id))}
              onSave={(id, p) => { setEditId(null); run(() => updateItem({ id, ...p })) }}
            />
          ))}

          {/* DECISION LOG */}
          <DecisionCard
            decisions={decisions.filter((d) => showArchived || !d.archived)}
            pending={pending}
            onAdd={(p) => run(() => addDecision(p))}
            onArchive={(id, a) => run(() => archiveDecision(id, a))}
            onDelete={(id) => run(() => deleteDecision(id))}
          />
        </div>

        <p className="text-[11px] text-[#5b6070] text-center mt-6">OpsBrief Private · ใช้ภายในเท่านั้น · ข้อมูลเก็บบน Supabase</p>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3">
      <div className="text-2xl font-semibold" style={{ color: accent }}>{value}</div>
      <div className="text-[11px] text-[#7c8090] mt-0.5">{label}</div>
    </div>
  )
}

function ModuleCard({
  module, items, pending, editId, setEditId, onAdd, onStatus, onArchive, onDelete, onSave,
}: {
  module: { key: string; label: string; icon: string }
  items: Item[]
  pending: boolean
  editId: string | null
  setEditId: (id: string | null) => void
  onAdd: (title: string) => void
  onStatus: (id: string, s: string) => void
  onArchive: (id: string, a: boolean) => void
  onDelete: (id: string) => void
  onSave: (id: string, patch: { title: string; detail: string; priority: string }) => void
}) {
  const [draft, setDraft] = useState('')
  const submit = () => { const t = draft.trim(); if (!t) return; onAdd(t); setDraft('') }

  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>{module.icon}</span>{module.label}
        </h2>
        <span className="text-[11px] text-[#7c8090]">{items.length} รายการ</span>
      </div>

      <div className="space-y-2 flex-1">
        {items.length === 0 && <p className="text-xs text-[#5b6070] py-4 text-center">— ว่าง —</p>}
        {items.map((it) =>
          editId === it.id ? (
            <EditRow key={it.id} item={it} onCancel={() => setEditId(null)} onSave={(p) => onSave(it.id, p)} />
          ) : (
            <ItemRow key={it.id} item={it} pending={pending} onStatus={onStatus} onArchive={onArchive} onDelete={onDelete} onEdit={() => setEditId(it.id)} />
          )
        )}
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder={`+ เพิ่มใน ${module.label}`}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none"
        />
        <button onClick={submit} disabled={pending} className="bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-50 text-[#1C1D2C] text-xs font-semibold px-3 rounded-lg transition-colors">เพิ่ม</button>
      </div>
    </section>
  )
}

function ItemRow({
  item, pending, onStatus, onArchive, onDelete, onEdit,
}: {
  item: Item; pending: boolean
  onStatus: (id: string, s: string) => void
  onArchive: (id: string, a: boolean) => void
  onDelete: (id: string) => void
  onEdit: () => void
}) {
  return (
    <div className={`group rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 ${item.archived ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PRIO_DOT[item.priority] }} title={`สำคัญ: ${PRIO_LABEL[item.priority]}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm text-[#E7E3D8] ${item.status === 'done' ? 'text-[#7c8090]' : ''}`}>{item.title}</div>
          {item.detail && <div className="text-[11px] text-[#8a8f9f] mt-0.5 leading-snug">{item.detail}</div>}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <select
              value={item.status}
              disabled={pending}
              onChange={(e) => onStatus(item.id, e.target.value)}
              className={`text-[10px] px-1.5 py-0.5 rounded border bg-transparent cursor-pointer focus:outline-none ${STATUS_CLS[item.status] || ''}`}
            >
              {STATUS.map((s) => <option key={s.key} value={s.key} className="bg-[#15172A] text-white">{s.label}</option>)}
            </select>
            <button onClick={onEdit} className="text-[10px] text-[#7c8090] hover:text-[#C9A961] px-1">แก้ไข</button>
            <button onClick={() => onArchive(item.id, !item.archived)} className="text-[10px] text-[#7c8090] hover:text-sky-300 px-1">{item.archived ? 'กู้คืน' : 'เก็บถาวร'}</button>
            <button onClick={() => { if (confirm('ลบรายการนี้ถาวร?')) onDelete(item.id) }} className="text-[10px] text-[#7c8090] hover:text-red-400 px-1">ลบ</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditRow({ item, onCancel, onSave }: { item: Item; onCancel: () => void; onSave: (p: { title: string; detail: string; priority: string }) => void }) {
  const [title, setTitle] = useState(item.title)
  const [detail, setDetail] = useState(item.detail || '')
  const [priority, setPriority] = useState(item.priority)
  return (
    <div className="rounded-lg border border-[#C9A961]/40 bg-white/[0.04] px-3 py-2.5 space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-[#C9A961] focus:outline-none" />
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="รายละเอียด (ถ้ามี)" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none resize-none" />
      <div className="flex items-center justify-between gap-2">
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none">
          <option value="low" className="bg-[#15172A]">สำคัญ: ต่ำ</option>
          <option value="normal" className="bg-[#15172A]">สำคัญ: ปกติ</option>
          <option value="high" className="bg-[#15172A]">สำคัญ: สูง</option>
        </select>
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs text-[#7c8090] hover:text-white px-2 py-1">ยกเลิก</button>
          <button onClick={() => { if (title.trim()) onSave({ title: title.trim(), detail: detail.trim(), priority }) }} className="bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] text-xs font-semibold px-3 py-1 rounded">บันทึก</button>
        </div>
      </div>
    </div>
  )
}

function DecisionCard({
  decisions, pending, onAdd, onArchive, onDelete,
}: {
  decisions: Decision[]; pending: boolean
  onAdd: (p: { topic: string; reason: string; next_action: string; follow_up_date?: string }) => void
  onArchive: (id: string, a: boolean) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [reason, setReason] = useState('')
  const [next, setNext] = useState('')
  const [follow, setFollow] = useState('')

  const submit = () => {
    if (!topic.trim()) return
    onAdd({ topic: topic.trim(), reason: reason.trim(), next_action: next.trim(), follow_up_date: follow || undefined })
    setTopic(''); setReason(''); setNext(''); setFollow(''); setOpen(false)
  }

  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col lg:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><span>🧭</span>Decision Log</h2>
        <button onClick={() => setOpen((v) => !v)} className="text-[11px] text-[#C9A961] hover:text-[#D8B872]">{open ? 'ปิด' : '+ บันทึกการตัดสินใจ'}</button>
      </div>

      {open && (
        <div className="rounded-lg border border-[#C9A961]/40 bg-white/[0.04] p-3 space-y-2 mb-3">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="เรื่องที่ตัดสินใจ *" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="เหตุผล" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none resize-none" />
          <input value={next} onChange={(e) => setNext(e.target.value)} placeholder="next action" className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] text-[#7c8090] flex items-center gap-2">
              ตามผลวันที่
              <input type="date" value={follow} onChange={(e) => setFollow(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none" />
            </label>
            <button onClick={submit} disabled={pending} className="bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-50 text-[#1C1D2C] text-xs font-semibold px-3 py-1.5 rounded">บันทึก</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {decisions.length === 0 && <p className="text-xs text-[#5b6070] py-4 text-center">— ยังไม่มีบันทึกการตัดสินใจ —</p>}
        {decisions.map((d) => (
          <div key={d.id} className={`rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 ${d.archived ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{d.topic}</div>
                {d.reason && <div className="text-[11px] text-[#8a8f9f] mt-0.5">เหตุผล: {d.reason}</div>}
                {d.next_action && <div className="text-[11px] text-[#9ba0b0] mt-0.5">→ {d.next_action}</div>}
                <div className="text-[10px] text-[#5b6070] mt-1">
                  {d.decided_on}{d.follow_up_date ? ` · ตามผล ${d.follow_up_date}` : ''}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => onArchive(d.id, !d.archived)} className="text-[10px] text-[#7c8090] hover:text-sky-300">{d.archived ? 'กู้คืน' : 'เก็บ'}</button>
                <button onClick={() => { if (confirm('ลบการตัดสินใจนี้ถาวร?')) onDelete(d.id) }} className="text-[10px] text-[#7c8090] hover:text-red-400">ลบ</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
