 // app/vin-check/VinCheckForm.tsx — Client form component V4
// Phase 2 — 2026-05-31
// V4: Added optional Data Card image upload field

'use client'

import { useState } from 'react'

export default function VinCheckForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [dataCardFile, setDataCardFile] = useState<File | null>(null)
  const [dataCardPreview, setDataCardPreview] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('ไฟล์ใหญ่เกิน 10MB ครับ')
      return
    }

    // Validate type
    if (!file.type.startsWith('image/')) {
      alert('อัพโหลดได้เฉพาะรูปภาพ (JPG, PNG, WebP)')
      return
    }

    setDataCardFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setDataCardPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('loading')

    const formData = new FormData(e.currentTarget)
    // Add datacard file if uploaded
    if (dataCardFile) {
      formData.append('data_card', dataCardFile)
    }

    try {
      const res = await fetch('/api/vin-check', {
        method: 'POST',
        body: formData,  // multipart, no Content-Type header (browser sets it)
      })

      if (res.ok) {
        setStatus('success')
        setMessage('ส่ง VIN เรียบร้อย! Mr.Chuti จะตอบกลับใน 4 ชั่วโมง')
        ;(e.target as HTMLFormElement).reset()
        setDataCardFile(null)
        setDataCardPreview(null)
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Submit failed')
      }
    } catch (err) {
      setStatus('error')
      setMessage(`เกิดข้อผิดพลาด — ลองอีกครั้ง หรือทักไลน์ @mr.chuti5988`)
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-green-50 border-2 border-green-300 rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="font-serif text-2xl text-gray-900 mb-3">ส่งสำเร็จ!</h3>
        <p className="text-gray-700 mb-4">{message}</p>
        
          href="https://line.me/R/ti/p/%40440ifncj"
          className="inline-block bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-6 py-3 rounded transition"
        >
          💬 ทักไลน์ตอนนี้ — ถ้าเรื่องด่วน
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 md:p-8 space-y-4">

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อ-นามสกุล *
        </label>
        <input
          name="name"
          type="text"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          LINE ID หรือ Email *
        </label>
        <input
          name="contact"
          type="text"
          required
          placeholder="LINE: @xxx หรือ email@example.com"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]"
        />
        <p className="text-xs text-gray-500 mt-1">Mr.Chuti จะตอบกลับทาง LINE/Email ที่นี่</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          VIN (17 ตัวอักษร) *
        </label>
        <input
          name="vin"
          type="text"
          required
          maxLength={17}
          minLength={17}
          placeholder="เช่น WDB1400322A123456"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961] font-mono uppercase"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            รุ่นรถ
          </label>
          <select
            name="car_model"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]"
          >
            <option value="">เลือก...</option>
            <option value="W124">W124 (E-Class)</option>
            <option value="W126">W126 (S-Class)</option>
            <option value="W140">W140 (S-Class หัวแตงโม)</option>
            <option value="W201">W201 (190E)</option>
            <option value="W202">W202 (C-Class)</option>
            <option value="W210">W210 (E-Class)</option>
            <option value="other">อื่น ๆ</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ปี
          </label>
          <input
            name="car_year"
            type="number"
            min="1970"
            max="2010"
            placeholder="เช่น 1996"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          คำถาม / สิ่งที่อยากรู้ (option)
        </label>
        <textarea
          name="questions"
          rows={4}
          placeholder="เช่น: กำลังจะซื้อรถคันนี้ อยากรู้รุ่นย่อย, ปีผลิตจริง, option ที่ติดมา"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#C9A961]"
        />
      </div>

      {/* ===== V4 NEW: Data Card Upload (Optional) ===== */}
      <div className="bg-amber-50 border border-amber-200 rounded p-4">
        <label className="block text-sm font-semibold text-amber-900 mb-2">
          📷 รูป Data Card (option — แต่แนะนำมาก!)
        </label>
        <p className="text-xs text-amber-800 mb-3">
          📍 หาได้จาก: <strong>สติ๊กเกอร์ใต้กระโปรงรถ</strong> หรือใน <strong>ช่องเก็บของท้ายรถ</strong>
          <br />
          📋 ระบบจะ AI decode สี + interior + ทุก option codes ฟรี!
        </p>

        <input
          type="file"
          name="data_card_input"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-600
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-[#C9A961] file:text-[#1C1D2C]
            hover:file:bg-[#D8B872]
            cursor-pointer"
        />

        {dataCardPreview && (
          <div className="mt-3">
            <p className="text-xs text-gray-600 mb-2">✅ Preview:</p>
            <img
              src={dataCardPreview}
              alt="Data Card Preview"
              className="max-w-full max-h-48 rounded border border-gray-300"
            />
            <button
              type="button"
              onClick={() => {
                setDataCardFile(null)
                setDataCardPreview(null)
              }}
              className="text-xs text-red-600 hover:underline mt-1"
            >
              ลบรูป
            </button>
          </div>
        )}

        <p className="text-xs text-amber-700 mt-2">
          💡 ไม่มี Data Card ก็ได้ — Mr.Chuti จะตอบ basic info จาก VIN
        </p>
      </div>

      {message && status === 'error' && (
        <p className="text-red-600 text-sm">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-6 py-3 rounded transition disabled:opacity-50"
      >
        {status === 'loading' ? 'กำลังส่ง...' : '🔍 ส่ง VIN ให้ Mr.Chuti เช็คฟรี'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        ฟรี · ไม่มีค่าใช้จ่าย · ตอบใน 4 ชั่วโมง · ข้อมูลปลอดภัย
      </p>
    </form>
  )
}
