'use client'
// app/ops-x7k2m9/landed-cost/LandedCostClient.tsx — Landed Cost Guard P1
// อ่านการขายจริงจาก Ledger → บวก "ต้นทุนแฝง" (ค่านำเข้า/ค่าเงิน % · ค่าส่ง/แพ็ก ฿ · ค่าธรรมเนียม %) → กำไรจริง
// ปัจจัย + เกณฑ์บาง จำใน localStorage · อ่านล้วน ไม่แก้ Ledger · ธง ขาดทุนจริง/บาง/ok
import { useMemo, useState, useEffect } from 'react'

type Row = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }
const baht = (v: any) => '฿' + Math.round(num(v)).toLocaleString()
const todayStr = () => new Date().toISOString().slice(0, 10)
function fmtDate(d?: string | null) { if (!d) return '-'; const x = new Date(d); if (isNaN(x.getTime())) return '-'; return `${x.getDate()}/${x.getMonth() + 1}/${(x.getFullYear() + 543) % 100}` }

// ค่าปัจจัยเริ่มต้น (owner ปรับตามจริง) — เริ่ม 0 เพื่อไม่ให้ตัวเลขหลอก
const DEFAULTS = { fxPct: 0, shipFlat: 0, feePct: 0, thin: 15 }
const LS_KEY = 'chutibenz_landed_factors'

// landed cost = ต้นทุนบันทึก + (ต้นทุน×ค่านำเข้า%) + ค่าส่งต่อชิ้น + (ราคาขาย×ค่าธรรมเนียม%)
function landedOf(r: Row, f: { fxPct: number; shipFlat: number; feePct: number }) {
  const cost = num(r.cost), price = num(r.sale_price)
  return cost + cost * (f.fxPct / 100) + f.shipFlat + price * (f.feePct / 100)
}
const recordedProfit = (r: Row) => num(r.sale_price) - num(r.cost)
const realProfit = (r: Row, f: any) => num(r.sale_price) - landedOf(r, f)
const realMargin = (r: Row, f: any) => { const p = num(r.sale_price); return p > 0 ? Math.round((realProfit(r, f) / p) * 100) : 0 }

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const finp: React.CSSProperties = { width: 74, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, marginLeft: 4 }

