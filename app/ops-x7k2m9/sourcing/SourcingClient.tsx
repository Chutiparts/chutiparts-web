'use client'
// app/ops-x7k2m9/sourcing/SourcingClient.tsx
// เครื่องมือหาของฝั่งใน (พี่/ทีมใช้หา · ไม่ใช่หน้าลูกค้า) — client-side ล้วน · เก็บรายการใน localStorage ต่อเครื่อง
// CSS namespace ใต้ .shx กันชนกับ ops หน้าอื่น
import { useState, useEffect } from 'react'

type Row = { date: string; part: string; pn: string; src: string; link: string; price: string; ship: string; cond: string; sup: string; note: string }
const EMPTY: Row = { date: '', part: '', pn: '', src: '', link: '', price: '', ship: '', cond: '', sup: '', note: '' }

const CSS = `
.shx{--green:#17301F;--brass:#B8895A;--cream:#F4EFE4;--line:#e2ddcf;--red:#A32D2D;background:var(--cream);min-height:100vh;font-family:-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;color:#1a1a1a;line-height:1.5}
.shx *{box-sizing:border-box}
.shx .wrap{max-width:900px;margin:0 auto;padding:14px}
.shx header{background:var(--green);color:#fff;padding:16px}
.shx header .wrap{padding:0 14px}
.shx h1{font-size:19px;margin:0}
.shx .sub{font-size:12.5px;color:#cbd8cf;margin-top:3px}
.shx .warn{background:#fff4e6;border:1px solid #f0c78a;color:#7c4a13;border-radius:10px;padding:10px 12px;font-size:12.5px;margin:12px 0;font-weight:600}
.shx .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px}
.shx .card h2{font-size:15px;color:var(--green);margin:0 0 10px}
.shx label{display:block;font-size:12px;color:#555;font-weight:600;margin:8px 0 3px}
.shx input{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;font-family:inherit}
.shx .row{display:flex;gap:8px;flex-wrap:wrap}
.shx .row>div{flex:1;min-width:120px}
.shx .links{display:flex;flex-direction:column;gap:7px;margin-top:12px}
.shx a.src{display:flex;align-items:center;justify-content:space-between;text-decoration:none;background:#fbfaf6;border:1px solid var(--line);border-radius:9px;padding:9px 12px;color:#1a1a1a;font-size:13.5px;font-weight:600}
.shx a.src:hover{border-color:var(--brass);box-shadow:0 2px 8px rgba(0,0,0,.06)}
.shx a.src .tag{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:#e4f0e8;color:var(--green)}
.shx a.src .tag.b{background:#FAEEDA;color:#854F0B}
.shx a.src .go{color:var(--brass);font-weight:700}
.shx a.src.off{opacity:.45;cursor:default}
.shx a.src.off:hover{border-color:var(--line);box-shadow:none}
.shx a.src.off .go{color:#999;font-weight:600;font-size:11.5px}
.shx .thwarn{background:#fdecec;border:1px solid #f0b3b3;color:#a32d2d;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:600;margin-bottom:4px}
.shx .btn{background:var(--green);color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13.5px;font-weight:600;cursor:pointer}
.shx .btn.ghost{background:#fff;color:#333;border:1px solid #ddd}
.shx .btn.brass{background:var(--brass)}
.shx .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.shx table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
.shx th,.shx td{border:1px solid var(--line);padding:6px 7px;text-align:left;vertical-align:top}
.shx th{background:var(--green);color:#fff;font-weight:600}
.shx tr:nth-child(even) td{background:#fbfaf6}
.shx .muted{color:#888;font-size:11.5px}
.shx .ref li{margin-bottom:5px;font-size:13px}
.shx .del{color:var(--red);cursor:pointer;font-weight:700}
.shx .toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;padding:9px 16px;border-radius:999px;font-size:13px;opacity:0;transition:.2s;pointer-events:none;z-index:50}
.shx .toast.show{opacity:1}
`

const enc = (s: string) => encodeURIComponent((s || '').trim())

