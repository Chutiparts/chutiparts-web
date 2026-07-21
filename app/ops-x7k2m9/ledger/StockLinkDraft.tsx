'use client'
// app/ops-x7k2m9/ledger/StockLinkDraft.tsx — P1 #22 Ledger → Stock Suggestion (ผูก SKU · owner-only)
// อ่าน sales+stock (ส่งมาจาก LedgerClient) · หา "รายการขายที่ยังไม่มี SKU" → เสนอ SKU ที่น่าจะตรง (draft)
// owner กด Confirm/Edit/Cancel → ยิง /api/stock-link (เขียน sales_records.sku + audit) · ไม่ auto ตัด · match ไม่ชัด = "ตรวจสอบเอง"
import { useMemo, useState } from 'react'

type Row = Record<string, any>
const norm = (s: any) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

// ให้คะแนนความเข้ากันระหว่าง sale (part_sold/car_model) กับ stock (part_name/car_model)
function scoreMatch(sale: Row, st: Row): number {
  const p = norm(sale.part_sold), m = norm(sale.car_model)
  const sp = norm(st.part_name), sm = norm(st.car_model)
  let s = 0
  if (p && sp) { if (sp === p) s += 4; else if (sp.includes(p) || p.includes(sp)) s += 2 }
  if (m && sm) { if (sm === m) s += 2; else if (sm.includes(m) || m.includes(sm)) s += 1 }
  return s
}

