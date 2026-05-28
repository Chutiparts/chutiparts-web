'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const REASONS = [
  { icon: '🛡', title: 'ป้องกันโดน VIN clone', desc: 'รถขโมยถูกเปลี่ยน VIN เลียนแบบของจริง · เช็คให้รู้ก่อนซื้อ' },
  { icon: '📋', title: 'รู้รุ่นย่อยจริง', desc: 'บางคันถูก swap engine · VIN บอกความจริงเสมอ' },
  { icon: '🎨', title: 'รู้สีเดิมจากโรงงาน', desc: 'ดูว่าเคยทำสีหรือเปลี่ยนสีหรือไม่ · กระทบมูลค่า' },
  { icon: '⚙️', title: 'รู้ option ติดรถ', desc: 'Sunroof, Leather, Sound system, Sport package' },
  { icon: '📅', title: 'ปีผลิตจริง vs ปีในเล่ม', desc: 'บางคันต่างกัน 6-12 เดือน' },
  { icon: '🏭', title: 'Plant ที่ผลิต', desc: 'Stuttgart / Mexico / South Africa' },
  { icon: '✅', title: 'อะไหล่ตรงรุ่นย่อย 100%', desc: 'ประหยัด 5,000-15,000 บาท' },
  { icon: '🚨', title: 'Recall check', desc: 'ดูว่ารถคุณเคยถูก recall หรือไม่' },
]

const STEPS = [
  { num: '1', title: 'ส่ง VIN + รุ่น', desc: 'กรอกฟอร์มข้างล่าง — ใช้เวลา 2 นาที' },
  { num: '2', title: 'รอ Mr.Chuti ตรวจ', desc: 'ภายใน 4 ชั่วโมง (เวลา 9-18 น. จ-ส)' },
  { num: '3', title: 'รับ Report เต็ม', desc: 'ส่งทาง LINE หรือ Email' },
  { num: '4', title: 'ปรึกษาเพิ่มได้', desc: 'มีคำถามต่อ ทักไลน์ฟรี' },
]