export default function LandedCostClient({ sales }: { sales: Row[] }) {
  const [f, setF] = useState(DEFAULTS)
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1500) }
  useEffect(() => { try { const s = localStorage.getItem(LS_KEY); if (s) setF({ ...DEFAULTS, ...JSON.parse(s) }) } catch {} }, [])
  const setFactor = (k: string, v: number) => setF((s) => { const n = { ...s, [k]: isNaN(v) ? 0 : v }; try { localStorage.setItem(LS_KEY, JSON.stringify(n)) } catch {} ; return n })

  const copy = (t: string, m = 'คัดลอกแล้ว') => navigator.clipboard?.writeText(t).then(() => flash(m))

  const rows = useMemo(() => sales.map((r) => ({
    r, landed: landedOf(r, f), real: realProfit(r, f), rec: recordedProfit(r), margin: realMargin(r, f),
  })).sort((a, b) => a.margin - b.margin), [sales, f])

  const flagOf = (margin: number) => margin < 0 ? 'loss' : margin < f.thin ? 'thin' : 'ok'
  const FLAG: Record<string, { th: string; bg: string; fg: string }> = {
    loss: { th: '🔴 ขาดทุนจริง', bg: '#FCEBEB', fg: '#A32D2D' },
    thin: { th: '🟡 กำไรบาง', bg: '#FAEEDA', fg: '#854F0B' },
    ok: { th: '🟢 กำไรดี', bg: '#E1F5EE', fg: '#0F6E56' },
  }

  const D = useMemo(() => {
    const realSum = rows.reduce((a, x) => a + x.real, 0)
    const recSum = rows.reduce((a, x) => a + x.rec, 0)
    const hidden = recSum - realSum
    const loss = rows.filter((x) => flagOf(x.margin) === 'loss').length
    const thin = rows.filter((x) => flagOf(x.margin) === 'thin').length
    return { realSum, recSum, hidden, loss, thin }
  }, [rows, f.thin])

  // export
  function dl(name: string, text: string, type: string) { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const COLS = ['sale_date', 'customer', 'part_sold', 'sale_price', 'cost', 'landed_cost', 'recorded_profit', 'real_profit', 'real_margin_pct', 'flag']
  const line = (x: any) => [x.r.sale_date, x.r.customer, x.r.part_sold, num(x.r.sale_price), num(x.r.cost), Math.round(x.landed), Math.round(x.rec), Math.round(x.real), x.margin + '%', FLAG[flagOf(x.margin)].th]
  const exportCsv = () => dl(`landed-cost-${todayStr()}.csv`, '\uFEFF' + [COLS.join(','), ...rows.map((x) => line(x).map(esc).join(','))].join('\r\n'), 'text/csv;charset=utf-8')
  const exportTxt = () => dl(`landed-cost-${todayStr()}.txt`, '\uFEFF' + `ChutiBenz — Landed Cost Guard\n${new Date().toLocaleString('th-TH')}\nปัจจัย: ค่านำเข้า/ค่าเงิน ${f.fxPct}% · ค่าส่ง ฿${f.shipFlat}/ชิ้น · ค่าธรรมเนียม ${f.feePct}% · เกณฑ์บาง <${f.thin}%\nกำไรจริงรวม ${baht(D.realSum)} · กำไรที่บันทึก ${baht(D.recSum)} · ต้นทุนแฝงที่หาย ${baht(D.hidden)} · ขาดทุนจริง ${D.loss} · บาง ${D.thin}\n${'─'.repeat(40)}\n` + rows.map((x) => `▪ ${fmtDate(x.r.sale_date)} · ${x.r.customer || '(ไม่ระบุ)'} · ${x.r.part_sold || 'อะไหล่'}\n   ขาย ${baht(x.r.sale_price)} · ต้นทุนถึงมือ ${baht(x.landed)} · กำไรจริง ${baht(x.real)} (${x.margin}%) · ${FLAG[flagOf(x.margin)].th}`).join('\n\n'), 'text/plain;charset=utf-8')
  const exportJson = () => dl(`landed-cost-${todayStr()}.json`, JSON.stringify({ factors: f, summary: D, rows: rows.map((x) => ({ sale_date: x.r.sale_date, customer: x.r.customer, part_sold: x.r.part_sold, sale_price: num(x.r.sale_price), cost: num(x.r.cost), landed_cost: Math.round(x.landed), recorded_profit: Math.round(x.rec), real_profit: Math.round(x.real), real_margin_pct: x.margin, flag: flagOf(x.margin) })) }, null, 2), 'application/json')

  const stat = (label: string, val: string, color: string) => (
    <div style={{ flex: 1, minWidth: 100, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div><div style={{ fontSize: 10.5, color: '#777' }}>{label}</div></div>
  )

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>🧮 Landed Cost Guard</div>
            <div style={{ fontSize: 12, color: '#cbd8cf' }}>กำไรจริงหลังต้นทุนถึงมือ (ค่านำเข้า/ส่ง/ธรรมเนียม) · อ่านการขายจริงจาก Ledger · {new Date().toLocaleDateString('th-TH')}</div>
          </div>
          <a href="/ops-x7k2m9/ledger" style={{ ...qbtn, textDecoration: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>→ Ledger (บันทึกขาย)</a>
        </div>
      </div>

      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {/* ปัจจัยต้นทุนแฝง */}
        <div style={{ ...card, background: '#fbfaf6' }}>
          <div style={{ fontWeight: 700, color: GREEN, fontSize: 13, marginBottom: 8 }}>⚙️ ตั้งค่าต้นทุนแฝง (จำอัตโนมัติ · ปรับตามจริงของร้าน)</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: '#555' }}>
            <label>ค่านำเข้า/ค่าเงิน <input type="number" value={f.fxPct} onChange={(e) => setFactor('fxPct', Number(e.target.value))} style={finp} />%</label>
            <label>ค่าส่ง/แพ็ก <input type="number" value={f.shipFlat} onChange={(e) => setFactor('shipFlat', Number(e.target.value))} style={finp} />฿/ชิ้น</label>
            <label>ค่าธรรมเนียม <input type="number" value={f.feePct} onChange={(e) => setFactor('feePct', Number(e.target.value))} style={finp} />%</label>
            <label>เกณฑ์กำไรบาง &lt; <input type="number" value={f.thin} onChange={(e) => setFactor('thin', Number(e.target.value))} style={finp} />%</label>
          </div>
        </div>

        {/* dashboard */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {stat('กำไรจริงรวม', baht(D.realSum), D.realSum >= 0 ? '#0F6E56' : '#A32D2D')}
          {stat('กำไรที่บันทึก', baht(D.recSum), GREEN)}
          {stat('ต้นทุนแฝงที่หาย', baht(D.hidden), '#854F0B')}
          {stat('ขาดทุนจริง', String(D.loss), '#A32D2D')}
          {stat('กำไรบาง', String(D.thin), '#854F0B')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
          <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
          <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
          <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>เรียงจากกำไรจริงน้อย → มาก ({rows.length} รายการ)</span>
        </div>

        {rows.length === 0 && <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 24 }}>— ยังไม่มีการขายใน Ledger — ไปบันทึกที่หน้า Ledger ก่อน</div>}
        {rows.map((x) => {
          const fl = flagOf(x.margin), fg = FLAG[fl]
          const erosion = x.rec - x.real
          return (
            <div key={x.r.id} style={{ ...card, borderLeft: `4px solid ${fg.fg}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 14 }}>{x.r.customer || '(ไม่ระบุ)'} · {x.r.part_sold || 'อะไหล่'}</b>
                <Badge label={fg.th} bg={fg.bg} fg={fg.fg} />
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>
                ขาย {baht(x.r.sale_price)} · ต้นทุนถึงมือ {baht(x.landed)} · <b style={{ color: fg.fg }}>กำไรจริง {baht(x.real)} ({x.margin}%)</b>
              </div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3 }}>
                {fmtDate(x.r.sale_date)}{x.r.car_model ? ` · ${x.r.car_model}` : ''} · กำไรที่บันทึก {baht(x.rec)}{erosion > 0 ? ` · ต้นทุนแฝงกิน ${baht(erosion)}` : ''}
              </div>
            </div>
          )
        })}

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '10px 0 30px' }}>
          กำไรจริง = ราคาขาย − (ต้นทุน + ค่านำเข้า% + ค่าส่ง + ค่าธรรมเนียม%) · ตั้งค่าปัจจัยตามจริงของร้าน · อ่านจาก Ledger ไม่แก้ข้อมูล
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}
