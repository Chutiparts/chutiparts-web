'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CHASSIS_MODELS, MODEL_INFO, INTAKE_TYPES,
  SYMPTOM_CATEGORIES, PARTS_CATEGORIES, PROVINCES,
} from '@/lib/constants'
import { IntakeSchema, type IntakeData } from '@/lib/intake-schema'
import { submitIntake } from './actions'

const LS_KEY = 'chutiparts_intake_draft'

export default function IntakeFormClient() {
  const router = useRouter()
  const params = useSearchParams()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form state — restore from localStorage if exists
  const [data, setData] = useState<Partial<IntakeData>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem(LS_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  // Auto-save to localStorage on each change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify(data))
    }
  }, [data])

  // Capture UTM on mount
  useEffect(() => {
    if (!data.utm_source) {
      setData(d => ({
        ...d,
        utm_source: params.get('utm_source') || undefined,
        utm_medium: params.get('utm_medium') || undefined,
        utm_campaign: params.get('utm_campaign') || undefined,
        source: params.get('source') || 'web_form',
      }))
    }
  }, [params])

  const update = (patch: Partial<IntakeData>) => {
    setData(d => ({ ...d, ...patch }))
    setErrors({})
  }

  const validateStep = (n: number): boolean => {
    const e: Record<string, string> = {}
    if (n === 1) {
      if (!data.chassis) e.chassis = 'เลือกรุ่นรถ'
      if (!data.year) e.year = 'ระบุปีรถ'
    }
    if (n === 2) {
      if (!data.intake_type) e.intake_type = 'เลือกประเภท'
    }
    if (n === 3 && data.intake_type === 'find_parts') {
      if (!data.part_name) e.part_name = 'ระบุชื่ออะไหล่'
    }
    if (n === 3 && (data.intake_type === 'find_garage' || data.intake_type === 'symptom_advice')) {
      if (!data.symptom_category) e.symptom_category = 'เลือกหมวดอาการ'
      if (!data.symptom_detail || data.symptom_detail.length < 10)
        e.symptom_detail = 'อธิบายอย่างน้อย 10 ตัวอักษร'
    }
    if (n === 4 && data.intake_type === 'find_garage') {
      if (!data.photo_urls || data.photo_urls.length === 0)
        e.photo_urls = 'ใส่รูปอย่างน้อย 1 ภาพ (กรณีหาอู่)'
    }
    if (n === 5) {
      if (!data.contact_name || data.contact_name.length < 2) e.contact_name = 'ใส่ชื่อ'
      if (!data.contact_phone && !data.contact_line_id)
        e.contact_phone = 'ใส่เบอร์โทรหรือ LINE ID อย่างน้อย 1 อย่าง'
      if (!data.contact_province) e.contact_province = 'เลือกจังหวัด'
      if (!data.consent) e.consent = 'ต้องยินยอมเพื่อส่งต่อ'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (validateStep(step)) setStep(s => s + 1)
  }
  const back = () => setStep(s => s - 1)

  const handleSubmit = async () => {
    if (!validateStep(5)) return
    setSubmitting(true)
    try {
      const parsed = IntakeSchema.parse(data as IntakeData)
      const { case_number, line_url } = await submitIntake(parsed)
      // Clear draft
      localStorage.removeItem(LS_KEY)
      // Redirect
      const target = `/intake/success?case=${case_number}${line_url ? `&line=${encodeURIComponent(line_url)}` : ''}`
      router.push(target)
    } catch (err: any) {
      console.error(err)
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ลองอีกครั้ง'))
      setSubmitting(false)
    }
  }

  // Available years based on chassis
  const yearRange = data.chassis ? MODEL_INFO[data.chassis as keyof typeof MODEL_INFO] : null

  return (
    <div className="rounded-2xl bg-white shadow-sm p-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-6">
        {[1,2,3,4,5].map(n => (
          <div key={n} className="flex items-center flex-1">
            <div className={[
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
              step >= n ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'
            ].join(' ')}>{n}</div>
            {n < 5 && <div className={`h-1 flex-1 ${step > n ? 'bg-yellow-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500 mb-4">ขั้นที่ {step} / 5</p>

      {/* STEP 1: Vehicle */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">รถของคุณคันไหน?</h2>

          <div>
            <label className="block text-sm font-semibold mb-2">รุ่น *</label>
            <div className="grid grid-cols-3 gap-2">
              {CHASSIS_MODELS.map(m => (
                <button key={m}
                  type="button"
                  onClick={() => update({ chassis: m })}
                  className={[
                    'rounded-lg border-2 p-3 text-center font-semibold transition',
                    data.chassis === m ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-400'
                  ].join(' ')}
                >
                  {m}
                  <div className="text-xs text-gray-500 mt-1">{MODEL_INFO[m].thai_name.split(' ')[0]}</div>
                </button>
              ))}
            </div>
            {errors.chassis && <p className="text-red-500 text-sm mt-1">{errors.chassis}</p>}
          </div>

          {data.chassis && yearRange && (
            <div>
              <label className="block text-sm font-semibold mb-2">
                ปี * <span className="text-gray-500 text-xs">({yearRange.year_from} - {yearRange.year_to})</span>
              </label>
              <input
                type="number"
                min={yearRange.year_from} max={yearRange.year_to}
                placeholder={String(Math.round((yearRange.year_from + yearRange.year_to) / 2))}
                value={data.year || ''}
                onChange={e => update({ year: parseInt(e.target.value) || undefined })}
                className="w-full rounded-lg border-2 border-gray-300 p-3 text-lg focus:border-yellow-500 focus:outline-none"
              />
              {errors.year && <p className="text-red-500 text-sm mt-1">{errors.year}</p>}
            </div>
          )}

          {data.chassis && yearRange && (
            <div>
              <label className="block text-sm font-semibold mb-2">เครื่องยนต์ (ถ้ารู้)</label>
              <div className="flex gap-2 flex-wrap">
                {yearRange.engines.map(e => (
                  <button key={e} type="button"
                    onClick={() => update({ engine_code: e })}
                    className={[
                      'rounded-full px-4 py-2 text-sm font-medium border-2',
                      data.engine_code === e ? 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 hover:border-yellow-400'
                    ].join(' ')}
                  >{e}</button>
                ))}
                <button type="button"
                  onClick={() => update({ engine_code: '' })}
                  className="rounded-full px-4 py-2 text-sm text-gray-500 border-2 border-gray-200"
                >ไม่แน่ใจ</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Intake type */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">ต้องการให้ช่วยอะไร?</h2>
          <div className="space-y-2">
            {(Object.entries(INTAKE_TYPES) as [keyof typeof INTAKE_TYPES, typeof INTAKE_TYPES[keyof typeof INTAKE_TYPES]][]).map(([key, info]) => (
              <button key={key} type="button"
                onClick={() => update({ intake_type: key })}
                className={[
                  'w-full rounded-lg border-2 p-4 text-left flex items-center gap-3 transition',
                  data.intake_type === key ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-400'
                ].join(' ')}
              >
                <span className="text-3xl">{info.icon}</span>
                <div>
                  <div className="font-bold">{info.label}</div>
                  <div className="text-sm text-gray-600">{info.desc}</div>
                </div>
              </button>
            ))}
          </div>
          {errors.intake_type && <p className="text-red-500 text-sm">{errors.intake_type}</p>}
        </div>
      )}

      {/* STEP 3: Details (conditional) */}
      {step === 3 && data.intake_type === 'find_parts' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">หาอะไหล่อะไร?</h2>

          <div>
            <label className="block text-sm font-semibold mb-2">ชื่ออะไหล่ *</label>
            <input
              type="text"
              placeholder="เช่น ไฟท้าย, กล่อง ECU, กันชน"
              value={data.part_name || ''}
              onChange={e => update({ part_name: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-300 p-3 text-lg focus:border-yellow-500 focus:outline-none"
            />
            {errors.part_name && <p className="text-red-500 text-sm mt-1">{errors.part_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Part Number (ถ้ารู้)</label>
            <input
              type="text"
              placeholder="เช่น A1408000048"
              value={data.part_number || ''}
              onChange={e => update({ part_number: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-300 p-3 focus:border-yellow-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">หมวดหมู่</label>
            <select
              value={data.part_category || ''}
              onChange={e => update({ part_category: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-300 p-3 focus:border-yellow-500 focus:outline-none"
            >
              <option value="">— เลือก —</option>
              {PARTS_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 3 && (data.intake_type === 'find_garage' || data.intake_type === 'symptom_advice') && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">อาการรถเป็นยังไง?</h2>

          <div>
            <label className="block text-sm font-semibold mb-2">หมวดอาการ *</label>
            <select
              value={data.symptom_category || ''}
              onChange={e => update({ symptom_category: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-300 p-3 text-lg focus:border-yellow-500 focus:outline-none"
            >
              <option value="">— เลือกหมวด —</option>
              {SYMPTOM_CATEGORIES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {errors.symptom_category && <p className="text-red-500 text-sm mt-1">{errors.symptom_category}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">รายละเอียดอาการ *</label>
            <textarea
              rows={5}
              maxLength={500}
              placeholder="อธิบายอาการให้ละเอียด — เริ่มเป็นเมื่อไหร่ เป็นตอนไหน เสียงยังไง..."
              value={data.symptom_detail || ''}
              onChange={e => update({ symptom_detail: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-300 p-3 focus:border-yellow-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">{(data.symptom_detail || '').length} / 500</p>
            {errors.symptom_detail && <p className="text-red-500 text-sm">{errors.symptom_detail}</p>}
          </div>

          <div className="space-y-2 rounded-lg bg-orange-50 border border-orange-200 p-3">
            <label className="flex items-center gap-3">
              <input type="checkbox"
                checked={data.warning_light || false}
                onChange={e => update({ warning_light: e.target.checked })}
                className="h-5 w-5"
              />
              <span>⚠️ มีไฟเตือนติดบนหน้าปัด</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox"
                checked={data.stop_drive || false}
                onChange={e => update({ stop_drive: e.target.checked })}
                className="h-5 w-5"
              />
              <span>🛑 ขับต่อไม่ได้แล้ว (รถจอด)</span>
            </label>
          </div>
        </div>
      )}

      {/* STEP 4: Photos */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">📷 มีรูปประกอบไหม?</h2>
          <p className="text-sm text-gray-600">
            {data.intake_type === 'find_garage' ? 'จำเป็นต้องมีรูปสำหรับหาอู่' : 'มี/ไม่มีก็ได้ — แต่ถ้ามีรูปจะช่วยให้เรา quote เร็วขึ้น'}
          </p>

          <PhotoUploader
            urls={data.photo_urls || []}
            onChange={urls => update({ photo_urls: urls })}
            max={5}
          />
          {errors.photo_urls && <p className="text-red-500 text-sm">{errors.photo_urls}</p>}
        </div>
      )}

      {/* STEP 5: Contact */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">เราติดต่อกลับยังไง?</h2>

          <div>
            <label className="block text-sm font-semibold mb-2">ชื่อ *</label>
            <input type="text" placeholder="คุณ..."
              value={data.contact_name || ''}
              onChange={e => update({ contact_name: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-300 p-3 text-lg focus:border-yellow-500 focus:outline-none"
            />
            {errors.contact_name && <p className="text-red-500 text-sm mt-1">{errors.contact_name}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-2">เบอร์โทร</label>
              <input type="tel" placeholder="0812345678"
                value={data.contact_phone || ''}
                onChange={e => update({ contact_phone: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-300 p-3 text-lg focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">LINE ID</label>
              <input type="text" placeholder="@yourname"
                value={data.contact_line_id || ''}
                onChange={e => update({ contact_line_id: e.target.value })}
                className="w-full rounded-lg border-2 border-gray-300 p-3 text-lg focus:border-yellow-500 focus:outline-none"
              />
            </div>
          </div>
          {errors.contact_phone && <p className="text-red-500 text-sm">{errors.contact_phone}</p>}

          <div>
            <label className="block text-sm font-semibold mb-2">จังหวัด *</label>
            <select
              value={data.contact_province || ''}
              onChange={e => update({ contact_province: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-300 p-3 focus:border-yellow-500 focus:outline-none"
            >
              <option value="">— เลือกจังหวัด —</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {errors.contact_province && <p className="text-red-500 text-sm">{errors.contact_province}</p>}
          </div>

          <label className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
            <input type="checkbox"
              checked={data.consent || false}
              onChange={e => update({ consent: e.target.checked })}
              className="h-5 w-5 mt-1"
            />
            <span className="text-sm">
              ฉันยินยอมให้ ChutiParts เก็บข้อมูลและติดต่อกลับ
              (ดู <a href="/privacy" target="_blank" className="text-blue-600 underline">นโยบายความเป็นส่วนตัว</a>)
            </span>
          </label>
          {errors.consent && <p className="text-red-500 text-sm">{errors.consent}</p>}

          <label className="flex items-center gap-3 rounded-lg bg-green-50 p-3">
            <input type="checkbox"
              checked={data.send_to_line !== false}
              onChange={e => update({ send_to_line: e.target.checked })}
              className="h-5 w-5"
            />
            <span className="text-sm">💬 เปิด LINE ทันทีหลังส่ง (แนะนำ)</span>
          </label>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <button onClick={back}
            className="flex-1 rounded-lg border-2 border-gray-300 py-3 font-semibold hover:bg-gray-50"
          >← ย้อน</button>
        )}
        {step < 5 ? (
          <button onClick={next}
            disabled={submitting}
            className="flex-1 rounded-lg bg-yellow-500 hover:bg-yellow-600 py-3 text-white font-semibold"
          >ถัดไป →</button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 rounded-lg bg-green-500 hover:bg-green-600 py-3 text-white font-bold disabled:opacity-50"
          >
            {submitting ? 'กำลังส่ง...' : '📤 ส่งเลย'}
          </button>
        )}
      </div>
    </div>
  )
}

// Simple photo uploader — uses Supabase Storage
function PhotoUploader({ urls, onChange, max }: {
  urls: string[]
  onChange: (urls: string[]) => void
  max: number
}) {
  const [uploading, setUploading] = useState(false)

  const upload = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    try {
      // TODO: upload to /api/intake/upload (Supabase Storage)
      // For now: use FileReader to data URL (placeholder)
      const newUrls: string[] = []
      for (let i = 0; i < Math.min(files.length, max - urls.length); i++) {
        const file = files[i]
        if (file.size > 10 * 1024 * 1024) {
          alert(`ไฟล์ ${file.name} ใหญ่เกิน 10MB`)
          continue
        }
        // Replace with actual upload:
        const url = await new Promise<string>((resolve) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.readAsDataURL(file)
        })
        newUrls.push(url)
      }
      onChange([...urls, ...newUrls])
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {urls.length < max && (
        <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 cursor-pointer hover:border-yellow-500">
          <span className="text-4xl mb-2">📷</span>
          <span className="text-sm font-semibold">
            {uploading ? 'กำลังอัพโหลด...' : `แตะเพื่อถ่ายรูป / เลือกไฟล์ (${urls.length}/${max})`}
          </span>
          <span className="text-xs text-gray-500 mt-1">JPG, PNG, MP4 — ไม่เกิน 10MB/ไฟล์</span>
          <input
            type="file"
            accept="image/*,video/mp4,video/quicktime"
            multiple
            capture="environment"
            onChange={e => upload(e.target.files)}
            className="hidden"
          />
        </label>
      )}

      {urls.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-24 w-full rounded-lg object-cover" />
              <button
                onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 text-sm"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
