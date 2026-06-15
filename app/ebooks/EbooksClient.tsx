'use client'
// app/ebooks/EbooksClient.tsx — หน้า eBook (Lite ฟรี + Full/Bundle สั่งซื้อ manual)
// ส่ง order เข้า /api/leads (topic='ebook') → แจ้ง LINE อัตโนมัติ · ไม่มี auto-download Full
// v2 (2026-06-15): copy fix เฉพาะจุด — (1) ปุ่มระบุรุ่นชัด (2) checkbox ยินยอมเด่นขึ้น
import { useState } from 'react'

const LITE = [
  { code: 'W202', label: 'W202 — เบนซ์จิ้มลิ้ม (C-Class)', file: '/ebooks/W202_LITE.pdf' },
  { code: 'W210', label: 'W210 — ตา 4 รู (E-Class)', file: '/ebooks/W210_LITE.pdf' },
]

const PAID = [
  { id: 'w202-full', label: 'W202 ฉบับเต็ม (Full)', cta: 'สั่งซื้อ Full W202', price: 199, desc: 'เนื้อหาครบทุกบท + เจาะลึกการเลือกซื้อ/ดูอาการ W202' },
  { id: 'w210-full', label: 'W210 ฉบับเต็ม (Full)', cta: 'สั่งซื้อ Full W210', price: 199, desc: 'เนื้อหาครบทุกบท + เจาะลึกการเลือกซื้อ/ดูอาการ W210' },
  { id: 'bundle', label: 'Bundle W202 + W210 (Full ทั้ง 2 เล่ม)', cta: 'สั่งซื้อ Bundle', price: 349, desc: 'คุ้มสุด — ได้ทั้ง W202 + W210 ฉบับเต็ม ประหยัด 49 บาท' },
]

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

// เผื่อ /api/leads รองรับเฉพาะค่าด้านล่าง — ถ้าไม่ตรง map เป็น 'direct'
const SUPPORTED_SOURCES = ['facebook_page', 'facebook_group', 'instagram', 'google', 'qr', 'direct']
function safeSource(): string {
  const sx = detectSource()
  return SUPPORTED_SOURCES.includes(sx) ? sx : 'direct'
}