export default function VinCheckPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')

    const form = e.currentTarget
    const formData = new FormData(form)
    const yearStr = String(formData.get('car_year') || '')
    const data = {
      name: String(formData.get('name') || ''),
      contact: String(formData.get('contact') || ''),
      vin: String(formData.get('vin') || '').toUpperCase(),
      car_model: String(formData.get('car_model') || ''),
      car_year: yearStr ? parseInt(yearStr) : null,
      questions: String(formData.get('questions') || ''),
      status: 'pending',
    }

    try {
      const { error } = await supabase.from('vin_check_requests').insert(data)
      if (error) throw error
      setStatus('success')
      setMessage('ส่ง VIN เรียบร้อย! Mr.Chuti จะตอบกลับใน 4 ชั่วโมง')
      form.reset()
    } catch (err) {
      console.error(err)
      setStatus('error')
      setMessage('เกิดข้อผิดพลาด — ลองอีกครั้ง หรือทักไลน์ @mr.chuti5988')
    }
  }

  return (
    <main className="container mx-auto px-4 py-12 max-w-4xl">

      <nav className="text-sm text-gray-600 mb-6">
        <Link href="/" className="hover:text-[#C9A961]">หน้าแรก</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">VIN Check</span>
      </nav>

      <header className="mb-10 text-center">
        <div className="text-xs text-[#8B7355] uppercase tracking-[0.2em] mb-3">
          FREE EXPERT SERVICE · ตอบใน 4 ชั่วโมง
        </div>
        <h1 className="font-serif text-3xl md:text-5xl font-medium text-gray-900 mb-4">
          เช็ค VIN Mercedes ฟรี
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          ส่ง VIN รถ Mercedes ของคุณ — Mr.Chuti ตรวจสอบให้ฟรี
        </p>
        <p className="text-sm text-[#8B7355] mt-3 italic">
          บริการเทียบเท่า 1,500-2,500 บาท — ที่ ChutiBenz ทำให้ฟรี
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-serif text-2xl text-gray-900 mb-6 text-center">
          ทำไมต้องเช็ค VIN ก่อน?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REASONS.map((item, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-5 hover:border-[#C9A961] transition">
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">{item.icon}</div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12 bg-gray-50 border border-gray-200 rounded-lg p-6 md:p-8">
        <h2 className="font-serif text-2xl text-gray-900 mb-6 text-center">
          ขั้นตอนใช้บริการ
        </h2>
        <ol className="space-y-4 max-w-2xl mx-auto">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="bg-[#C9A961] text-[#1C1D2C] font-medium rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                {step.num}
              </span>
              <div>
                <p className="font-medium text-gray-900">{step.title}</p>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-2xl text-gray-900 mb-6 text-center">
          ส่ง VIN ของคุณ
        </h2>

        {status === 'success' && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="font-serif text-2xl text-gray-900 mb-3">ส่งสำเร็จ!</h3>
            <p className="text-gray-700 mb-4">{message}</p>
            <a href="https://line.me/R/ti/p/%40440ifncj" className="inline-block bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-6 py-3 rounded transition">
              💬 ทักไลน์ตอนนี้ — ถ้าเรื่องด่วน
            </a>
          </div>
        )}

        {status !== 'success' && (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 md:p-8 space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
              <input name="name" type="text" required className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LINE ID หรือ Email *</label>
              <input name="contact" type="text" required placeholder="LINE: @xxx หรือ email@example.com" className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]" />
              <p className="text-xs text-gray-500 mt-1">Mr.Chuti จะตอบกลับทาง LINE/Email ที่นี่</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VIN (17 ตัวอักษร) *</label>
              <input name="vin" type="text" required maxLength={17} minLength={17} placeholder="เช่น WDB1400322A123456" className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961] font-mono uppercase" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รุ่นรถ</label>
                <select name="car_model" className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]">
                  <option value="">เลือก...</option>
                  <option value="W124">W124 (E-Class)</option>
                  <option value="W126">W126 (S-Class)</option>
                  <option value="W140">W140 (S-Class)</option>
                  <option value="W201">W201 (190E)</option>
                  <option value="W202">W202 (C-Class)</option>
                  <option value="W210">W210 (E-Class)</option>
                  <option value="other">อื่น ๆ</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ปี</label>
                <input name="car_year" type="number" min="1970" max="2010" placeholder="เช่น 1996" className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">คำถาม / สิ่งที่อยากรู้ (option)</label>
              <textarea name="questions" rows={4} placeholder="เช่น: กำลังจะซื้อรถคันนี้ อยากรู้รุ่นย่อย" className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]" />
            </div>

            {message && status === 'error' && (
              <p className="text-red-600 text-sm">{message}</p>
            )}

            <button type="submit" disabled={status === 'loading'} className="w-full bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-6 py-3 rounded transition disabled:opacity-50">
              {status === 'loading' ? 'กำลังส่ง...' : '🔍 ส่ง VIN ให้ Mr.Chuti เช็คฟรี'}
            </button>

            <p className="text-xs text-gray-500 text-center">
              ฟรี · ไม่มีค่าใช้จ่าย · ตอบใน 4 ชั่วโมง
            </p>
          </form>
        )}
      </section>

      <section className="mb-12 bg-[#1C1D2C] text-[#F2EDE0] p-6 md:p-8 rounded-lg">
        <h2 className="font-serif text-2xl mb-4">📍 หา VIN ในรถ Mercedes ของคุณ</h2>
        <p className="text-[#B8B3A7] mb-4">VIN มี 17 ตัวอักษร — หาได้ที่:</p>
        <ul className="space-y-2 text-[#F2EDE0]">
          <li>✓ มุมล่างซ้ายของกระจกหน้า (มองจากนอกรถ)</li>
          <li>✓ ใต้กระโปรงหน้า ฝั่ง passenger</li>
          <li>✓ เสา B ฝั่งคนขับ (เปิดประตู)</li>
          <li>✓ สมุดทะเบียนรถ หน้าแรก ช่อง หมายเลขตัวรถ</li>
        </ul>
        <p className="text-sm text-[#8B7355] mt-4 italic">ตัวอย่าง: WDB1400322A123456</p>
      </section>

    </main>
  )
}