export default function SourcingClient({ role = 'owner' }: { role?: string }) {
  const isOwner = role === 'owner'
  const [q, setQ] = useState('')
  const [model, setModel] = useState('')
  const [pn, setPn] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [f, setF] = useState<Row>(EMPTY)
  const [toast, setToast] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  // P1 · Landed Cost Simulation (owner-only · คำนวณล้วน · ไม่บันทึก/ไม่เขียน DB · ephemeral)
  const [sim, setSim] = useState({ buy: '', qty: '1', ship: '', fees: '', sell: '' })
  const setSim1 = (k: keyof typeof sim, v: string) => setSim((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    try { const s = localStorage.getItem('cb_sourcing'); if (s) setRows(JSON.parse(s)) } catch {}
  }, [])
  const persist = (r: Row[]) => { setRows(r); try { localStorage.setItem('cb_sourcing', JSON.stringify(r)) } catch {} }

  let tmr: ReturnType<typeof setTimeout>
  const flash = (m: string) => { setToastMsg(m); setToast(true); clearTimeout(tmr); tmr = setTimeout(() => setToast(false), 1600) }

  const qs = [pn, q, model].filter((x) => x && x.trim()).join(' ').trim()
  const hasQ = !!qs
  const e = enc(qs), epn = enc(pn), eb = enc((qs ? qs + ' ' : '') + 'mercedes')
  const isThai = /[฀-๿]/.test(qs)

  const srcs: [string, string, string | null, string][] = [
    ['🔎 Google — ไทย/อังกฤษก็ได้ → หา part number (เริ่มที่นี่)', 'A', hasQ ? 'https://www.google.com/search?q=' + eb + '+part+number' : null, 'พิมพ์ชื่อ/รุ่นด้านบน'],
    ['🇬🇧 eBay UK (RHD) — พิมพ์อังกฤษ', 'B', hasQ ? 'https://www.ebay.co.uk/sch/i.html?_nkw=' + e : null, 'พิมพ์ชื่อด้านบน'],
    ['🇭🇰 eBay HK — พิมพ์อังกฤษ', 'B', hasQ ? 'https://www.ebay.com.hk/sch/i.html?_nkw=' + e : null, 'พิมพ์ชื่อด้านบน'],
    ['🇦🇺 eBay Australia (RHD) — พิมพ์อังกฤษ', 'B', hasQ ? 'https://www.ebay.com.au/sch/i.html?_nkw=' + e : null, 'พิมพ์ชื่อด้านบน'],
    ['🇯🇵 Yahoo Auctions JP — ของญี่ปุ่น (รหัส/รุ่น)', 'B', hasQ ? 'https://auctions.yahoo.co.jp/search/search?p=' + e : null, 'พิมพ์ชื่อ/รหัสด้านบน'],
    ['🇹🇼 Ruten ไต้หวัน — เปิดเว็บ ค้นในหน้า', 'B', 'https://www.ruten.com.tw/', 'เปิดเว็บ'],
    ['🛒 PartSouq — ต้องใส่ part number เท่านั้น', 'A', pn ? 'https://partsouq.com/en/search/all?q=' + epn : null, 'ใส่ Part Number ก่อน'],
    ['⭐ MB Classic Parts (ทางการ · ค้นในหน้า)', 'A', 'https://partssearch.mercedes-benz-classic.com/', 'เปิดเว็บ'],
  ]

  const setField = (k: keyof Row, v: string) => setF((p) => ({ ...p, [k]: v }))
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
  const addRow = () => {
    if (!f.part.trim() && !f.pn.trim()) { flash('ใส่ชื่อชิ้นหรือ Part Number ก่อน'); return }
    persist([...rows, { ...f, date: today() }])
    setF(EMPTY); flash('เพิ่มแล้ว')
  }
  const del = (i: number) => persist(rows.filter((_, idx) => idx !== i))
  const clearAll = () => { if (confirm('ล้างรายการทั้งหมด?')) persist([]) }
  const copyTSV = () => {
    if (!rows.length) { flash('ยังไม่มีรายการ'); return }
    const tsv = rows.map((r) => [r.date, r.part, r.pn, r.src, r.link, r.price, r.ship, r.sup, r.cond, r.note].join('\t')).join('\n')
    navigator.clipboard?.writeText(tsv).then(() => flash('คัดลอกแล้ว — วางในชีต ประวัติการหา ได้เลย'), () => flash('คัดลอกไม่สำเร็จ'))
  }

  return (
    <div className="shx">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header><div className="wrap">
        <h1>🔧 ChutiBenz — เครื่องมือหาของฝั่งใน</h1>
        <div className="sub">Sourcing Helper · อะไหล่ Mercedes-Benz 80s–90s · ใช้ตอนหาของ/พรีออเดอร์</div>
      </div></header>

      <div className="wrap">
        <div className="warn">⚠️ ใช้ภายในเท่านั้น (พี่/ทีม) · ผลจากแหล่งภายนอก <b>ห้ามส่งดิบให้ลูกค้า</b> — คัด → ระบุชิ้น → เสนอ &quot;ราคาถึงมือ&quot; (ของ+ส่ง+ภาษี+ค่าหา) → เก็บ 100% ก่อนสั่ง</div>

        <div className="card">
          <h2>① พิมพ์สิ่งที่จะหา → เปิดค้นทุกแหล่ง</h2>
          <div className="row">
            <div><label>ชื่ออะไหล่ (TH/EN)</label><input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="เช่น ไฟท้าย / tail light / ปั๊มติ๊ก" /></div>
            <div><label>รุ่น</label><input value={model} onChange={(ev) => setModel(ev.target.value)} placeholder="เช่น W140 / W124" /></div>
            <div><label>Part Number (ถ้ามี)</label><input value={pn} onChange={(ev) => setPn(ev.target.value)} placeholder="เช่น 140 820 64 64" /></div>
          </div>
          <div className="links">
            {isThai && <div className="thwarn">⚠️ พิมพ์ภาษาไทย: <b>Google ใช้ได้เลย</b> (อ่านไทยออก + หา part number ได้) · แต่ <b>eBay ต้องพิมพ์อังกฤษ</b> ไม่งั้น 0 ผล — เริ่มที่ Google ก่อน</div>}
            {srcs.map((s, i) => {
              const active = !!s[2]
              return (
                <a key={i} className={'src' + (active ? '' : ' off')} href={active ? (s[2] as string) : undefined} target={active ? '_blank' : undefined} rel={active ? 'noopener noreferrer' : undefined} onClick={active ? undefined : (ev) => ev.preventDefault()}>
                  <span><span className={'tag' + (s[1] === 'B' ? ' b' : '')}>ชั้น {s[1]}</span> &nbsp;{s[0]}</span>
                  <span className="go">{active ? 'เปิด →' : (s[3] || '—')}</span>
                </a>
              )
            })}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>💡 <b>ค้นด้วยชื่อ/รุ่น</b> → ใช้ได้แค่ <b>Google + eBay</b> (พิมพ์อังกฤษ เช่น &quot;Bilstein B8 W140&quot;) · <b>PartSouq ต้องใส่ part number เท่านั้น</b> · <b>Ruten/MB Classic</b> เปิดแล้วค้นในหน้า · ปุ่มจาง = ยังกดไม่ได้ (ขาดข้อมูล)</div>
        </div>

        <div className="card">
          <h2>② บันทึกผลที่เจอ → คัดลอกลง KB</h2>
          <div className="row">
            <div><label>ชิ้น</label><input value={f.part} onChange={(ev) => setField('part', ev.target.value)} placeholder="ไฟท้าย W140 ขวา" /></div>
            <div><label>Part Number</label><input value={f.pn} onChange={(ev) => setField('pn', ev.target.value)} placeholder="140 820 ..." /></div>
            <div><label>แหล่งที่เจอ</label><input value={f.src} onChange={(ev) => setField('src', ev.target.value)} placeholder="eBay UK / Yahoo JP ..." /></div>
          </div>
          <div className="row">
            <div><label>ราคาของ</label><input value={f.price} onChange={(ev) => setField('price', ev.target.value)} placeholder="3500" /></div>
            <div><label>ค่าส่ง+ภาษี (ประเมิน)</label><input value={f.ship} onChange={(ev) => setField('ship', ev.target.value)} placeholder="1200" /></div>
            <div><label>สภาพ</label><input value={f.cond} onChange={(ev) => setField('cond', ev.target.value)} placeholder="used ดี / NOS" /></div>
          </div>
          <div className="row">
            <div style={{ flex: 2 }}><label>ลิงก์</label><input value={f.link} onChange={(ev) => setField('link', ev.target.value)} placeholder="วางลิงก์ประกาศ" /></div>
            <div style={{ flex: 2 }}><label>ซัพพลายเออร์/ผู้ขาย</label><input value={f.sup} onChange={(ev) => setField('sup', ev.target.value)} placeholder="seller_xxx (DE)" /></div>
          </div>
          <div><label>โน้ต</label><input value={f.note} onChange={(ev) => setField('note', ev.target.value)} placeholder="ส่ง 10-14 วัน / ต้องยืนยันรหัส" /></div>
          <div className="actions">
            <button className="btn" onClick={addRow}>➕ เพิ่มลงรายการ</button>
            <button className="btn brass" onClick={copyTSV}>📋 คัดลอกเป็นตาราง (วางใน KB → ประวัติการหา)</button>
            <button className="btn ghost" onClick={clearAll}>ล้างรายการ</button>
          </div>
          <table><thead><tr>
            <th>วันที่</th><th>ชิ้น</th><th>PN</th><th>แหล่ง</th><th>ราคา</th><th>ส่ง+ภาษี</th><th>สภาพ</th><th>ซัพพลายเออร์</th><th>โน้ต</th><th></th>
          </tr></thead><tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.date}</td><td>{r.part}</td><td>{r.pn}</td><td>{r.src}</td><td>{r.price}</td><td>{r.ship}</td><td>{r.cond}</td><td>{r.sup}</td><td>{r.note}</td>
                <td><span className="del" onClick={() => del(i)}>✕</span></td>
              </tr>
            ))}
          </tbody></table>
          <div className="muted" style={{ marginTop: 6 }}>รายการเก็บในเบราว์เซอร์นี้ (localStorage) · กด &quot;คัดลอกเป็นตาราง&quot; แล้ววางในชีต <b>ประวัติการหา</b> ได้เลย</div>
        </div>

        {isOwner && (() => {
          const nBuy = parseFloat(sim.buy), nQty = parseFloat(sim.qty), nShip = parseFloat(sim.ship) || 0, nFees = parseFloat(sim.fees) || 0, nSell = parseFloat(sim.sell)
          const valid = !isNaN(nBuy) && nBuy > 0 && !isNaN(nQty) && nQty > 0
          const landed = valid ? nBuy + (nShip + nFees) / nQty : null
          const hasSell = !isNaN(nSell) && nSell > 0
          const profit = (landed !== null && hasSell) ? nSell - landed : null
          const margin = (profit !== null && hasSell) ? (profit / nSell) * 100 : null
          const total = (profit !== null) ? profit * nQty : null
          const baht = (n: number) => '฿' + Math.round(n).toLocaleString()
          return (
            <div className="card">
              <h2>🧮 จำลองต้นทุนถึงมือ + กำไร (Landed Cost Simulation)</h2>
              <div className="muted" style={{ marginBottom: 8 }}><b>เฉพาะเจ้าของ</b> · ช่วยตัดสินใจก่อนสั่งซื้อ — <b>simulation เท่านั้น ยังไม่บันทึกจริง</b> · ไม่เขียนกลับ stock/ledger</div>
              <div className="row">
                <div><label>ราคาซื้อ/ชิ้น (บาท)</label><input inputMode="decimal" value={sim.buy} onChange={(ev) => setSim1('buy', ev.target.value)} placeholder="3500" /></div>
                <div><label>จำนวน (ชิ้น)</label><input inputMode="decimal" value={sim.qty} onChange={(ev) => setSim1('qty', ev.target.value)} placeholder="1" /></div>
                <div><label>ราคาขายคาดการณ์/ชิ้น</label><input inputMode="decimal" value={sim.sell} onChange={(ev) => setSim1('sell', ev.target.value)} placeholder="8000" /></div>
              </div>
              <div className="row">
                <div><label>ค่าขนส่งรวม (ทั้งล็อต)</label><input inputMode="decimal" value={sim.ship} onChange={(ev) => setSim1('ship', ev.target.value)} placeholder="1200" /></div>
                <div><label>ภาษี/ค่าใช้จ่ายรวม (ทั้งล็อต)</label><input inputMode="decimal" value={sim.fees} onChange={(ev) => setSim1('fees', ev.target.value)} placeholder="600" /></div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn ghost" onClick={() => setSim({ buy: '', qty: '1', ship: '', fees: '', sell: '' })}>ล้างค่า</button></div>
              </div>
              {!valid ? (
                <div className="thwarn" style={{ marginTop: 12 }}>กรอก <b>ราคาซื้อ/ชิ้น</b> และ <b>จำนวน</b> (มากกว่า 0) ก่อน — ข้อมูลไม่พอ คำนวณไม่ได้</div>
              ) : (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130, background: '#f4efe4', border: '1px solid #e2ddcf', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#777' }}>Landed cost/ชิ้น</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#17301F' }}>{baht(landed as number)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 130, background: hasSell ? ((profit as number) >= 0 ? '#eaf5ee' : '#fdecec') : '#f7f5ef', border: '1px solid #e2ddcf', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#777' }}>กำไร/ชิ้น</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: hasSell ? ((profit as number) >= 0 ? '#0F6E56' : '#A32D2D') : '#999' }}>{hasSell ? baht(profit as number) : '—'}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 130, background: hasSell ? ((margin as number) >= 15 ? '#eaf5ee' : '#faeeda') : '#f7f5ef', border: '1px solid #e2ddcf', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#777' }}>Margin</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: hasSell ? ((margin as number) >= 15 ? '#0F6E56' : '#854F0B') : '#999' }}>{hasSell ? (margin as number).toFixed(1) + '%' : '—'}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 130, background: '#f7f5ef', border: '1px solid #e2ddcf', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#777' }}>กำไรรวม ({nQty} ชิ้น)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: hasSell ? ((total as number) >= 0 ? '#0F6E56' : '#A32D2D') : '#999' }}>{hasSell ? baht(total as number) : '—'}</div>
                  </div>
                </div>
              )}
              {valid && hasSell && margin !== null && margin < 15 && (
                <div className="muted" style={{ marginTop: 8, color: '#854F0B' }}>⚠️ margin ต่ำกว่า 15% — เช็กว่าต้นทุนครบไหม (ค่าเฟรต + surcharge + ค่าใน) ก่อนสั่ง · policy: ไม่ลดราคายกเว้นโปร</div>
              )}
            </div>
          )
        })()}

        <div className="card ref">
          <h2>③ แหล่งอ้างอิง (3 ชั้น)</h2>
          <ul>
            <li><b>ชั้น A ระบุรหัส (ฟรี):</b> MB Classic Parts Search (ทางการ · ของคลาสสิก/เลิกผลิต) · PartSouq · Mercedes EPC</li>
            <li><b>ชั้น B หาของ:</b> eBay <b>UK / HK / Australia</b> (เน้น RHD = พวงมาลัยขวา อะไหล่ใส่รถไทยตรง) · <b>Yahoo Auctions JP</b> + <b>Ruten ไต้หวัน</b> (ของเอเชีย · ค่าส่งมาไทยถูก/เร็วกว่า · มักต้องใช้ตัวแทนนำเข้า/proxy เช่น Buyee)</li>
            <li><b>ชั้น C เทียบข้ามรุ่น:</b> TecDoc (เสียเงิน · ทำเมื่อจำเป็น)</li>
          </ul>
          <div className="muted">หลัก: ใช้ของฟรีก่อน + สะสมฐานข้อมูลตัวเอง (KB) → ค่อยจ่าย TecDoc เมื่อไม่พอจริง · moat = ฐานพี่เอง ไม่ใช่แหล่งสาธารณะ</div>
        </div>
      </div>

      {toast && <div className="toast show">{toastMsg}</div>}
    </div>
  )
}