export default function EbooksClient() {
  const [item, setItem] = useState('bundle')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [modelInterest, setModelInterest] = useState('')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [ref, setRef] = useState('')

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:border-[#C9A961] focus:outline-none'

  const pickAndScroll = (id: string) => {
    setItem(id)
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' })
  }

  const submit = async () => {
    setErr('')
    if (!phone.trim() && !lineId.trim()) { setErr('กรุณากรอกเบอร์โทร หรือ LINE อย่างน้อย 1 ช่อง'); return }
    if (!consent) { setErr('กรุณาติ๊ก “ยินยอมให้ทีมงานติดต่อกลับ” ก่อนกดส่ง'); return }
    const picked = PAID.find((p) => p.id === item)
    setSubmitting(true)
    try {
      const safeNote = note.trim().slice(0, 500)
      const detail = `[สั่งซื้อ eBook · หน้า /ebooks] รายการ: ${picked?.label} · ราคา ${picked?.price} บาท · รุ่นที่สนใจ: ${modelInterest || '-'}${safeNote ? ` · หมายเหตุ: ${safeNote}` : ''}`.slice(0, 1000)
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
        <p className="text-gray-700 leading-relaxed">
          เราได้รับข้อมูลแล้ว ทีมงานจะติดต่อกลับเพื่อแจ้งขั้นตอนรับ eBook ครับ
        </p>
        {ref && <p className="text-xs text-gray-400 mt-3">เลขอ้างอิง: {ref}</p>}
        <a href="https://line.me/R/ti/p/%40440ifncj" target="_blank" rel="noopener noreferrer"
          className="inline-block mt-6 bg-[#06C755] hover:bg-[#05B04A] text-white rounded-lg px-6 py-3 text-sm font-medium">
          💬 ทักไลน์เพื่อยืนยันคำสั่งซื้อ
        </a>
        <div className="mt-6"><a href="/ebooks" className="text-sm text-[#C9A961] hover:underline">← กลับหน้า eBook</a></div>
      </div>
    )
  }

  return (
    <>
      {/* HERO */}
      <section className="bg-[#1C1D2C] text-[#F2EDE0]">
        <div className="container mx-auto px-4 max-w-5xl py-12 md:py-16 text-center">
          <p className="text-[10px] tracking-[0.32em] text-[#C9A961] font-serif mb-3">FREE EBOOKS · MERCEDES-BENZ CLASSIC</p>
          <h1 className="text-3xl md:text-4xl font-serif font-medium">eBook คู่มือ Mercedes-Benz คลาสสิก</h1>
          <p className="text-[#B8B3A7] mt-4 max-w-2xl mx-auto">โหลดฉบับ LITE ฟรี เพื่อประกอบการตัดสินใจ · ฉบับเต็ม (Full) เนื้อหาครบ สั่งซื้อได้เลย</p>
        </div>
      </section>

      {/* LITE — ฟรี */}
      <section className="container mx-auto px-4 max-w-5xl py-12">
        <h2 className="text-2xl font-serif font-medium text-gray-900 mb-2">📖 ฉบับ LITE — ดาวน์โหลดฟรี</h2>
        <p className="text-sm text-gray-500 mb-6">อ่านเพื่อประกอบการตัดสินใจ</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {LITE.map((b) => (
            <div key={b.code} className="border border-gray-200 rounded-xl p-5 bg-white">
              <p className="font-semibold text-gray-900">{b.label}</p>
              <p className="text-xs text-gray-500 mt-1">ฉบับ LITE · PDF · ฟรี</p>
              <a href={b.file} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-4 bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium rounded-lg px-5 py-2.5 text-sm">
                ⬇ ดาวน์โหลด Lite ฟรี
              </a>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
          ℹ️ ไฟล์ Lite แจกให้อ่านเพื่อประกอบการตัดสินใจ ห้ามนำไปขายต่อหรือเผยแพร่ซ้ำโดยไม่ได้รับอนุญาต
        </p>
      </section>

      {/* FULL / BUNDLE — สั่งซื้อ */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 max-w-5xl py-12">
          <h2 className="text-2xl font-serif font-medium text-gray-900 mb-2">⭐ ฉบับเต็ม (Full) & Bundle</h2>
          <p className="text-sm text-gray-500 mb-6">เนื้อหาครบทุกบท · สั่งซื้อแล้วทีมงานจัดส่งไฟล์ให้</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {PAID.map((p) => (
              <div key={p.id} className={`rounded-xl p-5 bg-white border ${p.id === 'bundle' ? 'border-[#C9A961] ring-1 ring-[#C9A961]' : 'border-gray-200'} flex flex-col`}>
                {p.id === 'bundle' && <span className="text-[10px] bg-[#C9A961] text-[#1C1D2C] font-bold px-2 py-0.5 rounded self-start mb-2">คุ้มสุด</span>}
                <p className="font-semibold text-gray-900">{p.label}</p>
                <p className="text-xs text-gray-600 mt-1 flex-1">{p.desc}</p>
                <p className="text-2xl font-bold text-[#C9A961] mt-3">฿{p.price}</p>
                <button onClick={() => pickAndScroll(p.id)}
                  className="mt-3 bg-[#1C1D2C] hover:bg-[#2E303F] text-white font-medium rounded-lg px-4 py-2.5 text-sm">
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
            ⚠️ ไฟล์ Full เป็นลิขสิทธิ์ของ Mr.Chuti — สำหรับผู้ซื้อใช้ส่วนตัวเท่านั้น ห้ามนำไปจำหน่ายต่อ แจกจ่าย เผยแพร่ อัปโหลด หรือใช้เชิงพาณิชย์โดยไม่ได้รับอนุญาต
          </p>
        </div>
      </section>

      {/* ORDER FORM */}
      <section id="order" className="container mx-auto px-4 max-w-xl py-12 scroll-mt-20">
        <h2 className="text-2xl font-serif font-medium text-gray-900 mb-2">📝 สั่งซื้อ eBook ฉบับเต็ม</h2>
        <p className="text-sm text-gray-500 mb-6">กรอกข้อมูล ทีมงานจะติดต่อกลับเพื่อยืนยันการชำระเงิน + ส่งไฟล์</p>
        <div className="space-y-3">
          <label className="block text-xs text-gray-500">รายการที่สั่งซื้อ
            <select value={item} onChange={(e) => setItem(e.target.value)} className={`${inputCls} mt-1`}>
              {PAID.map((p) => <option key={p.id} value={p.id}>{p.label} — ฿{p.price}</option>)}
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
            {['W202', 'W210', 'W202 + W210', 'อื่นๆ'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" className={`${inputCls} resize-none`} />
          {/* consent — เน้นให้เด่น (กล่องไฮไลต์ + ขอบเปลี่ยนสีเมื่อยังไม่ติ๊ก) */}
          <label className={`flex items-start gap-3 text-sm rounded-lg border p-3 cursor-pointer transition-colors ${consent ? 'border-[#C9A961] bg-[#FBF7EC] text-gray-800' : 'border-amber-300 bg-amber-50 text-gray-800'}`}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#C9A961] shrink-0" />
            <span><span className="font-semibold">ยินยอมให้ทีมงานติดต่อกลับ</span> เพื่อยืนยันคำสั่งซื้อและจัดส่งไฟล์ <span className="text-red-500">*</span></span>
          </label>
          <div className="absolute left-[-9999px] w-px h-px overflow-hidden" aria-hidden="true">
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
          </div>
          {err && <p className="text-sm text-red-600 font-medium">{err}</p>}
          <button onClick={submit} disabled={submitting}
            className="w-full bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-60 text-[#1C1D2C] font-bold rounded-lg px-4 py-3.5 text-base">
            {submitting ? 'กำลังส่ง…' : 'ส่งคำสั่งซื้อ'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">ยังไม่ต้องชำระเงินตอนนี้ — ทีมงานจะติดต่อกลับเพื่อยืนยันยอดและช่องทางโอน</p>
        </div>
      </section>
    </>
  )
}
