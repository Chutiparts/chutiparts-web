'use client'
// app/ebooks/EbooksClient.tsx — หน้า eBook · 3 หมวด: Free / Classic Guide / Premium
// v5 (06-17): + W140 Survival Pack แจกฟรี (featured บนหัว Free) + campaign tracking
// v6 (06-17): + copy Premium W124 M119 / GENESIS S70 (แทน "รายละเอียดเร็ว ๆ นี้")
// v7 (07-03): Lite รายรุ่น ครบ 7 รุ่น + เลิกแจก PDF ตรง → ขอรับผ่าน LINE (lead funnel) · ส่วนอื่นคงเดิม
// v8 (07-03): Lite ปุ่ม = มือถือเปิดแชท OA + ข้อความรุ่น prefill · เดสก์ท็อป = หน้า QR แอดเพื่อน OA (ให้เหมือนการ์ดหน้าแรก)
import { useState } from 'react'
const LINE_OA_ID = '@440ifncj'
// มือถือ: เปิดแชท OA พร้อมข้อความรุ่น (prefill) — ทำงานในแอป LINE
const liteLineLink = (code: string) =>
  `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/?${encodeURIComponent('ขอรับ eBook Lite รุ่น ' + code)}`
// เดสก์ท็อป (default): หน้าแอดเพื่อน OA — โชว์ QR ให้สแกน
const LINE_ADD_FRIEND = `https://line.me/R/ti/p/${encodeURIComponent(LINE_OA_ID)}`
const LITE = [
  { code: 'W123', label: 'W123 — เบนซ์ตาหวาน (ต้นตำรับ 70s–80s)' },
  { code: 'W124', label: 'W124 — รถถังเยอรมัน (E-Class)' },
  { code: 'W126', label: 'W126 — เจ้าพ่อเซี่ยงไฮ้ (S-Class)' },
  { code: 'W140', label: 'W140 — ปลาวาฬ/หัวแตงโม (S-Class)' },
  { code: 'W201', label: 'W201 — Baby Benz (190E)' },
  { code: 'W202', label: 'W202 — เบนซ์จิ้มลิ้ม (C-Class)' },
  { code: 'W210', label: 'W210 — ตา 4 รู (E-Class)' },
]
const CLASSIC = [
  { id: 'w123-full', label: 'W123 — คลาสสิกต้นตำรับ ยุค 70s–80s', price: 199, status: 'พร้อมขาย' },
  { id: 'w126-full', label: 'W126 — S-Class “เจ้าพ่อเซี่ยงไฮ้”', price: 199, status: 'พร้อมขาย' },
  { id: 'w140-full', label: 'W140 — S-Class “หัวแตงโม / ปลาวาฬ”', price: 299, status: 'พร้อมขาย' },
  { id: 'w201-full', label: 'W201 — Baby Benz (190E)', price: 199, status: 'พร้อมขาย' },
  { id: 'w202-full', label: 'W202 ฉบับเต็ม (Full)', price: 199, status: 'พร้อมขาย', desc: 'เจาะลึกการเลือกซื้อ/ดูอาการ W202' },
  { id: 'w210-full', label: 'W210 ฉบับเต็ม (Full)', price: 199, status: 'พร้อมขาย', desc: 'เจาะลึกการเลือกซื้อ/ดูอาการ W210' },
  { id: 'bundle', label: 'Bundle W202 + W210 (Full ทั้ง 2 เล่ม)', price: 349, status: 'พร้อมขาย', best: true, desc: 'คุ้มสุด — ประหยัด 49 บาท' },
]
const PREMIUM = [
  { id: 'premium-w124-m119', label: 'W124 M119 V8 Swap', price: 799, desc: 'โปรเจกต์สวอปเครื่อง M119 V8 ลง W124 — สเปกเครื่อง ความเข้ากันของแชสซี งานไฟ/เกียร์/ช่วงล่าง และบทเรียนจากการทำจริง' },
  { id: 'premium-genesis-s70', label: 'GENESIS Volume I · S70 AMG', price: 599, desc: 'เจาะตำนาน S70 AMG เครื่อง 7.0 V8 — ที่มา สเปกหายาก จุดสังเกตของแท้ และเสน่ห์งาน hand-built AMG ยุค W140' },
]
const ORDERABLE = [...CLASSIC, ...PREMIUM]
function statusStyle(s: string): string {
  if (s === 'พร้อมขาย') return 'bg-green-100 text-green-700'
  if (s === 'เปิดจอง') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-500'
}
function detectSource(): string {
  if (typeof window === 'undefined') return 'direct'
  const p = new URLSearchParams(window.location.search)
  const utm = (p.get('utm_source') || p.get('src') || '').toLowerCase()
  if (utm.includes('group')) return 'facebook_group'
  if (utm.includes('facebook') || utm === 'fb') return 'facebook_page'
  if (utm.includes('instagram') || utm === 'ig') return 'instagram'
  if (utm.includes('google')) return 'google'
  if (utm === 'qr') return 'qr'
  const r = (typeof document !== 'undefined' ? document.referrer : '').toLowerCase()
  if (r.includes('facebook')) return 'facebook_page'
  if (r.includes('instagram')) return 'instagram'
  if (r.includes('google')) return 'google'
  return 'direct'
}
const SUPPORTED_SOURCES = ['facebook_page', 'facebook_group', 'instagram', 'google', 'qr', 'direct']
function safeSource(): string {
  const sx = detectSource()
  return SUPPORTED_SOURCES.includes(sx) ? sx : 'direct'
}
function getCampaign(): string {
  if (typeof window === 'undefined') return ''
  const p = new URLSearchParams(window.location.search)
  return (p.get('campaign') || p.get('utm_campaign') || '').toLowerCase().replace(/[^a-z0-9_\-]/g, '').slice(0, 60)
}
export default function EbooksClient() {
  const [item, setItem] = useState('bundle')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [modelInterest, setModelInterest] = useState('')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [ref, setRef] = useState('')
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:border-[#C9A961] focus:outline-none'
  const pickAndScroll = (id: string) => {
    setItem(id)
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' })
  }
  // มือถือ → เปิดแชท OA + ข้อความรุ่น (prefill) · เดสก์ท็อป → ปล่อยให้ href (แอดเพื่อน/QR) ทำงาน
  const openLite = (e: React.MouseEvent<HTMLAnchorElement>, code: string) => {
    try {
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
      if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
        e.preventDefault()
        window.location.href = liteLineLink(code)
      }
    } catch { /* ใช้ href เดิม */ }
  }
  const submit = async () => {
    setErr('')
    if (!phone.trim() && !lineId.trim()) { setErr('กรุณากรอกเบอร์โทร หรือ LINE อย่างน้อย 1 ช่อง'); return }
    if (!consent) { setErr('กรุณาติ๊ก “ยินยอมให้ทีมงานติดต่อกลับ” ก่อนกดส่ง'); return }
    const picked = ORDERABLE.find((p) => p.id === item)
    setSubmitting(true)
    try {
      const safeNote = note.trim().slice(0, 500)
      const campaign = getCampaign()
      const detail = `[สั่งซื้อ eBook · หน้า /ebooks] รายการ: ${picked?.label} · ราคา ${picked?.price} บาท · รุ่นที่สนใจ: ${modelInterest || '-'}${campaign ? ` · campaign: ${campaign}` : ''}${safeNote ? ` · หมายเหตุ: ${safeNote}` : ''}`.slice(0, 1000)
      const r = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website, topic: 'ebook', name: name.trim().slice(0, 150), phone, line_id: lineId, email: '',
          car_model: modelInterest, detail, source: safeSource(),
          referrer: (typeof document !== 'undefined' ? document.referrer : ''), consent: true,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (j?.ok) { setRef(j.ref || ''); setDone(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
      else setErr('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือทักไลน์เราโดยตรง')
    } catch {
      setErr('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือทักไลน์เราโดยตรง')
    } finally {
      setSubmitting(false)
    }
  }
  if (done) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-serif font-medium text-gray-900 mb-3">ได้รับคำสั่งซื้อแล้ว</h1>
        <p className="text-gray-700 leading-relaxed">เราได้รับข้อมูลแล้ว ทีมงานจะติดต่อกลับเพื่อแจ้งขั้นตอนรับ eBook ครับ</p>
        {ref && <p className="text-xs text-gray-400 mt-3">เลขอ้างอิง: {ref}</p>}
        <a href="https://line.me/R/ti/p/%40440ifncj" target="_blank" rel="noopener noreferrer"
          className="inline-block mt-6 bg-[#06C755] hover:bg-[#05B04A] text-white rounded-lg px-6 py-3 text-sm font-medium">💬 ทักไลน์เพื่อยืนยันคำสั่งซื้อ</a>
        <div className="mt-6"><a href="/ebooks" className="text-sm text-[#C9A961] hover:underline">← กลับหน้า eBook</a></div>
      </div>
    )
  }
  return (
    <>
      <section className="bg-[#1C1D2C] text-[#F2EDE0]">
        <div className="container mx-auto px-4 max-w-5xl py-12 md:py-16 text-center">
          <p className="text-[10px] tracking-[0.32em] text-[#C9A961] font-serif mb-3">EBOOKS · MERCEDES-BENZ CLASSIC</p>
          <h1 className="text-3xl md:text-4xl font-serif font-medium">eBook คู่มือ Mercedes-Benz คลาสสิก</h1>
          <p className="text-[#B8B3A7] mt-4 max-w-2xl mx-auto">ฉบับ LITE ฟรี · Classic Guide คู่มือรายรุ่น · Premium / Special Project — สั่งซื้อได้เลย</p>
        </div>
      </section>
      {/* ===== หมวด 1: FREE EBOOK ===== */}
      <section className="container mx-auto px-4 max-w-5xl py-12">
        <h2 className="text-2xl font-serif font-medium text-gray-900 mb-2">📖 Free eBook — ดาวน์โหลดฟรี</h2>
        <p className="text-sm text-gray-500 mb-6">อ่านเพื่อประกอบการตัดสินใจ</p>
        {/* FEATURED — W140 Survival Pack (แจกฟรี) */}
        <div className="mb-6 rounded-xl p-5 bg-[#1C1D2C] text-[#F2EDE0] border border-[#C9A961]/50 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <span className="text-[10px] tracking-[0.2em] text-[#C9A961] font-serif">FREE GUIDE · W140 · ใหม่</span>
            <p className="font-semibold text-lg mt-1">🐋 W140 Survival Pack — คู่มือซื้อมือสอง (16 หน้า)</p>
            <p className="text-xs text-[#B8B3A7] mt-1 leading-relaxed">10 จุดต้องเช็คก่อนซื้อ · เฟส 1/2/ME · สายไฟ Biodegradable · โช้ค ADS · ราคาซ่อมจริง · checklist พกไปดูรถ</p>
          </div>
          <a href="https://drive.google.com/file/d/10ZfK_ayKdJ5qjZspuZsg9bnG5GRO75g9/view" target="_blank" rel="noopener noreferrer"
            className="shrink-0 bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-bold rounded-lg px-6 py-3 text-sm text-center">⬇ โหลดฟรี</a>
        </div>
        <p className="text-sm font-medium text-gray-700 mb-3">📚 ฉบับ LITE รายรุ่น (ขอรับทาง LINE)</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {LITE.map((b) => (
            <div key={b.code} className="border border-gray-200 rounded-xl p-5 bg-white">
              <p className="font-semibold text-gray-900">{b.label}</p>
              <p className="text-xs text-gray-500 mt-1">ฉบับ LITE · PDF · ฟรี (รับทาง LINE)</p>
              <a href={LINE_ADD_FRIEND} target="_blank" rel="noopener noreferrer" onClick={(e) => openLite(e, b.code)}
                className="inline-block mt-4 bg-[#06C755] hover:bg-[#05B04A] text-white font-medium rounded-lg px-5 py-2.5 text-sm">💬 ขอรับ eBook Lite ทาง LINE</a>
              <p className="text-[11px] text-gray-500 mt-2">ทีมงานจะส่งลิงก์ PDF ให้ทาง LINE และแจ้งอัปเดตอะไหล่รุ่นนี้เป็นครั้งคราว</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">ℹ️ ไฟล์ Lite แจกให้อ่านเพื่อประกอบการตัดสินใจ ห้ามนำไปขายต่อหรือเผยแพร่ซ้ำโดยไม่ได้รับอนุญาต</p>
      </section>
      {/* ===== หมวด 2: CLASSIC GUIDE ===== */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 max-w-5xl py-12">
          <h2 className="text-2xl font-serif font-medium text-gray-900 mb-2">📚 Classic Guide — คู่มือรายรุ่น</h2>
          <p className="text-sm text-gray-500 mb-6">เนื้อหาฉบับเต็ม · สั่งซื้อแล้วทีมงานจัดส่งไฟล์ให้ (ไม่เปิดดาวน์โหลดสาธารณะ)</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CLASSIC.map((c: any) => (
              <div key={c.id} className={`rounded-xl p-5 bg-white border ${c.best ? 'border-[#C9A961] ring-1 ring-[#C9A961]' : 'border-gray-200'} flex flex-col`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusStyle(c.status)}`}>{c.status}</span>
                  {c.best && <span className="text-[10px] bg-[#C9A961] text-[#1C1D2C] font-bold px-2 py-0.5 rounded">คุ้มสุด</span>}
                </div>
                <p className="font-semibold text-gray-900">{c.label}</p>
                {c.desc ? <p className="text-xs text-gray-600 mt-1 flex-1">{c.desc}</p> : <div className="flex-1" />}
                <p className="text-2xl font-bold text-[#C9A961] mt-3">฿{c.price}</p>
                <button onClick={() => pickAndScroll(c.id)} className="mt-3 bg-[#1C1D2C] hover:bg-[#2E303F] text-white font-medium rounded-lg px-4 py-2.5 text-sm">สั่งซื้อ / ขอรายละเอียด</button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">⚠️ ไฟล์ฉบับเต็มเป็นลิขสิทธิ์ของ Mr.Chuti — สำหรับผู้ซื้อใช้ส่วนตัวเท่านั้น ห้ามนำไปจำหน่ายต่อ แจกจ่าย เผยแพร่ อัปโหลด หรือใช้เชิงพาณิชย์โดยไม่ได้รับอนุญาต</p>
        </div>
      </section>
      {/* ===== หมวด 3: PREMIUM ===== */}
      <section className="bg-[#1C1D2C] text-[#F2EDE0] border-y border-[#2E303F]">
        <div className="container mx-auto px-4 max-w-5xl py-12">
          <p className="text-[10px] tracking-[0.32em] text-[#C9A961] font-serif mb-2">PREMIUM · SPECIAL PROJECT · LIMITED</p>
          <h2 className="text-2xl font-serif font-medium mb-2">👑 Premium / Special Project</h2>
          <p className="text-sm text-[#B8B3A7] mb-6">เล่มเฉพาะทาง · สั่งซื้อ/สอบถามผ่านฟอร์ม — ทีมงานจัดส่งไฟล์ให้หลังยืนยันการชำระเงิน</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {PREMIUM.map((p) => (
              <div key={p.id} className="rounded-xl p-5 bg-[#23243A] border border-[#3A3C52] flex flex-col">
                <span className="text-[10px] bg-[#C9A961] text-[#1C1D2C] font-bold px-2 py-0.5 rounded self-start mb-2">PREMIUM</span>
                <p className="font-semibold text-[#F2EDE0]">{p.label}</p>
                <p className="text-xs text-[#B8B3A7] mt-1 flex-1">{p.desc}</p>
                <p className="text-2xl font-bold text-[#C9A961] mt-3">฿{p.price}</p>
                <button onClick={() => pickAndScroll(p.id)} className="mt-3 bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-bold rounded-lg px-4 py-2.5 text-sm">สั่งซื้อ / ขอรายละเอียด</button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#B8B3A7] mt-5 bg-[#23243A] border border-[#3A3C52] rounded-lg p-3 leading-relaxed">🔒 ไฟล์ Premium ไม่เปิดให้ดาวน์โหลดสาธารณะ — ทีมงานจัดส่งให้เฉพาะหลังยืนยันยอดโอนแล้วเท่านั้น</p>
        </div>
      </section>
      {/* ===== ORDER FORM ===== */}
      <section id="order" className="container mx-auto px-4 max-w-xl py-12 scroll-mt-20">
        <h2 className="text-2xl font-serif font-medium text-gray-900 mb-2">📝 สั่งซื้อ eBook</h2>
        <p className="text-sm text-gray-500 mb-6">กรอกข้อมูล ทีมงานจะติดต่อกลับเพื่อยืนยันการชำระเงิน + ส่งไฟล์</p>
        <div className="space-y-3">
          <label className="block text-xs text-gray-500">รายการที่สั่งซื้อ
            <select value={item} onChange={(e) => setItem(e.target.value)} className={`${inputCls} mt-1`}>
              {ORDERABLE.map((p) => <option key={p.id} value={p.id}>{p.label} — ฿{p.price}</option>)}
            </select>
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="เบอร์โทร (ถ้ามี)" className={inputCls} />
            <input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="LINE ID (ถ้ามี)" className={inputCls} />
          </div>
          <p className="text-[11px] text-gray-500 -mt-1">กรอกเบอร์ หรือ LINE อย่างน้อย 1 ช่อง</p>
          <select value={modelInterest} onChange={(e) => setModelInterest(e.target.value)} className={inputCls}>
            <option value="">รุ่นที่สนใจ (ถ้ามี)</option>
            {['W123', 'W126', 'W140', 'W201', 'W202', 'W210', 'W124', 'S70 AMG', 'อื่นๆ'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" className={`${inputCls} resize-none`} />
          <label className={`flex items-start gap-3 text-sm rounded-lg border p-3 cursor-pointer transition-colors ${consent ? 'border-[#C9A961] bg-[#FBF7EC] text-gray-800' : 'border-amber-300 bg-amber-50 text-gray-800'}`}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#C9A961] shrink-0" />
            <span><span className="font-semibold">ยินยอมให้ทีมงานติดต่อกลับ</span> เพื่อยืนยันคำสั่งซื้อและจัดส่งไฟล์ <span className="text-red-500">*</span></span>
          </label>
          <div className="absolute left-[-9999px] w-px h-px overflow-hidden" aria-hidden="true">
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
          </div>
          {err && <p className="text-sm text-red-600 font-medium">{err}</p>}
          <button onClick={submit} disabled={submitting} className="w-full bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-60 text-[#1C1D2C] font-bold rounded-lg px-4 py-3.5 text-base">{submitting ? 'กำลังส่ง…' : 'ส่งคำสั่งซื้อ'}</button>
          <p className="text-[11px] text-gray-400 text-center">ยังไม่ต้องชำระเงินตอนนี้ — ทีมงานจะติดต่อกลับเพื่อยืนยันยอดและช่องทางโอน</p>
        </div>
      </section>
    </>
  )
}
