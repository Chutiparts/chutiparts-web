'use client'
import { useState, useTransition } from 'react'

const GREEN = '#17301F'
const inp: React.CSSProperties = { width: '100%', padding: '11px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 15, marginTop: 4 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginTop: 12 }

const MODELS = ['W124', 'W126', 'W140', 'W201', 'W202', 'W210', 'W220']
const PREFIX_MAP: Record<string, string> = {
  '124': 'W124', '126': 'W126', '140': 'W140', '201': 'W201', '202': 'W202', '210': 'W210', '220': 'W220',
}
// W140 → 140 (เลขนำหน้า SKU) · ใช้ตอนเลือกรุ่นแล้วขอ SKU ถัดไป
const MODEL_TO_PREFIX: Record<string, string> = Object.fromEntries(Object.entries(PREFIX_MAP).map(([k, v]) => [v, k]))

function detectModel(sku: string): string {
  const m = sku.trim().match(/^(\d{3})/)
  return m ? (PREFIX_MAP[m[1]] || '') : ''
}

type Result = { ok: boolean; msg: string; sku?: string; exists?: boolean }
type Props = {
  addProduct: (fd: FormData) => Promise<Result>
  nextSku: (prefix: string) => Promise<{ ok: boolean; sku: string }>
}

export default function AddPartClient({ addProduct, nextSku }: Props) {
  const [pending, start] = useTransition()
  const [f, setF] = useState({ sku: '', name: '', model: '', price: '', oem: '' })
  const [modelAuto, setModelAuto] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [res, setRes] = useState<Result | null>(null)

  function onSku(v: string) {
    setF((p) => {
      const d = detectModel(v)
      const fill = d && (p.model === '' || modelAuto)
      if (fill) setModelAuto(true)
      return { ...p, sku: v, model: fill ? d : p.model }
    })
  }

  function onModel(v: string) {
    setModelAuto(false)
    setF((p) => ({ ...p, model: v }))
  }

  // ขอ SKU ถัดไปจากรุ่นที่เลือก (เลขรัน) — ถ้ามี prefix อักษรใน sku อยู่แล้วใช้อันนั้น
  function askNext() {
    const cur = f.sku.trim()
    // ถ้าพิมพ์ prefix หมวดไว้แล้ว เช่น "140-AC" → ใช้ต่อ · ไม่งั้นดึง prefix จากรุ่น
    let prefix = ''
    if (/^\d{3}-[A-Za-z]/.test(cur)) prefix = cur.replace(/\d+$/, '').replace(/-+$/, '')   // "140-AC03" → "140-AC"
    else if (f.model && MODEL_TO_PREFIX[f.model]) prefix = MODEL_TO_PREFIX[f.model]           // W140 → "140"
    else if (/^\d{3}/.test(cur)) prefix = cur.slice(0, 3)
    if (!prefix) { setRes({ ok: false, msg: 'เลือกรุ่นก่อน หรือพิมพ์เลขนำหน้า (เช่น 140)' }); return }
    setSuggesting(true)
    start(async () => {
      const r = await nextSku(prefix)
      setSuggesting(false)
      if (r.ok && r.sku) {
        const d = detectModel(r.sku)
        setF((p) => ({ ...p, sku: r.sku, model: (p.model === '' || modelAuto) && d ? d : p.model }))
        if (d) setModelAuto(true)
      }
    })
  }

  function submit() {
    if (!f.sku.trim()) { setRes({ ok: false, msg: 'กรุณาใส่ SKU' }); return }
    if (!f.name.trim()) { setRes({ ok: false, msg: 'กรุณาใส่ชื่ออะไหล่' }); return }
    const fd = new FormData()
    fd.set('sku', f.sku); fd.set('name', f.name); fd.set('model', f.model); fd.set('price', f.price); fd.set('oem', f.oem)
    start(async () => {
      const r = await addProduct(fd)
      setRes(r)
      if (r.ok) { setF({ sku: '', name: '', model: '', price: '', oem: '' }); setModelAuto(false) }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F4EF', fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>➕ เพิ่มสินค้าใหม่</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>เลือกรุ่น → ขอเลขถัดไป → กรอกชื่อ/ราคา → บันทึก → ไปอัพรูป · สินค้าใหม่ยังไม่ขึ้นเว็บจนเจ้าของ publish</div>
      </div>

      <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>

          <label style={lbl}>รุ่นรถ {modelAuto && f.model && <span style={{ color: '#0F6E56', fontWeight: 400 }}>· เดาจาก SKU</span>}
            <select value={f.model} onChange={(e) => onModel(e.target.value)} style={inp}>
              <option value="">— เลือกรุ่น —</option>
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              <option value="อื่นๆ">อื่นๆ (ระบุในชื่อ)</option>
            </select>
          </label>

          <label style={lbl}>SKU (รหัสอะไหล่) *
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input value={f.sku} onChange={(e) => onSku(e.target.value)} style={{ ...inp, marginTop: 0, flex: 1 }} placeholder="เช่น 140-031 · หรือกดขอเลขถัดไป" />
              <button onClick={askNext} disabled={suggesting}
                style={{ background: '#EAF3EE', color: GREEN, border: '1px solid ' + GREEN, borderRadius: 8, padding: '0 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {suggesting ? '…' : '🔢 เลขถัดไป'}
              </button>
            </div>
          </label>
          <div style={{ fontSize: 11.5, color: '#888', marginTop: 4 }}>เลือกรุ่นแล้วกด "เลขถัดไป" ระบบหาเลขล่าสุดให้ · หมวดพิเศษพิมพ์ prefix เช่น 140-AC แล้วกดได้</div>

          <label style={lbl}>ชื่ออะไหล่ *
            <input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} style={inp} placeholder="เช่น ปั๊มสุญญากาศกลาง" />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={lbl}>ราคาขาย (บาท)
              <input value={f.price} onChange={(e) => setF((p) => ({ ...p, price: e.target.value }))} style={inp} inputMode="numeric" placeholder="เช่น 1500" />
            </label>
            <label style={lbl}>OEM (ถ้ามี)
              <input value={f.oem} onChange={(e) => setF((p) => ({ ...p, oem: e.target.value }))} style={inp} placeholder="รหัส OEM" />
            </label>
          </div>

          <button onClick={submit} disabled={pending}
            style={{ marginTop: 18, width: '100%', background: pending ? '#889' : GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontSize: 15, fontWeight: 700, cursor: pending ? 'default' : 'pointer' }}>
            {pending && !suggesting ? 'กำลังบันทึก…' : '💾 บันทึกสินค้าใหม่'}
          </button>
        </div>

        {res && (
          <div style={{ marginTop: 14, background: res.ok ? '#E7F3EC' : (res.exists ? '#FFF6E5' : '#FDECEC'), border: '1px solid ' + (res.ok ? '#4CAF7D' : (res.exists ? '#E6B450' : '#E39A9A')), borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: res.ok ? '#1B6E45' : (res.exists ? '#8A6416' : '#A32D2D') }}>
              {res.ok ? '✅ ' : (res.exists ? '⚠️ ' : '❌ ')}{res.msg}
            </div>
            {(res.ok || res.exists) && res.sku && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>ขั้นต่อไป: อัพรูป — ก๊อป SKU นี้ไปค้นในหน้าอัพรูป</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <code style={{ background: '#fff', border: '1px dashed #999', borderRadius: 6, padding: '6px 12px', fontSize: 15, fontWeight: 700, color: GREEN, userSelect: 'all' }}>{res.sku}</code>
                  <a href="/ops-x7k2m9/photo" style={{ display: 'inline-block', background: GREEN, color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700 }}>📷 ไปหน้าอัพรูป →</a>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 12, color: '#888', lineHeight: 1.6 }}>
          <b>หมายเหตุ:</b><br />
          • เลือกรุ่น → กด "🔢 เลขถัดไป" ระบบหาเลขล่าสุดของรุ่นนั้นให้ (กันตั้งซ้ำ/ข้าม)<br />
          • หมวดพิเศษ (แอร์/ไฟหน้า) พิมพ์ prefix เช่น <code>140-AC</code> แล้วกดเลขถัดไป → ได้ <code>140-AC03</code><br />
          • ราคาที่กรอก = ราคาเบื้องต้น · เจ้าของยืนยันก่อน publish เสมอ<br />
          • สินค้าใหม่ยังไม่ขึ้นเว็บ จนกว่าเจ้าของกด publish
        </div>
      </div>
    </div>
  )
}
