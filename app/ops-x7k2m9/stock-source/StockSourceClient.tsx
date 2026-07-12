'use client'
// app/ops-x7k2m9/stock-source/StockSourceClient.tsx — Stock Source / Reorder Reminder P2+P3
// จับคู่ demand (sales_records) กับ supply (stock_records) → เตือน "ของขายได้แต่หมด/เหลือน้อย = ควรหาเพิ่ม" + "ของค้างนาน = อย่าเพิ่งสั่งซ้ำ"
// P3.1: แท็บลูกค้าถามหา (contact_leads) · P3.3: แหล่งซื้อจาก DB (stock_records.source) + memo localStorage เป็น fallback
// อ่านล้วน ไม่เขียน DB · เกณฑ์ปรับได้+จำ localStorage · export CSV/TXT/JSON (BOM)
import { useMemo, useState, useEffect } from 'react'

type Row = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

export const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }
const baht = (v: any) => '฿' + Math.round(num(v)).toLocaleString()
const todayStr = () => new Date().toISOString().slice(0, 10)
function fmtDate(d?: string | null) { if (!d) return '-'; const x = new Date(d); if (isNaN(x.getTime())) return '-'; return `${x.getDate()}/${x.getMonth() + 1}/${(x.getFullYear() + 543) % 100}` }

// ===== pure logic (เทสได้) =====
export const norm = (s: any) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
export const keyOf = (part: any, model: any) => norm(part) + '|' + norm(model)
export function ageDays(d?: string | null, now?: Date) {
  if (!d) return 0
  const x = new Date(d); if (isNaN(x.getTime())) return 0
  return Math.max(0, Math.floor(((now || new Date()).getTime() - x.getTime()) / 86400000))
}
export type Cfg = { windowDays: number; minSold: number; lowStock: number; ageDays: number }
export const DEFAULTS: Cfg = { windowDays: 90, minSold: 2, lowStock: 1, ageDays: 60 }

// demand group: ต่อ (อะไหล่+รุ่น) — ขายกี่ครั้ง ราคา/กำไรเฉลี่ย ขายล่าสุด vs เหลือในสต็อกกี่ชิ้น
export function buildDemand(sales: Row[], stock: Row[], cfg: Cfg, now?: Date) {
  const nw = now || new Date()
  const inWindow = (d?: string | null) => !cfg.windowDays || ageDays(d, nw) <= cfg.windowDays
  const inStockCount: Record<string, number> = {}
  for (const s of stock) {
    if (String(s.status || 'in_stock') !== 'in_stock') continue
    const k = keyOf(s.part_name, s.car_model)
    inStockCount[k] = (inStockCount[k] || 0) + 1
  }
  const g: Record<string, any> = {}
  for (const r of sales) {
    if (!inWindow(r.sale_date)) continue
    const k = keyOf(r.part_sold, r.car_model)
    if (!g[k]) g[k] = { key: k, part: r.part_sold || '(ไม่ระบุ)', model: r.car_model || '', sold: 0, sumPrice: 0, sumProfit: 0, lastSold: r.sale_date || '' }
    g[k].sold += 1
    g[k].sumPrice += num(r.sale_price)
    g[k].sumProfit += num(r.sale_price) - num(r.cost)
    if ((r.sale_date || '') > g[k].lastSold) g[k].lastSold = r.sale_date || ''
  }
  return Object.values(g).map((x: any) => {
    const left = inStockCount[x.key] || 0
    // urgent = ขายถึงเกณฑ์ขายดี + ของหมดเกลี้ยง · low = เหลือ ≤ เกณฑ์ (รวมกรณีหมดแต่ขายไม่ถึงเกณฑ์) · ok = พอ
    const flag = left === 0 && x.sold >= cfg.minSold ? 'urgent' : left <= cfg.lowStock ? 'low' : 'ok'
    return { ...x, left, avgPrice: x.sold ? x.sumPrice / x.sold : 0, avgProfit: x.sold ? x.sumProfit / x.sold : 0, flag }
  }).sort((a: any, b: any) => (a.flag === b.flag ? b.sold - a.sold : rank(a.flag) - rank(b.flag)))
}
const rank = (f: string) => (f === 'urgent' ? 0 : f === 'low' ? 1 : 2)

