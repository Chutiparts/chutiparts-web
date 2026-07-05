'use client'
// app/ops-x7k2m9/finance/FinanceClient.tsx — Finance เบา: สรุป + เพิ่มรายการ + ลิสต์ + export
// tracking เท่านั้น (คุมเงินเข้า-ออก/กำไร) — ไม่ใช่บัญชี/ภาษีตามกฎหมาย
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Entry = Record<string, any>
const GREEN = '#17301F', INCOME = '#0F6E56', EXPENSE = '#A32D2D'
const CATS = ['ขายอะไหล่', 'ค่าส่ง (รับ)', 'ซื้ออะไหล่', 'ค่าส่ง (จ่าย)', 'ค่าการตลาด', 'ค่าธรรมเนียม', 'ค่าเช่า', 'อื่น ๆ']
const baht = (n: number) => '฿' + Math.round(n).toLocaleString()
const ymd = () => new Date().toISOString().slice(0, 10)
const monthOf = (d?: string) => (d || '').slice(0, 7)

export default function FinanceClient({ entries, addEntry, deleteEntry }: {
  entries: Entry[]; addEntry: (fd: FormData) => Promise<void>; deleteEntry: (fd: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [toast, setToast] = useState('')
  const thisMonth = monthOf(ymd())
  const [month, setMonth] = useState(thisMonth)
  const [f, setF] = useState({ type: 'income', amount: '', category: '', note: '', ref: '', entry_date: ymd() })
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))

  const months = useMemo(() => {
    const s = new Set<string>([thisMonth])
    entries.forEach((e) => e.entry_date && s.add(monthOf(e.entry_date)))
    return [...s].sort().reverse()
  }, [entries, thisMonth])

  const view = useMemo(() => month === 'all' ? entries : entries.filter((e) => monthOf(e.entry_date) === month), [entries, month])
  const income = view.filter((e) => e.type === 'income').reduce((a, e) => a + Number(e.amount || 0), 0)
  const expense = view.filter((e) => e.type === 'expense').reduce((a, e) => a + Number(e.amount || 0), 0)
  const profit = income - expense

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!(parseFloat(f.amount) > 0)) { setToast('ใส่จำนวนเงินก่อน'); setTimeout(() => setToast(''), 1500); return }
    const fd = new FormData()
    Object.entries(f).forEach(([k, v]) => fd.set(k, v))
    start(async () => { await addEntry(fd); router.refresh(); setF({ ...f, amount: '', category: '', note: '', ref: '' }) })
  }
  function del(id: string) {
    const fd = new FormData(); fd.set('id', id)
    start(async () => { await deleteEntry(fd); router.refresh() })
  }
  function copy(t: string) { navigator.clipboard?.writeText(t).then(() => { setToast('คัดลอกแล้ว'); setTimeout(() => setToast(''), 1500) }) }
  function exportCsv() {
    const cols = ['entry_date', 'type', 'amount', 'category', 'note', 'ref']
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = '﻿' + [cols.join(','), ...view.map((e) => cols.map((c) => esc(e[c])).join(','))].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `finance-${month}.csv`; a.click()
  }
  const summaryText = `💰 Finance ${month === 'all' ? '(ทั้งหมด)' : month}\nรายรับ ${baht(income)} · รายจ่าย ${baht(expense)} · กำไร ${baht(profit)}`

  const inp: React.CSSProperties = { padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }
  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE4', fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Finance — บัญชีเบา</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>คุมเงินเข้า-ออก + กำไร · tracking ไม่ใช่บัญชี/ภาษีตามกฎหมาย</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: 14 }}>
        {/* month + summary */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={inp}>
            <option value="all">ทั้งหมด</option>
            {months.map((m) => <option key={m} value={m}>{m}{m === thisMonth ? ' (เดือนนี้)' : ''}</option>)}
          </select>
          <button onClick={() => copy(summaryText)} style={qbtn}>คัดลอกสรุป</button>
          <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
          {pending && <span style={{ fontSize: 12, color: '#888' }}>กำลังบันทึก…</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[['รายรับ', income, INCOME], ['รายจ่าย', expense, EXPENSE], ['กำไร', profit, profit >= 0 ? INCOME : EXPENSE]].map(([k, v, c]) => (
            <div key={k as string} style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '12px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: c as string }}>{baht(v as number)}</div>
              <div style={{ fontSize: 12, color: '#777' }}>{k as string}</div>
            </div>
          ))}
        </div>

        {/* add form */}
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button type="button" onClick={() => set('type', 'income')} style={{ ...tglBtn, ...(f.type === 'income' ? { background: INCOME, color: '#fff', borderColor: INCOME } : {}) }}>+ รายรับ</button>
            <button type="button" onClick={() => set('type', 'expense')} style={{ ...tglBtn, ...(f.type === 'expense' ? { background: EXPENSE, color: '#fff', borderColor: EXPENSE } : {}) }}>− รายจ่าย</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={f.amount} onChange={(e) => set('amount', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="จำนวนเงิน ฿" inputMode="decimal" style={inp} />
            <input type="date" value={f.entry_date} onChange={(e) => set('entry_date', e.target.value)} style={inp} />
            <input list="fcats" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="หมวด (เช่น ขายอะไหล่)" style={inp} />
            <datalist id="fcats">{CATS.map((c) => <option key={c} value={c} />)}</datalist>
            <input value={f.ref} onChange={(e) => set('ref', e.target.value)} placeholder="อ้างอิง lead/order (ถ้ามี)" style={inp} />
          </div>
          <input value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="โน้ต" style={{ ...inp, width: '100%', marginTop: 8, boxSizing: 'border-box' }} />
          <button type="submit" disabled={pending} style={{ marginTop: 10, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>บันทึก</button>
        </form>

        {/* list */}
        {view.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>ยังไม่มีรายการ</div>}
        {view.map((e) => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e7e3d8', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                <span style={{ color: e.type === 'income' ? INCOME : EXPENSE }}>{e.type === 'income' ? '+' : '−'}{baht(Number(e.amount || 0))}</span>
                <span style={{ color: '#888', fontWeight: 400, fontSize: 13 }}> · {e.category || '—'}</span>
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>{e.entry_date}{e.ref ? ` · อ้างอิง ${e.ref}` : ''}{e.note ? ` · ${e.note}` : ''}</div>
            </div>
            <button onClick={() => del(String(e.id))} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 16 }} aria-label="ลบ">🗑</button>
          </div>
        ))}

        <p style={{ fontSize: 12, color: '#8a8a8a', marginTop: 14, lineHeight: 1.6 }}>
          ⚠️ เครื่องมือนี้ใช้ติดตามเงินเข้า-ออกภายใน · ไม่ใช่ระบบบัญชี/ภาษีตามกฎหมาย · ใบกำกับภาษี/VAT/ยื่นภาษี ให้ใช้โปรแกรมบัญชีหรือส่งนักบัญชี
        </p>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const tglBtn: React.CSSProperties = { flex: 1, background: '#fff', border: '1px solid #ddd', color: '#555', borderRadius: 8, padding: '8px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
