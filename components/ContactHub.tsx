'use client'
// components/ContactHub.tsx — ปุ่ม "ติดต่อเรา" ลอยทุกหน้า + ช่องทางติดต่อ + ฟอร์มให้ติดต่อกลับ
// mobile-first · มี consent + honeypot · บันทึก source/referrer · auto-reply หลังส่ง
// P0.1 (7 ก.ค.): เมนู LINE/WhatsApp เรียง+เด่นตามภาษา (TH→LINE · EN→WhatsApp · แสดงทั้งคู่) — โทร/Messenger/ฟอร์มคงเดิม
import { useState, useEffect } from 'react'
import {
  CONTACT, AUTO_REPLY, LEAD_TOPICS, CAR_MODELS,
} from '@/lib/contact-config'
import { useLang } from '@/app/context/LanguageContext'
import { CONTACT as ROUTE, contactOrder, primaryChannel } from '@/lib/contact-routing'
function detectSource(): string {
  if (typeof window === 'undefined') return 'direct'
  const p = new URLSearchParams(window.location.search)
  const utm = (p.get('utm_source') || p.get('src') || '').toLowerCase()
  if (utm.includes('group')) return 'facebook_group'
  if (utm.includes('facebook') || utm === 'fb') return 'facebook_page'
  if (utm.includes('instagram') || utm === 'ig') return 'instagram'
  if (utm.includes('google')) return 'google'
  if (utm === 'qr') return 'qr'
  const r = (document.referrer || '').toLowerCase()
  if (r.includes('facebook')) return 'facebook_page'
  if (r.includes('instagram')) return 'instagram'
  if (r.includes('google')) return 'google'
  return 'direct'
}
type View = 'menu' | 'form' | 'done'
export default function ContactHub() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [source, setSource] = useState('direct')
  const [referrer, setReferrer] = useState('')
  const [topic, setTopic] = useState('parts')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [email, setEmail] = useState('')
  const [carModel, setCarModel] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [budget, setBudget] = useState('')
  const [detail, setDetail] = useState('')
  const [callbackTime, setCallbackTime] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [ref, setRef] = useState('')
  const { lang } = useLang()
  const L: 'th' | 'en' = lang === 'en' ? 'en' : 'th'
  const primary = primaryChannel(L)
  useEffect(() => {
    setSource(detectSource())
    setReferrer((typeof document !== 'undefined' ? document.referrer : '') || '')
  }, [])
  const lineHref = CONTACT.lineUrl
  const telHref = `tel:${CONTACT.tel}`
  const waHref = CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}` : ''
  const fbHref = CONTACT.messengerUrl
  const openForm = (t?: string) => { if (t) setTopic(t); setView('form'); setErr('') }
  const close = () => { setOpen(false); setTimeout(() => { setView('menu'); setErr('') }, 200) }
  const submit = async () => {
    setErr('')
    if (!phone.trim() && !lineId.trim()) { setErr('กรุณากรอกเบอร์โทร หรือ LINE ID อย่างน้อย 1 ช่อง'); return }
    if (!consent) { setErr('กรุณายินยอมให้ทีมงานติดต่อกลับก่อนส่ง'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website, topic, name, phone, line_id: lineId, email,
          car_model: carModel, part_number: partNumber, budget,
          detail, callback_time: callbackTime, source, referrer, consent,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (j?.ok) { setRef(j.ref || ''); setView('done') }
      else if (j?.error === 'missing_contact') setErr('กรุณากรอกเบอร์โทร หรือ LINE ID')
      else if (j?.error === 'consent_required') setErr('กรุณายินยอมให้ทีมงานติดต่อกลับก่อนส่ง')
      else setErr('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือทักไลน์เราโดยตรง')
    } catch {
      setErr('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือทักไลน์เราโดยตรง')
    } finally {
      setSubmitting(false)
    }
  }
  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:border-[#C9A961] focus:outline-none'
  // เมนูช่องแชต (LINE/WhatsApp) เรียงตามภาษา — ช่องหลักมาก่อน + เด่น
  const chatItem = (ch: 'line' | 'wa') => {
    // ใช้ href จาก contact-config ก่อน · ถ้าไม่มี (เช่น config ไม่ได้ตั้งเบอร์ WA) → fallback helper กลาง (โชว์ทั้ง 2 ช่องเสมอ)
    const href = ch === 'line' ? (lineHref || ROUTE.line.href) : (waHref || ROUTE.wa.href)
    if (!href) return null
    const isP = ch === primary
    const icon = ch === 'line' ? '🟢' : '🟩'
    const label = ch === 'line' ? `LINE — ${CONTACT.lineId}` : 'WhatsApp'
    return (
      <a key={ch} href={href} target="_blank" rel="noopener noreferrer"
        className={`flex items-center gap-3 w-full rounded-lg px-4 py-3.5 border ${isP ? 'border-[#C9A961] bg-[#FBF7EE]' : 'border-gray-200 hover:bg-gray-50'}`}>
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-gray-800">{label}{isP ? ' ★' : ''}</span>
      </a>
    )
  }
  return (
    <>
      {/* ปุ่มลอย — เหนือมุมขวาล่าง เลี่ยงชนปุ่มอื่น */}
      <button
        onClick={() => setOpen(true)}
        aria-label="ติดต่อเรา"
        className="fixed z-[60] bottom-4 right-4 md:bottom-6 md:right-6 bg-[#C9A961] hover:bg-[#D8B872] text-white shadow-lg rounded-full pl-4 pr-5 py-3 text-sm font-medium flex items-center gap-2 active:scale-95 transition"
      >
        <span className="text-base">💬</span>
        <span>ติดต่อเรา</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-serif text-lg text-gray-900">ติดต่อ ChutiBenz</h2>
              <button onClick={close} aria-label="ปิด" className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            {/* เมนูช่องทาง */}
            {view === 'menu' && (
              <div className="p-5 space-y-2.5">
                {contactOrder(L).map((ch) => chatItem(ch))}
                <a href={telHref} className="flex items-center gap-3 w-full border border-gray-200 rounded-lg px-4 py-3.5 hover:bg-gray-50">
                  <span className="text-xl">📞</span><span className="text-sm font-medium text-gray-800">โทร {CONTACT.telDisplay}</span>
                </a>
                {fbHref && (
                  <a href={fbHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 w-full border border-gray-200 rounded-lg px-4 py-3.5 hover:bg-gray-50">
                    <span className="text-xl">💬</span><span className="text-sm font-medium text-gray-800">Messenger</span>
                  </a>
                )}
                <button onClick={() => openForm('parts')} className="w-full bg-[#C9A961] hover:bg-[#D8B872] text-white rounded-lg px-4 py-3.5 text-sm font-medium mt-2">
                  ✍️ ให้ติดต่อกลับ / ฝากข้อมูล
                </button>
                <div className="pt-2 border-t border-gray-100 mt-2">
                  <p className="text-[11px] text-gray-400 mb-1.5">สอบถามเฉพาะเรื่อง:</p>
                  <div className="grid grid-cols-1 gap-1">
                    {LEAD_TOPICS.filter((t) => t.value !== 'general').map((t) => (
                      <button key={t.value} onClick={() => openForm(t.value)} className="text-left text-xs text-gray-600 hover:text-[#C9A961] py-1.5">› {t.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* ฟอร์มให้ติดต่อกลับ */}
            {view === 'form' && (
              <div className="p-5 space-y-3">
                <label className="block text-xs text-gray-500">ประเภทคำถาม
                  <select value={topic} onChange={(e) => setTopic(e.target.value)} className={`${inputCls} mt-1`}>
                    {LEAD_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ" className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="เบอร์โทร *" className={inputCls} />
                  <input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="LINE ID *" className={inputCls} />
                </div>
                <p className="text-[11px] text-gray-400 -mt-1">* กรอกเบอร์ หรือ LINE อย่างน้อย 1 ช่อง</p>
                <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="Email (ถ้ามี)" className={inputCls} />
                {topic === 'parts' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={carModel} onChange={(e) => setCarModel(e.target.value)} className={inputCls}>
                      <option value="">รุ่นรถ</option>
                      {CAR_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="Part number" className={inputCls} />
                  </div>
                )}
                {(topic === 'cvd' || topic === 'property') && (
                  <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="งบประมาณ / รายละเอียดสินค้า" className={inputCls} />
                )}
                <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="รายละเอียดเพิ่มเติม" className={`${inputCls} resize-none`} />
                <input value={callbackTime} onChange={(e) => setCallbackTime(e.target.value)} placeholder="เวลาที่สะดวกให้ติดต่อกลับ (เช่น บ่ายวันนี้)" className={inputCls} />
                <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#C9A961]" />
                  <span>ยินยอมให้ทีมงานติดต่อกลับตามข้อมูลที่ให้ไว้</span>
                </label>
                {/* honeypot — ซ่อนจากผู้ใช้จริง */}
                <div className="absolute left-[-9999px] w-px h-px overflow-hidden" aria-hidden="true">
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
                </div>
                {err && <p className="text-xs text-red-600">{err}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setView('menu')} className="px-4 py-2.5 text-sm border border-gray-300 rounded text-gray-600">ย้อนกลับ</button>
                  <button onClick={submit} disabled={submitting} className="flex-1 bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-60 text-white rounded px-4 py-2.5 text-sm font-medium">
                    {submitting ? 'กำลังส่ง…' : 'ส่งข้อมูล'}
                  </button>
                </div>
              </div>
            )}
            {/* auto-reply หลังส่งสำเร็จ */}
            {view === 'done' && (
              <div className="p-6 text-center space-y-3">
                <div className="text-4xl">✅</div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{AUTO_REPLY}</p>
                {ref && <p className="text-xs text-gray-400">เลขอ้างอิง: {ref}</p>}
                <div className="text-sm text-gray-800 pt-3 border-t border-gray-100">
                  LINE: {CONTACT.lineId}<br />Tel: {CONTACT.telDisplay}
                </div>
                <a href={lineHref} target="_blank" rel="noopener noreferrer" className="inline-block bg-[#06C755] hover:bg-[#05B04A] text-white rounded px-5 py-2.5 text-sm font-medium">เปิด LINE เลย</a>
                <button onClick={close} className="block w-full text-xs text-gray-400 mt-2">ปิด</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