// ของค้างนาน (in_stock อายุ ≥ เกณฑ์) — สัญญาณ "อย่าเพิ่งสั่งซ้ำ + ควรดันขาย"
export function buildAging(stock: Row[], cfg: Cfg, now?: Date): Row[] {
  return stock
    .filter((s) => String(s.status || 'in_stock') === 'in_stock' && ageDays(s.date_in, now) >= cfg.ageDays)
    .map((s) => ({ ...s, age: ageDays(s.date_in, now) }))
    .sort((a, b) => b.age - a.age)
}

// P3.1: ลูกค้าถามหา (contact_leads) — "ของที่คนถามแต่เราไม่มีขาย" = demand ที่ยังไม่เคยเป็นยอดขาย
const CLOSED_LEAD = ['won', 'lost']
export function buildAsks(leads: Row[], stock: Row[], cfg: Cfg, now?: Date): Row[] {
  const nw = now || new Date()
  const inStockCount: Record<string, number> = {}
  for (const s of stock) {
    if (String(s.status || 'in_stock') !== 'in_stock') continue
    const k = keyOf(s.part_name, s.car_model)
    inStockCount[k] = (inStockCount[k] || 0) + 1
  }
  const g: Record<string, any> = {}
  for (const l of leads) {
    if (CLOSED_LEAD.includes(String(l.status || 'new'))) continue
    const part = l.part_wanted || l.part_number
    if (!part) continue
    const created = (l.created_at || '').slice(0, 10)
    if (cfg.windowDays && ageDays(created, nw) > cfg.windowDays) continue
    const k = keyOf(part, l.car_model)
    if (!g[k]) g[k] = { key: k, part, model: l.car_model || '', asks: 0, lastAsked: created }
    g[k].asks += 1
    if (created > g[k].lastAsked) g[k].lastAsked = created
  }
  return Object.values(g).map((x: any) => {
    const left = inStockCount[x.key] || 0
    return { ...x, left, flag: left === 0 ? 'wanted' : 'have' }
  }).sort((a: any, b: any) => (a.flag === b.flag ? b.asks - a.asks : a.flag === 'wanted' ? -1 : 1))
}

// P3.3: แหล่งซื้อจาก DB (stock_records.source) — key → source ล่าสุดที่ไม่ว่าง (นับทุก status เพราะของขายแล้วก็บอกแหล่งได้)
export function buildSourceMap(stock: Row[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const s of stock) {
    const src = String(s.source || '').trim()
    if (!src) continue
    m[keyOf(s.part_name, s.car_model)] = src
  }
  return m
}

// ===== UI =====
const LS_CFG = 'chutibenz_stocksource_cfg'
const LS_SRC = 'chutibenz_stocksource_memo' // { [key]: { src: 'แหล่งซื้อ', buy: 'ราคาซื้อโดยประมาณ' } }

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const finp: React.CSSProperties = { width: 64, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, marginLeft: 4 }
const minp: React.CSSProperties = { padding: '6px 8px', border: '1px solid #ddd', borderRadius: 7, fontSize: 12.5, flex: 1, minWidth: 110 }

const FLAG: Record<string, { th: string; bg: string; fg: string }> = {
  urgent: { th: '🔴 ขายได้แต่ของหมด — ควรหาด่วน', bg: '#FCEBEB', fg: '#A32D2D' },
  low: { th: '🟡 เหลือน้อย — เตรียมหาเพิ่ม', bg: '#FAEEDA', fg: '#854F0B' },
  ok: { th: '🟢 สต็อกพอ', bg: '#E1F5EE', fg: '#0F6E56' },
}
const ASK_FLAG: Record<string, { th: string; bg: string; fg: string }> = {
  wanted: { th: '🔎 คนถามแต่ไม่มีของ — น่าหามาขาย', bg: '#FCEBEB', fg: '#A32D2D' },
  have: { th: '✅ มีของ! รีบเสนอลูกค้า', bg: '#E1F5EE', fg: '#0F6E56' },
}

