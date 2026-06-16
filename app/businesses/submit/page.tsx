'use client'
// app/businesses/submit/page.tsx — ฟอร์มให้อู่/ร้านกรอกเอง (เข้าคิวรออนุมัติ)
// 2026-06-15: additive · ส่งเข้า /api/businesses/submit → ตาราง business_submissions (pending)
import { useState } from 'react'

const MODELS = ['W124', 'W126', 'W140', 'W201', 'W202', 'W210', 'อื่นๆ']
const SERVICES = ['ตัวถัง', 'ภายใน', 'ECU', 'ระบบไฟฟ้า', 'เครื่องยนต์', 'ช่วงล่าง', 'แอร์', 'เกียร์', 'อื่นๆ']
const TYPES = [
  { v: 'garage', label: '🔨 อู่ซ่อม' },
  { v: 'parts_shop', label: '🛒 ร้านอะไหล่' },
  { v: 'both', label: '🔨🛒 ทั้งคู่' },
]

export default function BusinessSubmitPage() {
  const [f, setF] = useState<any>({
    name: '', type: 'garage', province: '', address: '', google_maps_url: '',
    phone: '', line_id: '', website: '', description: '',
    models_expertise: [] as string[], services: [] as string[],
    website_hp: '', consent: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:border-[#C9A961] focus:outline-none'
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const toggle = (k: string, v: string) =>
    setF((s: any) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x: string) => x !== v) : [...s[k], v] }))

  const submit = async () => {
    setErr('')
    if (!f.name.trim()) { setErr('กรุณากรอกชื่ออู่/ร้าน'); return }
    if (!f.phone.trim() && !f.line_id.trim()) { setErr('กรุณากรอกเบอร์โทร หรือ LINE อย่างน้อย 1 ช่อง'); return }
    if (!f.province.trim()) { setErr('กรุณากรอกจังหวัด'); return }
    if (!f.consent) { setErr('กรุณายืนยันความถูกต้องของข้อมูลก่อนส่ง'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/businesses/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      })
      const j = await r.json().catch(() => ({}))
      if (j?.ok) setDone(true)
      else setErr('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง')
    } catch { setErr('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง') } finally { setSubmitting(false) }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-serif font-medium text-gray-900 mb-3">ส่งข้อมูลร้านเรียบร้อย</h1>
        <p className="text-gray-700 leading-relaxed">
          ขอบคุณครับ — ทีม ChutiBenz จะตรวจสอบข้อมูลก่อนนำขึ้นแสดงในไดเรกทอรี
          เพื่อให้รายชื่อทุกร้านน่าเชื่อถือ
        </p>
        <a href="/businesses" className="inline-block mt-6 text-sm text-[#C9A961] hover:underline">← กลับหน้าอู่/ร้าน</a>
      </div>
    )
  }

  return (
    <section className="container mx-auto px-4 max-w-xl py-12">
      <h1 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-2">เพิ่มอู่ / ร้านอะไหล่ของคุณ</h1>
      <p className="text-sm text-gray-500 mb-6">กรอกข้อมูลร้าน — ทีมงานตรวจสอบก่อนขึ้นแสดง · ฟรี ไม่มีค่าใช้จ่าย</p>

      <div className="space-y-4">
        <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="ชื่ออู่ / ร้าน *" className={inputCls} />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">ประเภท *</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t.v} type="button" onClick={() => set('type', t.v)}
                className={`px-3 py-2 rounded-lg border text-sm ${f.type === t.v ? 'border-[#C9A961] bg-[#FBF7EC] text-gray-900' : 'border-gray-300 text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input value={f.province} onChange={(e) => set('province', e.target.value)} placeholder="จังหวัด *" className={inputCls} />
          <input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="เบอร์โทร" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={f.line_id} onChange={(e) => set('line_id', e.target.value)} placeholder="LINE ID" className={inputCls} />
          <input value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="เว็บไซต์ / Facebook" className={inputCls} />
        </div>

        <textarea value={f.address} onChange={(e) => set('address', e.target.value)} rows={2} placeholder="ที่อยู่ร้าน" className={`${inputCls} resize-none`} />

        <div>
          <input value={f.google_maps_url} onChange={(e) => set('google_maps_url', e.target.value)} placeholder="📍 ลิงก์ Google Maps (โลเคชั่นร้าน)" className={inputCls} />
          <p className="text-[11px] text-gray-500 mt-1">เปิด Google Maps → หาร้าน → กดแชร์ → ก๊อปลิงก์มาวาง (ช่วยให้ลูกค้านำทางหาคุณได้)</p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">🚗 รุ่นที่ถนัด</p>
          <div className="flex flex-wrap gap-2">
            {MODELS.map((m) => (
              <button key={m} type="button" onClick={() => toggle('models_expertise', m)}
                className={`px-3 py-1.5 rounded-lg border text-sm ${f.models_expertise.includes(m) ? 'border-[#C9A961] bg-[#FBF7EC]' : 'border-gray-300 text-gray-600'}`}>{m}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">🔧 งานที่ถนัด</p>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <button key={s} type="button" onClick={() => toggle('services', s)}
                className={`px-3 py-1.5 rounded-lg border text-sm ${f.services.includes(s) ? 'border-[#C9A961] bg-[#FBF7EC]' : 'border-gray-300 text-gray-600'}`}>{s}</button>
            ))}
          </div>
        </div>

        <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="รายละเอียดร้าน / จุดเด่น (ถ้ามี)" className={`${inputCls} resize-none`} />

        {/* honeypot */}
        <div className="absolute left-[-9999px] w-px h-px overflow-hidden" aria-hidden="true">
          <input tabIndex={-1} autoComplete="off" value={f.website_hp} onChange={(e) => set('website_hp', e.target.value)} name="website_hp" />
        </div>

        {/* Disclaimer (ข้อ 3) */}
        <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 leading-relaxed">
          ℹ️ ChutiBenz เป็นเพียง<strong>ผู้รวบรวมรายชื่อ</strong>อู่/ร้านเพื่ออำนวยความสะดวกในการค้นหา —
          ไม่ได้เป็นเจ้าของ ไม่ได้รับประกันคุณภาพงานหรือความเสียหายที่เกิดจากอู่/ร้าน
          ผู้ใช้บริการต้องตรวจสอบและตกลงเงื่อนไขกับอู่/ร้านโดยตรง
        </div>

        {/* Consent — ยินยอมแสดงข้อมูลติดต่อ (ข้อ 4) */}
        <label className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#C9A961] shrink-0" />
          <span>ยืนยันว่าข้อมูลถูกต้องและเป็นร้านของฉันจริง และ<strong>ยินยอมให้ ChutiBenz แสดงข้อมูลติดต่อ (ชื่อร้าน · เบอร์ · LINE · ที่อยู่ · โลเคชั่น) บนเว็บไซต์สาธารณะ</strong> <span className="text-red-500">*</span></span>
        </label>

        {err && <p className="text-sm text-red-600 font-medium">{err}</p>}

        <button onClick={submit} disabled={submitting}
          className="w-full bg-[#C9A961] hover:bg-[#D8B872] disabled:opacity-60 text-[#1C1D2C] font-bold rounded-lg px-4 py-3.5 text-base">
          {submitting ? 'กำลังส่ง…' : 'ส่งข้อมูลร้าน'}
        </button>
      </div>
    </section>
  )
}
