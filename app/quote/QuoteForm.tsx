// app/quote/QuoteForm.tsx — Client form component
// Phase 1A — 2026-06-09

'use client'

import { useState } from 'react'

type Status = 'idle' | 'uploading' | 'success' | 'error'

const CHASSIS_OPTIONS = [
  { value: '', label: '-- เลือกรุ่นรถ --' },
  { value: 'W123', label: 'W123 · เบนซ์ตาหวาน' },
  { value: 'W124', label: 'W124 · รถถังเยอรมัน' },
  { value: 'W126', label: 'W126 · เจ้าพ่อเซี่ยงไฮ้' },
  { value: 'W140', label: 'W140 · ปลาวาฬปราบเสี่ย' },
  { value: 'W201', label: 'W201 · Baby-Benz' },
  { value: 'W202', label: 'W202' },
  { value: 'W210', label: 'W210' },
  { value: 'R107', label: 'R107 SL' },
  { value: 'R129', label: 'R129 SL' },
  { value: 'OTHER', label: 'อื่นๆ (ระบุในรายละเอียด)' },
]

const MAX_FILES = 3
const MAX_SIZE_MB = 5

export default function QuoteForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [quoteId, setQuoteId] = useState<string | null>(null)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return

    // Validate count
    const merged = [...files, ...selected].slice(0, MAX_FILES)
    if (merged.length > MAX_FILES) {
      alert(`ส่งได้สูงสุด ${MAX_FILES} รูปครับ`)
    }

    // Validate each
    const validated: File[] = []
    for (const f of merged) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`รูป ${f.name} ใหญ่เกิน ${MAX_SIZE_MB}MB ครับ`)
        continue
      }
      if (!f.type.startsWith('image/')) {
        alert(`${f.name} ไม่ใช่รูปภาพครับ (รองรับ JPG/PNG/WebP/HEIC)`)
        continue
      }
      validated.push(f)
    }

    setFiles(validated)

    // Generate previews
    const previewUrls: string[] = []
    let loaded = 0
    validated.forEach((f, i) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        previewUrls[i] = reader.result as string
        loaded += 1
        if (loaded === validated.length) {
          setPreviews([...previewUrls])
        }
      }
      reader.readAsDataURL(f)
    })

    e.target.value = '' // reset input
  }

  const removeFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx))
    setPreviews(previews.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (files.length === 0) {
      alert('กรุณาแนบรูปอะไหล่อย่างน้อย 1 รูปครับ')
      return
    }

    setStatus('uploading')
    setMessage('')

    const formData = new FormData(e.currentTarget)
    files.forEach((f) => formData.append('photos', f))

    try {
      const res = await fetch('/api/quotes/create', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setQuoteId(data.quote_id || null)
        setStatus('success')
        setMessage('ส่งเรียบร้อย! Mr.Chuti จะตอบกลับใน 4 ชั่วโมง')
        ;(e.target as HTMLFormElement).reset()
        setFiles([])
        setPreviews([])
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error?.message || 'Submit failed')
      }
    } catch (err) {
      setStatus('error')
      setMessage('เกิดข้อผิดพลาด — ลองอีกครั้ง หรือทักไลน์ mr.chuti5988')
    }
  }

  // ===== Success view =====
  if (status === 'success') {
    return (
      <div className="bg-green-50 border-2 border-green-300 rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="font-serif text-2xl text-gray-900 mb-3">ส่งสำเร็จ!</h3>
        <p className="text-gray-700 mb-2">{message}</p>
        {quoteId && (
          <p className="text-xs text-gray-500 mb-5">
            เลขอ้างอิง: <span className="font-mono font-medium">{quoteId.slice(0, 8).toUpperCase()}</span>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://line.me/R/ti/p/%40440ifncj"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#06C755] hover:bg-[#05B04A] text-white font-medium px-6 py-3 transition"
          >
            💬 ทักไลน์ตอนนี้ — เร่งด่วน
          </a>
          <button
            onClick={() => {
              setStatus('idle')
              setMessage('')
              setQuoteId(null)
            }}
            className="border border-gray-300 hover:border-[#C9A961] hover:text-[#C9A961] text-gray-700 font-medium px-6 py-3 transition"
          >
            ส่งเรื่องใหม่
          </button>
        </div>
      </div>
    )
  }

  // ===== Form =====
  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* PHOTOS — most important */}
      <div>
        <label className="block font-medium text-gray-900 mb-2">
          1. รูปอะไหล่ที่ต้องการ <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-3">
          ส่งได้สูงสุด {MAX_FILES} รูป · ขนาดไม่เกิน {MAX_SIZE_MB}MB/รูป · JPG/PNG/WebP/HEIC
        </p>

        {/* Previews */}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square bg-gray-100 border border-gray-300 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {files.length < MAX_FILES && (
          <label className="block border-2 border-dashed border-gray-300 hover:border-[#C9A961] transition rounded p-6 text-center cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              className="sr-only"
              disabled={status === 'uploading'}
            />
            <div className="text-3xl mb-2">📷</div>
            <div className="font-medium text-gray-900">
              {files.length === 0 ? 'แตะเพื่อเลือกรูป' : `เพิ่มรูป (${files.length}/${MAX_FILES})`}
            </div>
            <div className="text-xs text-gray-500 mt-1">หรือถ่ายรูปจากกล้อง</div>
          </label>
        )}
      </div>

      {/* VEHICLE MODEL + YEAR */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="vehicle_model" className="block font-medium text-gray-900 mb-2">
            2. รุ่นรถ <span className="text-red-500">*</span>
          </label>
          <select
            id="vehicle_model"
            name="vehicle_model"
            required
            className="w-full border border-gray-300 px-3 py-2.5 focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
          >
            {CHASSIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vehicle_year" className="block font-medium text-gray-900 mb-2">
            ปี
          </label>
          <input
            id="vehicle_year"
            name="vehicle_year"
            type="number"
            min="1970"
            max="2026"
            placeholder="1998"
            className="w-full border border-gray-300 px-3 py-2.5 focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
          />
        </div>
      </div>

      {/* PART DESCRIPTION */}
      <div>
        <label htmlFor="part_description" className="block font-medium text-gray-900 mb-2">
          3. รายละเอียดเพิ่มเติม
        </label>
        <textarea
          id="part_description"
          name="part_description"
          rows={3}
          maxLength={500}
          placeholder="เช่น ไฟท้ายฝั่งซ้าย แตก / กันชนหน้า มีสนิม / ต้องการรุ่น original"
          className="w-full border border-gray-300 px-3 py-2.5 focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
        />
      </div>

      {/* CONTACT INFO */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="font-serif text-lg text-gray-900 mb-4">📞 ติดต่อกลับ</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="customer_name" className="block font-medium text-gray-900 mb-2">
              ชื่อ <span className="text-red-500">*</span>
            </label>
            <input
              id="customer_name"
              name="customer_name"
              type="text"
              required
              maxLength={100}
              placeholder="คุณสมชาย"
              className="w-full border border-gray-300 px-3 py-2.5 focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="customer_phone" className="block font-medium text-gray-900 mb-2">
                เบอร์โทร <span className="text-red-500">*</span>
              </label>
              <input
                id="customer_phone"
                name="customer_phone"
                type="tel"
                required
                pattern="[0-9\-\s\+]{9,15}"
                maxLength={20}
                placeholder="081-234-5678"
                className="w-full border border-gray-300 px-3 py-2.5 focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
              />
            </div>
            <div>
              <label htmlFor="customer_line" className="block font-medium text-gray-900 mb-2">
                LINE ID
              </label>
              <input
                id="customer_line"
                name="customer_line"
                type="text"
                maxLength={100}
                placeholder="@somchai หรือ ID"
                className="w-full border border-gray-300 px-3 py-2.5 focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* HONEYPOT — anti-bot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] opacity-0"
        aria-hidden="true"
      />

      {/* SUBMIT */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={status === 'uploading'}
          className="w-full bg-[#C9A961] hover:bg-[#D8B872] disabled:bg-gray-400 text-[#1C1D2C] font-medium px-6 py-4 text-base tracking-wide transition"
        >
          {status === 'uploading' ? '⏳ กำลังส่ง...' : '📤 ส่งคำขอประเมินราคา'}
        </button>

        <p className="text-xs text-gray-500 mt-3 text-center">
          ส่งเรื่องแล้ว Mr.Chuti จะตรวจสอบ + ตอบกลับใน 4 ชั่วโมง · ส่งฟรี ไม่มีค่าใช้จ่าย
        </p>
      </div>

      {/* ERROR */}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 text-sm">
          {message}
        </div>
      )}
    </form>
  )
}
