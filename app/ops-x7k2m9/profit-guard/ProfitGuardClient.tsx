'use client'
// app/ops-x7k2m9/profit-guard/ProfitGuardClient.tsx
// Profit Guard — คิดกำไรจริงก่อนเสนอราคา (ราคาขาย − ทุน − นำเข้า/ค่าเงิน − ค่าส่ง/แพ็ก)
// สไตล์ owner: คำนวณต้นทุนก่อน เห็น "ราคาขายแนะนำขั้นต่ำ" แล้วค่อยใส่ราคาขายจริง · ไม่ลดราคา
// เครื่องคิดเลขล้วน — ไม่บันทึกถาวร (รายการดีลอยู่ในหน้าจอ) · ไม่แตะ DB
import { useState, useMemo } from 'react'

type Deal = { name: string; price: number; cost: number; imp: number; ship: number; costs: number; profit: number; margin: number }

const GREEN = '#17301F', GOLD = '#B8895A'
const baht = (n: number) => '฿' + Math.round(n || 0).toLocaleString()
const numv = (s: string) => { const v = parseFloat(s); return isFinite(v) ? v : 0 }

export default function ProfitGuardClient() {
  const [tab, setTab] = useState<'calc' | 'deals' | 'set'>('calc')
  const [thGreen, setThGreen] = useState(20)
  const [thYellow, setThYellow] = useState(10)
  const [target, setTarget] = useState('25')
  const [toast, setToast] = useState('')
  const [f, setF] = useState({ name: '', price: '', cost: '', imp: '', ship: '' })
  const [deals, setDeals] = useState<Deal[]>([])
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }))

  const levelOf = (m: number) => (m >= thGreen ? 'green' : m >= thYellow ? 'yellow' : 'red')
  const levelText = (lv: string) => ({ green: '🟢 กำไรดี', yellow: '🟡 พอได้ ระวัง', red: '🔴 เสี่ยงขาดทุน/กำไรน้อย' } as any)[lv]
  const pillText = (lv: string) => ({ green: '🟢 ดี', yellow: '🟡 พอได้', red: '🔴 เสี่ยง' } as any)[lv]
  const minPrice = (costs: number, pct: number) => (pct >= 100 ? 0 : costs / (1 - pct / 100))

  const r = useMemo(() => {
    const price = numv(f.price), cost = numv(f.cost), imp = numv(f.imp), ship = numv(f.ship)
    const costs = cost + imp + ship
    const profit = price - costs
    const margin = price > 0 ? (profit / price) * 100 : 0
    return { price, costs, profit, margin }
  }, [f])

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600) }

  function addDeal() {
    if (!(r.price > 0)) { showToast('กรอกราคาขายก่อน'); return }
    setDeals((d) => [...d, {
      name: f.name.trim() || '(ไม่ระบุชื่อ)',
      price: r.price, cost: numv(f.cost), imp: numv(f.imp), ship: numv(f.ship),
      costs: r.costs, profit: r.profit, margin: r.margin,
    }])
    setF({ name: '', price: '', cost: '', imp: '', ship: '' })
    showToast('เพิ่มดีลแล้ว ✓')
  }
  function delDeal(i: number) { setDeals((d) => d.filter((_, x) => x !== i)) }
  function loadSample() {
    const d = (name: string, price: number, cost: number, imp: number, ship: number): Deal => {
      const costs = cost + imp + ship, profit = price - costs
      return { name, price, cost, imp, ship, costs, profit, margin: price > 0 ? (profit / price) * 100 : 0 }
    }
    setDeals([
      d('ยางแท่นเครื่อง W140', 2500, 900, 300, 120),
      d('ไฟท้าย W124 มือสอง', 3500, 1500, 500, 150),
      d('สายพานหน้าเครื่อง W202', 800, 550, 0, 120),
      d('น็อตล้อชุบ (ส่ง DHL นอก)', 650, 300, 80, 250),
    ])
    showToast('โหลดตัวอย่าง 4 ดีล ✓')
  }

  const stats = useMemo(() => {
    const totalSale = deals.reduce((a, d) => a + d.price, 0)
    const totalProfit = deals.reduce((a, d) => a + d.profit, 0)
    const avg = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0
    const flagged = deals.filter((d) => levelOf(d.margin) !== 'green').length
    return { totalProfit, avg, flagged, n: deals.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, thGreen, thYellow])

  function copyText(t: string) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(() => showToast('คัดลอกแล้ว ✓')).catch(() => showToast('คัดลอกไม่สำเร็จ'))
  }
  function exportCsv() {
    if (!deals.length) { showToast('ยังไม่มีดีล'); return }
    const BOM = '﻿'
    const head = ['อะไหล่/งาน', 'ราคาขาย', 'ทุนของ', 'ค่านำเข้า/ค่าเงิน', 'ค่าส่ง+แพ็ก', 'ต้นทุนรวม', 'กำไร', 'margin%', 'สถานะ']
    const esc = (v: any) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }
    const rows = deals.map((d) => [d.name, d.price, d.cost, d.imp, d.ship, d.costs, Math.round(d.profit), d.margin.toFixed(1), pillText(levelOf(d.margin))])
    const csv = BOM + [head, ...rows].map((row) => row.map(esc).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = 'profit-guard-deals.csv'; a.click()
    showToast('Export CSV แล้ว ✓')
  }

  const inp: React.CSSProperties = { width: '100%', fontSize: 15, padding: '10px 11px', border: '1px solid #e7e1d2', borderRadius: 9, background: '#fff', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { display: 'block', fontSize: 13, color: '#6b7280', margin: '10px 0 4px' }
  const tabBtn = (id: string, label: string): React.CSSProperties => ({
    flex: '0 0 auto', background: 'none', border: 'none', padding: '12px', fontSize: 14, cursor: 'pointer',
    color: tab === id ? GREEN : '#6b7280', borderBottom: '3px solid ' + (tab === id ? GOLD : 'transparent'), fontWeight: tab === id ? 800 : 400,
  })
  const lv = r.price > 0 ? levelOf(r.margin) : 'green'
  const resBg = lv === 'green' ? 'linear-gradient(135deg,#1a7a45,#125c33)' : lv === 'yellow' ? 'linear-gradient(135deg,#b58a12,#8a6a08)' : 'linear-gradient(135deg,#c0392b,#8f271c)'

  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE4', fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1f2430' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>💎 Profit Guard <span style={{ color: GOLD }}>— คิดกำไรก่อนเสนอราคา</span></div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>ราคาขาย − ทุน − ค่านำเข้า/ค่าเงิน − ค่าส่ง/แพ็ก = กำไรจริง · ไม่ขายขาดทุนโดยไม่รู้ตัว</div>
      </div>

      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', background: '#fff', borderBottom: '1px solid #e7e1d2', padding: '0 8px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button style={tabBtn('calc', '')} onClick={() => setTab('calc')}>🧮 คิดกำไรต่อชิ้น</button>
        <button style={tabBtn('deals', '')} onClick={() => setTab('deals')}>📋 รายการดีล</button>
        <button style={tabBtn('set', '')} onClick={() => setTab('set')}>⚙️ เกณฑ์เตือน</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 14 }}>
        {/* ===== CALC ===== */}
        {tab === 'calc' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} className="pg-grid">
            <div style={{ background: '#fff', border: '1px solid #e7e1d2', borderRadius: 14, padding: 16 }}>
              <label style={lab}>ชื่ออะไหล่ / งาน</label>
              <input style={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="เช่น ยางแท่นเครื่อง W140" />
              <label style={lab}>ราคาที่จะเสนอลูกค้า (฿)</label>
              <input style={{ ...inp, fontWeight: 700 }} value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" />
              <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: GREEN }}>ต้นทุน</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><label style={lab}>ทุนของ (ราคารับมา)</label>
                  <input style={inp} value={f.cost} onChange={(e) => set('cost', e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" /></div>
                <div style={{ flex: 1 }}><label style={lab}>ค่านำเข้า/ค่าเงิน</label>
                  <input style={inp} value={f.imp} onChange={(e) => set('imp', e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" /></div>
              </div>
              <label style={lab}>ค่าส่ง + แพ็ก</label>
              <input style={inp} value={f.ship} onChange={(e) => set('ship', e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" />
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button onClick={addDeal} style={{ background: GOLD, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>➕ เพิ่มเข้ารายการดีล</button>
                <button onClick={() => setF({ name: '', price: '', cost: '', imp: '', ship: '' })} style={{ background: '#fff', color: GREEN, border: '1px solid ' + GREEN, borderRadius: 9, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>ล้าง</button>
              </div>
            </div>

            <div>
              <div style={{ borderRadius: 14, padding: 18, textAlign: 'center', color: '#fff', background: resBg }}>
                <div style={{ fontSize: 14, fontWeight: 700, opacity: .95 }}>{r.price > 0 ? levelText(lv) : '🟢 กำไรดี'}</div>
                <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1, margin: '6px 0' }}>{baht(r.profit)}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>margin {r.price > 0 ? r.margin.toFixed(1) : '0'}%</div>
                <div style={{ fontSize: 12.5, opacity: .9, marginTop: 8, lineHeight: 1.6 }}>
                  {r.price <= 0 ? 'กรอกราคาขายและต้นทุนเพื่อดูกำไร'
                    : r.profit < 0 ? 'ราคานี้ขาดทุน ' + baht(-r.profit) + ' — ควรขายอย่างน้อย ' + baht(r.costs)
                      : 'กำไร ' + baht(r.profit) + ' จากราคาขาย ' + baht(r.price)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <div style={{ flex: 1, background: '#f6ecdd', border: '1px solid #ecdcc4', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>{baht(r.costs)}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>ต้นทุนรวม</div>
                </div>
                <div style={{ flex: 1, background: '#f6ecdd', border: '1px solid #ecdcc4', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>{baht(r.costs)}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>ราคาเท่าทุน</div>
                </div>
              </div>
              {/* กำหนดกำไรเป้าหมาย → ราคาที่ควรขาย */}
              <div style={{ background: '#fff', border: '2px solid ' + GOLD, borderRadius: 12, padding: '13px 14px', marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>🎯 อยากได้กำไร</span>
                  <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal"
                    style={{ width: 66, fontSize: 15, fontWeight: 700, textAlign: 'center', padding: '6px 8px', border: '1px solid #e7e1d2', borderRadius: 8, color: GREEN }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>%</span>
                </div>
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>ราคาที่ควรขาย</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: r.costs > 0 ? GOLD : '#c9c2b4', lineHeight: 1.15 }}>
                    {r.costs > 0 ? baht(minPrice(r.costs, numv(target))) : '—'}
                  </div>
                  {r.costs > 0 && numv(target) < 100 && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      ต้นทุน {baht(r.costs)} → กำไร {baht(minPrice(r.costs, numv(target)) - r.costs)} ({numv(target)}%)
                    </div>
                  )}
                </div>
              </div>
              <div style={{ background: '#f6ecdd', border: '1px solid #ecdcc4', borderRadius: 10, padding: '11px 12px', fontSize: 13, marginTop: 10, lineHeight: 1.7 }}>
                {r.costs > 0 ? (
                  <>💡 <b style={{ color: GREEN }}>เทียบราคาขั้นต่ำ</b><br />
                    • เท่าทุน (ไม่ขาดทุน): <b>{baht(r.costs)}</b><br />
                    • margin {thYellow}%: <b>{baht(minPrice(r.costs, thYellow))}</b> · margin {thGreen}%: <b>{baht(minPrice(r.costs, thGreen))}</b></>
                ) : (<>💡 <b style={{ color: GREEN }}>ราคาขายแนะนำ</b><br />กรอกต้นทุนก่อน แล้วระบบจะบอกราคาที่ควรขายตามกำไรเป้าหมาย</>)}
              </div>
            </div>
          </div>
        )}

        {/* ===== DEALS ===== */}
        {tab === 'deals' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
              {[[stats.n, 'ดีลทั้งหมด', GOLD], [baht(stats.totalProfit), 'กำไรรวม', '#15803d'], [stats.avg.toFixed(1) + '%', 'margin เฉลี่ย', GOLD], [stats.flagged, 'ดีลต้องระวัง', stats.flagged > 0 ? '#b91c1c' : '#1f2430']].map(([n, l, c], i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #e7e1d2', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{n as any}</div>
                  <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 6 }}>{l as string}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={loadSample} style={{ background: '#fff', color: GREEN, border: '1px solid #e7e1d2', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>โหลดตัวอย่าง</button>
              <button onClick={() => setDeals([])} style={{ background: '#fff', color: GREEN, border: '1px solid #e7e1d2', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>ล้างทั้งหมด</button>
              <button onClick={exportCsv} style={{ background: '#fff', color: GREEN, border: '1px solid #e7e1d2', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>⬇️ CSV</button>
            </div>
            {deals.length === 0 ? (
              <div style={{ color: '#9aa1ab', textAlign: 'center', padding: 22, fontSize: 14 }}>ยังไม่มีดีล — เพิ่มจากแท็บ “คิดกำไรต่อชิ้น” หรือกด “โหลดตัวอย่าง”</div>
            ) : (
              <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e7e1d2', borderRadius: 12 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 620 }}>
                  <thead><tr>
                    {['อะไหล่/งาน', 'ราคาขาย', 'ต้นทุนรวม', 'กำไร', 'margin', 'สถานะ', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '9px 10px', borderBottom: '1px solid #e7e1d2', background: '#faf6ee', fontSize: 12, color: '#6b7280' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {deals.map((d, i) => {
                      const dl = levelOf(d.margin)
                      return (
                        <tr key={i} style={{ background: dl === 'red' ? '#fff5f5' : '#fff' }}>
                          <td style={{ textAlign: 'left', padding: '9px 10px', borderBottom: '1px solid #e7e1d2' }}>{d.name}</td>
                          <td style={{ textAlign: 'right', padding: '9px 10px', borderBottom: '1px solid #e7e1d2' }}>{baht(d.price)}</td>
                          <td style={{ textAlign: 'right', padding: '9px 10px', borderBottom: '1px solid #e7e1d2' }}>{baht(d.costs)}</td>
                          <td style={{ textAlign: 'right', padding: '9px 10px', borderBottom: '1px solid #e7e1d2', color: d.profit < 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>{baht(d.profit)}</td>
                          <td style={{ textAlign: 'right', padding: '9px 10px', borderBottom: '1px solid #e7e1d2' }}>{d.margin.toFixed(1)}%</td>
                          <td style={{ textAlign: 'right', padding: '9px 10px', borderBottom: '1px solid #e7e1d2' }}>{pillText(dl)}</td>
                          <td style={{ textAlign: 'right', padding: '9px 10px', borderBottom: '1px solid #e7e1d2' }}>
                            <button onClick={() => delDeal(i)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 15 }} aria-label="ลบ">🗑</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== SETTINGS ===== */}
        {tab === 'set' && (
          <div style={{ background: '#fff', border: '1px solid #e7e1d2', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>เกณฑ์เตือนกำไร (%margin)</div>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0 }}>ตั้งเกณฑ์ให้ธงเตือนตามนโยบายร้าน · ใช้ทั้งหน้าคิดกำไรและรายการดีล</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ width: 150 }}><label style={lab}>🟢 กำไรดี ตั้งแต่ (%)</label>
                <input style={inp} type="number" value={thGreen} onChange={(e) => setThGreen(numv(e.target.value))} /></div>
              <div style={{ width: 150 }}><label style={lab}>🟡 พอได้ ตั้งแต่ (%)</label>
                <input style={inp} type="number" value={thYellow} onChange={(e) => setThYellow(numv(e.target.value))} /></div>
            </div>
            <div style={{ background: '#f6ecdd', border: '1px solid #ecdcc4', borderRadius: 10, padding: '11px 12px', fontSize: 13, marginTop: 16 }}>
              ต่ำกว่า 🟡 = 🔴 เสี่ยงขาดทุน/กำไรน้อย · ค่าเริ่มต้น: 🟢 ≥20% · 🟡 10–20% · 🔴 &lt;10%
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: '#8a8a8a', marginTop: 16, lineHeight: 1.6 }}>
          เครื่องคิดเลขช่วยตัดสินใจราคา · ไม่บันทึกถาวร (รายการดีลหายเมื่อรีเฟรช) · ยังไม่ดึงราคาทอง/ค่าเงินอัตโนมัติ · v2: บันทึกดีล + ผูก lead/order ใน OpsBrief
        </p>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '10px 16px', borderRadius: 22, fontSize: 13, zIndex: 50 }}>{toast}</div>}
      <style>{`@media(max-width:680px){.pg-grid{grid-template-columns:1fr !important}}`}</style>
    </div>
  )
}