export default function StockSourceClient({ sales, stock, leads = [] }: { sales: Row[]; stock: Row[]; leads?: Row[] }) {
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS)
  const [memo, setMemo] = useState<Record<string, { src?: string; buy?: string }>>({})
  const [tab, setTab] = useState<'reorder' | 'aging' | 'asks'>('reorder')
  const [toast, setToast] = useState('')
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1500) }
  useEffect(() => {
    try { const s = localStorage.getItem(LS_CFG); if (s) setCfg({ ...DEFAULTS, ...JSON.parse(s) }) } catch {}
    try { const s = localStorage.getItem(LS_SRC); if (s) setMemo(JSON.parse(s)) } catch {}
  }, [])
  const setC = (k: keyof Cfg, v: number) => setCfg((s) => { const n = { ...s, [k]: isNaN(v) || v < 0 ? 0 : v }; try { localStorage.setItem(LS_CFG, JSON.stringify(n)) } catch {}; return n })
  const setM = (key: string, field: 'src' | 'buy', v: string) => setMemo((m) => { const n = { ...m, [key]: { ...m[key], [field]: v } }; try { localStorage.setItem(LS_SRC, JSON.stringify(n)) } catch {}; return n })

  const demand = useMemo(() => buildDemand(sales, stock, cfg), [sales, stock, cfg])
  const aging = useMemo(() => buildAging(stock, cfg), [stock, cfg])
  const asks = useMemo(() => buildAsks(leads, stock, cfg), [leads, stock, cfg])
  const srcDb = useMemo(() => buildSourceMap(stock), [stock])
  const D = useMemo(() => {
    const urgent = demand.filter((x: any) => x.flag === 'urgent')
    const low = demand.filter((x: any) => x.flag === 'low')
    const agingCost = aging.reduce((a, s) => a + num(s.cost), 0)
    const wanted = asks.filter((x: any) => x.flag === 'wanted')
    return { urgent: urgent.length, low: low.length, groups: demand.length, aging: aging.length, agingCost, wanted: wanted.length }
  }, [demand, aging, asks])

  const copy = (t: string, m = 'คัดลอกแล้ว') => navigator.clipboard?.writeText(t).then(() => flash(m))
  // แหล่งซื้อ: DB (แชร์ทั้งทีม) มาก่อน → memo ในเครื่องเป็น fallback
  const srcOf = (key: string) => srcDb[key] || memo[key]?.src || ''

  // สรุปรายการควรสั่งซื้อ (ก๊อปส่งไลน์ทีม/ใช้ตอนไปเดินหาของ)
  const buyList = () => {
    const items = demand.filter((x: any) => x.flag !== 'ok')
    const wanted = asks.filter((x: any) => x.flag === 'wanted')
    if (!items.length && !wanted.length) return 'ChutiBenz — วันนี้ไม่มีรายการที่ควรสั่งเพิ่ม 🟢'
    const L1 = items.map((x: any) => {
      const m = memo[x.key] || {}, src = srcOf(x.key)
      return `▪ ${x.part}${x.model ? ` (${x.model})` : ''} — ขายไป ${x.sold} ครั้ง/${cfg.windowDays}วัน · เหลือ ${x.left} · ขายเฉลี่ย ${baht(x.avgPrice)}${src ? ` · แหล่ง: ${src}` : ''}${m.buy ? ` · ทุนซื้อ ~${m.buy}` : ''}`
    })
    const L2 = wanted.map((x: any) => `▪ ${x.part}${x.model ? ` (${x.model})` : ''} — ลูกค้าถาม ${x.asks} ครั้ง/${cfg.windowDays}วัน · ยังไม่มีของ${srcOf(x.key) ? ` · แหล่ง: ${srcOf(x.key)}` : ''}`)
    return `ChutiBenz — รายการควรหา/สั่งเพิ่ม (${new Date().toLocaleDateString('th-TH')})\n`
      + (L1.length ? `— ขายดี/ของหมด —\n${L1.join('\n')}` : '')
      + (L1.length && L2.length ? '\n' : '')
      + (L2.length ? `— ลูกค้าถามหา ยังไม่มีของ —\n${L2.join('\n')}` : '')
  }

  // export
  function dl(name: string, text: string, type: string) { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u) }
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const exportCsv = () => {
    const cols = ['part', 'car_model', 'sold_in_window', 'in_stock_left', 'avg_sale_price', 'avg_profit', 'last_sold', 'flag', 'source_memo', 'buy_cost_memo']
    const lines = demand.map((x: any) => [x.part, x.model, x.sold, x.left, Math.round(x.avgPrice), Math.round(x.avgProfit), x.lastSold, FLAG[x.flag].th, srcOf(x.key), memo[x.key]?.buy || ''].map(esc).join(','))
    dl(`stock-source-${todayStr()}.csv`, '\uFEFF' + [cols.join(','), ...lines].join('\r\n'), 'text/csv;charset=utf-8')
  }
  const exportTxt = () => dl(`stock-source-${todayStr()}.txt`, '\uFEFF' + buyList() + `\n${'─'.repeat(40)}\n📦 ของค้างนาน ≥${cfg.ageDays} วัน (อย่าเพิ่งสั่งซ้ำ · ควรดันขาย): ${aging.length} ชิ้น · ทุนจม ${baht(D.agingCost)}\n` + aging.map((s) => `▪ ${s.part_name || '(ไม่ระบุ)'}${s.car_model ? ` (${s.car_model})` : ''} — ค้าง ${s.age} วัน · ทุน ${baht(s.cost)} · ตั้งขาย ${baht(s.set_price)}${s.location ? ` · ${s.location}` : ''}`).join('\n'), 'text/plain;charset=utf-8')
  const exportJson = () => dl(`stock-source-${todayStr()}.json`, JSON.stringify({ cfg, summary: D, reorder: demand.map((x: any) => ({ part: x.part, model: x.model, sold: x.sold, left: x.left, avg_price: Math.round(x.avgPrice), avg_profit: Math.round(x.avgProfit), last_sold: x.lastSold, flag: x.flag, source: srcOf(x.key), buy_cost: memo[x.key]?.buy || '' })), customer_asks: asks.map((x: any) => ({ part: x.part, model: x.model, asks: x.asks, in_stock: x.left, last_asked: x.lastAsked, flag: x.flag })), aging: aging.map((s) => ({ part: s.part_name, model: s.car_model, age_days: s.age, cost: num(s.cost), set_price: num(s.set_price), location: s.location || '', source: s.source || '' })) }, null, 2), 'application/json')

  const stat = (label: string, val: string, color: string) => (
    <div style={{ flex: 1, minWidth: 100, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div><div style={{ fontSize: 10.5, color: '#777' }}>{label}</div></div>
  )
  const tbtn = (id: 'reorder' | 'aging' | 'asks', label: string) => (
    <button onClick={() => setTab(id)} style={{ ...qbtn, background: tab === id ? GREEN : '#fff', color: tab === id ? '#fff' : '#333', borderColor: tab === id ? GREEN : '#ddd' }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>📦 Stock Source · Reorder Reminder</div>
            <div style={{ fontSize: 12, color: '#cbd8cf' }}>ของอะไรขายได้แต่หมด = ควรหาเพิ่ม · ของอะไรค้างนาน = อย่าเพิ่งสั่งซ้ำ · อ่านจาก Ledger · {new Date().toLocaleDateString('th-TH')}</div>
            {/* P0.1 legend สีธง — ข้อความเดียวกันทุกหน้า */}
            <div style={{ fontSize: 11.5, color: '#a9bfb1', marginTop: 4 }}>🔴 = ต้องทำทันที · 🟡 = ควรระวัง/ติดตาม · 🟢 = ปกติ/พอใช้</div>
          </div>
          <a href="/ops-x7k2m9/ledger" style={{ ...qbtn, textDecoration: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>→ Ledger (บันทึกขาย/สต็อก)</a>
        </div>
      </div>

      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {/* เกณฑ์ */}
        <div style={{ ...card, background: '#fbfaf6' }}>
          <div style={{ fontWeight: 700, color: GREEN, fontSize: 13, marginBottom: 8 }}>⚙️ เกณฑ์เตือน (จำอัตโนมัติ · ปรับตามจริงของร้าน)</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: '#555' }}>
            <label>ดูยอดขายย้อนหลัง <input type="number" value={cfg.windowDays} onChange={(e) => setC('windowDays', Number(e.target.value))} style={finp} /> วัน</label>
            <label>ขายดี = ขาย ≥ <input type="number" value={cfg.minSold} onChange={(e) => setC('minSold', Number(e.target.value))} style={finp} /> ครั้ง</label>
            <label>เหลือน้อย = เหลือ ≤ <input type="number" value={cfg.lowStock} onChange={(e) => setC('lowStock', Number(e.target.value))} style={finp} /> ชิ้น</label>
            <label>ค้างนาน ≥ <input type="number" value={cfg.ageDays} onChange={(e) => setC('ageDays', Number(e.target.value))} style={finp} /> วัน</label>
          </div>
        </div>

        {/* dashboard */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {stat('ควรหาด่วน', String(D.urgent), '#A32D2D')}
          {stat('เหลือน้อย', String(D.low), '#854F0B')}
          {stat('ถามหาแต่ไม่มีของ', String(D.wanted), '#A32D2D')}
          {stat('รายการขายในช่วง', String(D.groups), GREEN)}
          {stat(`ค้าง ≥${cfg.ageDays} วัน`, String(D.aging), '#854F0B')}
          {stat('ทุนจมของค้าง', baht(D.agingCost), '#A32D2D')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {tbtn('reorder', `🛒 ควรหา/สั่งเพิ่ม (${D.urgent + D.low})`)}
          {tbtn('asks', `🙋 ลูกค้าถามหา (${asks.length})`)}
          {tbtn('aging', `🕸️ ของค้างนาน (${D.aging})`)}
          <button onClick={() => copy(buyList(), 'คัดลอกรายการสั่งซื้อแล้ว')} style={{ ...qbtn, background: BRASS, color: '#fff', borderColor: BRASS }}>📋 คัดลอกรายการสั่งซื้อ</button>
          <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
          <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
          <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
        </div>

        {tab === 'reorder' && (<>
          {demand.length === 0 && <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 24 }}>— ยังไม่มีการขายในช่วง {cfg.windowDays} วัน — บันทึกการขายที่หน้า Ledger ก่อน ระบบจะเริ่มจับสัญญาณให้เอง</div>}
          {demand.map((x: any) => {
            const fg = FLAG[x.flag]
            const m = memo[x.key] || {}
            return (
              <div key={x.key} style={{ ...card, borderLeft: `4px solid ${fg.fg}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{x.part}{x.model ? ` · ${x.model}` : ''}</b>
                  <Badge label={fg.th} bg={fg.bg} fg={fg.fg} />
                </div>
                <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>
                  ขายไป <b>{x.sold} ครั้ง</b>/{cfg.windowDays}วัน · เหลือในสต็อก <b style={{ color: fg.fg }}>{x.left} ชิ้น</b> · ขายเฉลี่ย {baht(x.avgPrice)} · กำไรเฉลี่ย {baht(x.avgProfit)}/ชิ้น
                </div>
                <div style={{ fontSize: 11.5, color: '#999', marginTop: 3 }}>ขายล่าสุด {fmtDate(x.lastSold)}{srcDb[x.key] ? ` · 🏬 แหล่งซื้อ: ${srcDb[x.key]}` : ''}{x.flag !== 'ok' && x.avgProfit > 0 ? ` · 💡 หามาเติมได้กำไร ~${baht(x.avgProfit)}/ชิ้น` : ''}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                  <input placeholder={srcDb[x.key] ? 'แหล่งซื้อเพิ่มเติม (จำในเครื่องนี้)' : 'แหล่งซื้อ/ร้านที่เคยได้ (จำในเครื่องนี้)'} value={m.src || ''} onChange={(e) => setM(x.key, 'src', e.target.value)} style={minp} />
                  <input placeholder="ทุนซื้อโดยประมาณ" value={m.buy || ''} onChange={(e) => setM(x.key, 'buy', e.target.value)} style={{ ...minp, maxWidth: 140 }} />
                </div>
              </div>
            )
          })}
        </>)}

        {tab === 'asks' && (<>
          {asks.length === 0 && <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 24 }}>— ยังไม่มีลูกค้าถามหาอะไหล่ในช่วง {cfg.windowDays} วัน — คำถามจากฟอร์ม /ask และ lead ที่บันทึกในระบบจะโผล่ที่นี่เอง</div>}
          {asks.map((x: any) => {
            const fg = ASK_FLAG[x.flag]
            return (
              <div key={x.key} style={{ ...card, borderLeft: `4px solid ${fg.fg}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{x.part}{x.model ? ` · ${x.model}` : ''}</b>
                  <Badge label={fg.th} bg={fg.bg} fg={fg.fg} />
                </div>
                <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>
                  ลูกค้าถาม <b>{x.asks} ครั้ง</b>/{cfg.windowDays}วัน · เหลือในสต็อก <b style={{ color: fg.fg }}>{x.left} ชิ้น</b>
                </div>
                <div style={{ fontSize: 11.5, color: '#999', marginTop: 3 }}>ถามล่าสุด {fmtDate(x.lastAsked)}{srcDb[x.key] ? ` · 🏬 แหล่งซื้อ: ${srcDb[x.key]}` : ''} · {x.flag === 'wanted' ? '💡 มี demand จริงรออยู่ — หามาขายได้เลย' : '💡 เปิด Leads แล้วรีบเสนอลูกค้าที่ถามไว้'}</div>
              </div>
            )
          })}
        </>)}

        {tab === 'aging' && (<>
          {aging.length === 0 && <div style={{ ...card, color: '#aaa', textAlign: 'center', padding: 24 }}>— ไม่มีของค้างเกิน {cfg.ageDays} วัน 🟢</div>}
          {aging.map((s) => (
            <div key={s.id} style={{ ...card, borderLeft: '4px solid #854F0B' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 14 }}>{s.part_name || '(ไม่ระบุ)'}{s.car_model ? ` · ${s.car_model}` : ''}</b>
                <Badge label={`🕸️ ค้าง ${s.age} วัน`} bg="#FAEEDA" fg="#854F0B" />
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>
                ทุน {baht(s.cost)} · ตั้งขาย {baht(s.set_price)}{s.location ? ` · เก็บที่ ${s.location}` : ''}{s.source ? ` · 🏬 ${s.source}` : ''}{s.has_image === false ? ' · ⚠️ ยังไม่มีรูป' : ''}
              </div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3 }}>เข้าสต็อก {fmtDate(s.date_in)} · 💡 อย่าเพิ่งสั่งซ้ำ — ดันขายก่อน (ลงโพสต์/จัดชุด/แจ้งลูกค้าที่เคยถาม)</div>
            </div>
          ))}
        </>)}

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '10px 0 30px' }}>
          อ่านจาก Ledger (sales + stock) + คำถามลูกค้า (leads) ไม่แก้ข้อมูล · แหล่งซื้อ 🏬 = จาก Ledger (ทีมเห็นร่วมกัน) · memo = จำเฉพาะเครื่องนี้ · จับคู่ด้วยชื่ออะไหล่+รุ่น — สะกดชื่อให้เหมือนกันตอนบันทึก สัญญาณจะแม่นขึ้น
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}
