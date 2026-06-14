'use client'
// app/ops-x7k2m9/brief/SocialPanel.tsx
// Phase C — Social Command (โพสต์ FB Page/Group, ผูก URL เว็บ, สถานะ, next action)
import { useEffect, useState, useTransition } from 'react'
import { loadSocial, createSocial, updateSocial, setSocialStatus, deleteSocial, type SocialData } from './actions-social'

const CHANNELS = [
  { key: 'page',            label: 'FB Page' },
  { key: 'group_sell',      label: 'Group ขายได้' },
  { key: 'group_knowledge', label: 'Group ความรู้' },
  { key: 'cvd',             label: 'CVD' },
  { key: 'other',           label: 'อื่นๆ' },
] as const
const CH_LABEL: Record<string, string> = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label]))

const SOC = [
  { key: 'draft',      label: 'ร่าง',          cls: 'bg-white/5 text-[#B8B3A7] border-white/15' },
  { key: 'posted',     label: 'โพสต์แล้ว',     cls: 'bg-sky-500/10 text-sky-300 border-sky-400/30' },
  { key: 'monitoring', label: 'กำลังติดตาม',   cls: 'bg-[#C9A961]/15 text-[#E7C977] border-[#C9A961]/40' },
  { key: 'follow_up',  label: 'ต้องตอบ/ตามต่อ', cls: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/30' },
  { key: 'archived',   label: 'เก็บแล้ว',      cls: 'bg-white/5 text-[#5b6070] border-white/10' },
] as const
const SOC_CLS: Record<string, string> = Object.fromEntries(SOC.map((s) => [s.key, s.cls]))

export default function SocialPanel() {
  const [data, setData] = useState<SocialData | null>(null)
  const [pending, startTransition] = useTransition()
  const [editId, setEditId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // add form
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState('page')
  const [postUrl, setPostUrl] = useState('')
  const [targetUrl, setTargetUrl] = useState('')

  function apply(res: SocialData) {
    if (res.ok) setData(res)
    else if (res.error === 'unauthorized') location.reload()
  }
  const run = (fn: () => Promise<SocialData>) => startTransition(async () => apply(await fn()))
  useEffect(() => { run(loadSocial) }, [])

  const add = () => {
    if (!title.trim()) return
    run(() => createSocial({ title, channel, post_url: postUrl, target_url: targetUrl }))
    setTitle(''); setPostUrl(''); setTargetUrl('')
  }

  const posts = (data?.posts ?? []).filter((p) => showArchived || p.status !== 'archived')

  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><span>📣</span>Social Command (โพสต์ &amp; ช่องทาง)</h2>
        <label className="flex items-center gap-1.5 text-[11px] text-[#9ba0b0] cursor-pointer select-none">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[#C9A961]" />แสดงที่เก็บแล้ว
        </label>
      </div>

      {/* add form */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="หัวข้อโพสต์ *" className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white focus:outline-none">
          {CHANNELS.map((c) => <option key={c.key} value={c.key} className="bg-[#15172A]">{c.label}</option>)}
        </select>
        <input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="ลิงก์โพสต์ (FB)" className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <div className="flex gap-2">
          <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="URL เว็บที่ผูก เช่น /ebooks" className="flex-1 text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
          <button onClick={add} disabled={pending} className="text-xs font-semibold px-3 rounded bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-40 text-[#1C1D2C]">เพิ่ม</button>
        </div>
      </div>

      <div className="space-y-2">
        {posts.length === 0 && <p className="text-xs text-[#5b6070] py-3 text-center">— ยังไม่มีโพสต์ —</p>}
        {posts.map((p) =>
          editId === p.id
            ? <SocialEdit key={p.id} p={p} onCancel={() => setEditId(null)} onSave={(patch) => { setEditId(null); run(() => updateSocial({ id: p.id, ...patch })) }} />
            : <SocialRow key={p.id} p={p} pending={pending} onStatus={(s) => run(() => setSocialStatus(p.id, s))} onSaveMeta={(patch) => run(() => updateSocial({ id: p.id, ...patch }))} onEdit={() => setEditId(p.id)} onDelete={() => run(() => deleteSocial(p.id))} />
        )}
      </div>
    </section>
  )
}

function SocialRow({ p, pending, onStatus, onSaveMeta, onEdit, onDelete }: { p: any; pending: boolean; onStatus: (s: string) => void; onSaveMeta: (patch: { next_action: string; note: string }) => void; onEdit: () => void; onDelete: () => void }) {
  const [next, setNext] = useState(p.next_action || '')
  const [note, setNote] = useState(p.note || '')
  const dirty = next !== (p.next_action || '') || note !== (p.note || '')
  return (
    <div className={`rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 ${p.status === 'archived' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-sm text-[#E7E3D8] truncate">
            <span className="text-[10px] text-[#C9A961] mr-1.5">[{CH_LABEL[p.channel] || p.channel}]</span>{p.title}
          </div>
          <div className="flex gap-3 mt-0.5">
            {p.post_url && <a href={p.post_url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-300 hover:underline">↗ โพสต์</a>}
            {p.target_url && <a href={p.target_url} target="_blank" rel="noreferrer" className="text-[10px] text-[#9ba0b0] hover:underline">🔗 {p.target_url}</a>}
          </div>
        </div>
        <select value={p.status} disabled={pending} onChange={(e) => onStatus(e.target.value)} className={`text-[10px] px-1.5 py-0.5 rounded border bg-transparent focus:outline-none shrink-0 ${SOC_CLS[p.status] || ''}`}>
          {SOC.map((s) => <option key={s.key} value={s.key} className="bg-[#15172A] text-white">{s.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input value={next} onChange={(e) => setNext(e.target.value)} placeholder="next action / ต้องตอบอะไร" className="flex-1 min-w-[140px] text-[11px] bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="โน้ต" className="flex-1 min-w-[120px] text-[11px] bg-white/5 border border-white/10 rounded px-2 py-0.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <button disabled={pending || !dirty} onClick={() => onSaveMeta({ next_action: next, note })} className="text-[10px] font-semibold px-2.5 py-1 rounded bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-40 text-[#1C1D2C]">บันทึก</button>
        <button onClick={onEdit} className="text-[10px] text-[#7c8090] hover:text-[#C9A961] px-1">แก้</button>
        <button onClick={() => { if (confirm('ลบโพสต์นี้?')) onDelete() }} className="text-[10px] text-[#7c8090] hover:text-red-400 px-1">ลบ</button>
      </div>
    </div>
  )
}

function SocialEdit({ p, onCancel, onSave }: { p: any; onCancel: () => void; onSave: (patch: { title: string; channel: string; post_url: string; target_url: string }) => void }) {
  const [title, setTitle] = useState(p.title)
  const [channel, setChannel] = useState(p.channel)
  const [postUrl, setPostUrl] = useState(p.post_url || '')
  const [targetUrl, setTargetUrl] = useState(p.target_url || '')
  return (
    <div className="rounded-lg border border-[#C9A961]/40 bg-white/[0.04] p-3 space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-sm bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white focus:border-[#C9A961] focus:outline-none" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white focus:outline-none">
          {CHANNELS.map((c) => <option key={c.key} value={c.key} className="bg-[#15172A]">{c.label}</option>)}
        </select>
        <input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="ลิงก์โพสต์" className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
        <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="URL เว็บที่ผูก" className="sm:col-span-2 text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-[#7c8090] hover:text-white px-2 py-1">ยกเลิก</button>
        <button onClick={() => { if (title.trim()) onSave({ title: title.trim(), channel, post_url: postUrl.trim(), target_url: targetUrl.trim() }) }} className="bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] text-xs font-semibold px-3 py-1 rounded">บันทึก</button>
      </div>
    </div>
  )
}