export default function StockLinkDraft({ sales = [], stock = [] }: { sales?: Row[]; stock?: Row[] }) {
  const [done, setDone] = useState<Record<string, string>>({}) // sale_id -> 'linked' | 'skipped'
  const [pick, setPick] = useState<Record<string, string>>({}) // sale_id -> chosen sku (override)
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string>('')
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1800) }

  // stock ที่มี SKU (ผูกได้) + เรียงชื่อไว้ทำ dropdown
  const stockWithSku = useMemo(() => stock.filter((s) => String(s.sku || '').trim()), [stock])

  // รายการขายที่ยังไม่มี SKU (ยังไม่ตัดสต็อก) + มีข้อมูลพอจับคู่
  const drafts = useMemo(() => {
    return sales
      .filter((s) => !String(s.sku || '').trim() && (s.part_sold || s.car_model))
      .map((sale) => {
        const scored = stockWithSku
          .map((st) => ({ st, sc: scoreMatch(sale, st) }))
          .filter((x) => x.sc >= 2)
          .sort((a, b) => b.sc - a.sc)
        const strong = scored.filter((x) => x.sc >= 4) // "ตรงจริง" (ชื่อตรง/ตรงเกือบเป๊ะ)
        const top = strong[0] || scored[0]
        // guardrail #3: เสนอเป็นข้อเสนอเดียว "เฉพาะเมื่อมีตัวตรงจริงตัวเดียว" · >1 หรือไม่ตรง = ต้องตรวจสอบเอง (owner เลือก SKU เอง)
        // NOTE: ถึง confident ก็ยังเป็นแค่ suggestion — owner ต้องกด "ยืนยัน" เองทุกครั้ง (ไม่มี auto-confirm ไม่ว่าคะแนนจะสูงแค่ไหน)
        const confident = strong.length === 1
        return { sale, scored, top, confident }
      })
  }, [sales, stockWithSku])

  const visible = drafts.filter((d) => !done[String(d.sale.id)])

  async function call(sale_id: string, action: 'confirm' | 'cancel', sku?: string) {
    setBusy(sale_id)
    try {
      const r = await fetch('/api/stock-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_id, action, sku: sku || null }),
      })
      const j = await r.json().catch(() => ({ ok: false }))
      if (j.ok) {
        setDone((p) => ({ ...p, [sale_id]: action === 'confirm' ? 'linked' : 'skipped' }))
        flash(action === 'confirm' ? `ผูก SKU ${sku} แล้ว — คงเหลือจะลดให้อัตโนมัติ` : 'ข้ามรายการนี้แล้ว')
      } else {
        flash('ไม่สำเร็จ: ' + (j.error || 'error'))
      }
    } catch { flash('เชื่อมต่อไม่สำเร็จ') }
    setBusy('')
  }

  if (!drafts.length) {
    return (
      <div style={box}>
        <div style={head}>🔗 ผูก SKU รายการขาย → ตัดสต็อก (Draft)</div>
        <div style={{ fontSize: 12.5, color: '#0F6E56' }}>✅ ทุกรายการขายมี SKU ครบแล้ว — ไม่มีอะไรต้องผูก</div>
      </div>
    )
  }

  return (
    <div style={box}>
      <div style={head}>🔗 ผูก SKU รายการขาย → ตัดสต็อก (Draft) · เหลือ {visible.length}</div>
      <div style={{ fontSize: 11.5, color: '#777', marginBottom: 8 }}>
        รายการขายที่ยัง <b>ไม่มี SKU</b> = ยังไม่ตัดสต็อก · ยืนยัน SKU ที่ถูกต้องเพื่อให้คงเหลือลด (Path B) · <b>ไม่ตัดอัตโนมัติ · ทุกการกดถูกบันทึก audit</b>
      </div>
      {visible.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#0F6E56' }}>✅ จัดการครบทุกรายการในรอบนี้แล้ว</div>
      ) : visible.map((d) => {
        const id = String(d.sale.id)
        const chosen = pick[id] || (d.confident && d.top ? String(d.top.st.sku) : '')
        const isEditing = editing[id] || !d.confident
        return (
          <div key={id} style={rowBox}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
              {d.sale.part_sold || '(ไม่ระบุชิ้น)'}{d.sale.car_model ? ` · ${d.sale.car_model}` : ''}
            </div>
            <div style={{ fontSize: 11.5, color: '#777', margin: '2px 0 6px' }}>
              ขาย {d.sale.sale_date || '-'}{d.sale.customer ? ` · ${d.sale.customer}` : ''}{d.sale.sale_price ? ` · ฿${Number(d.sale.sale_price).toLocaleString()}` : ''}
            </div>

            {d.confident && d.top && !editing[id] ? (
              <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                เสนอผูกกับ: <b>{d.top.st.part_name}</b> <span style={{ color: '#0C447C' }}>[{d.top.st.sku}]</span>{d.top.st.car_model ? ` · ${d.top.st.car_model}` : ''}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#854F0B', marginBottom: 6 }}>
                {d.scored.length ? '⚠️ มีหลายตัวใกล้เคียง — เลือกเอง' : '⚠️ ไม่พบ SKU ที่ตรง — ต้องตรวจสอบเอง'}
              </div>
            )}

            {isEditing && (
              <select value={chosen} onChange={(e) => setPick((p) => ({ ...p, [id]: e.target.value }))} style={sel}>
                <option value="">— เลือก SKU —</option>
                {(d.scored.length ? d.scored.map((x) => x.st) : stockWithSku).map((st, i) => (
                  <option key={i} value={String(st.sku)}>{st.part_name} [{st.sku}]{st.car_model ? ` · ${st.car_model}` : ''}</option>
                ))}
              </select>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button disabled={!chosen || busy === id} onClick={() => call(id, 'confirm', chosen)} style={{ ...btn, background: chosen ? '#17301F' : '#bbb', cursor: chosen ? 'pointer' : 'not-allowed' }}>
                {busy === id ? '...' : '✓ ยืนยันผูก SKU'}
              </button>
              {!isEditing && (
                <button onClick={() => setEditing((p) => ({ ...p, [id]: true }))} style={btnGhost}>✎ เปลี่ยน SKU</button>
              )}
              <button disabled={busy === id} onClick={() => call(id, 'cancel', chosen)} style={btnGhost}>ข้าม</button>
            </div>
          </div>
        )
      })}
      {toast && <div style={{ marginTop: 8, fontSize: 12, color: '#17301F', fontWeight: 600 }}>{toast}</div>}
    </div>
  )
}

const box: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 12, padding: 14, marginBottom: 14 }
const head: React.CSSProperties = { fontSize: 15, color: '#17301F', fontWeight: 700, marginBottom: 6 }
const rowBox: React.CSSProperties = { border: '1px solid #eee', borderRadius: 9, padding: '9px 11px', marginBottom: 8, background: '#fbfaf6' }
const sel: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }
const btn: React.CSSProperties = { color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 600 }
const btnGhost: React.CSSProperties = { background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
