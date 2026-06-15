// app/components/HomePremiumParts.tsx — Phase 3 (2026-06-15)
// Section "อะไหล่พรีเมียม & ของหายาก" สำหรับหน้าแรก — component แยก เพิ่มแบบ additive
// ไม่แตะหน้าแรกเดิม · async server component · ดึงสินค้าพรีเมียมตาม slug ที่คัดไว้
// ครอบคลุม Phase 3: (1) trust/ความเชี่ยวชาญ (2) premium highlight (4) dual CTA
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

const LINE_OA = 'https://line.me/R/ti/p/%40440ifncj'

// คัดสินค้าพรีเมียม/ของหายาก (เรียงตามลำดับที่อยากโชว์) — ปรับเพิ่ม/ลบ slug ได้
const PREMIUM_SLUGS = [
  'w140-headlight-hid-xenon',     // W140 ไฟหน้า HID
  'w124-500e-headlight-hella',    // W124 500E โคมไฟ HELLA (NOS)
  'w140-rear-ac-vent',            // ช่องแอร์หลัง W140 ลายไม้
  'victor-db3-steering-wheel',    // พวงมาลัย Victor DB-3
  'w140-picnic-table',            // โต๊ะปิคนิคหลัง W140
  'w124-amg-v3-body-kit',         // ชุดแต่ง AMG V.3 W124
]

function firstImage(p: any): string | null {
  if (Array.isArray(p.image_urls) && p.image_urls.length > 0) return p.image_urls[0]
  return p.image_url || null
}

export default async function HomePremiumParts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products').select('*')
    .in('slug', PREMIUM_SLUGS).eq('is_published', true)

  if (!data || data.length === 0) return null
  // เรียงตามลำดับ PREMIUM_SLUGS + แสดงสูงสุด 6
  const items = PREMIUM_SLUGS.map((s) => data.find((p: any) => p.slug === s)).filter(Boolean).slice(0, 6)
  if (items.length === 0) return null

  return (
    <section className="container mx-auto px-4 py-14 md:py-16 max-w-7xl border-t border-gray-100">
      <div className="text-center mb-10">
        <p className="text-[10px] tracking-[0.32em] text-[#8B7355] font-serif mb-2">PREMIUM &amp; RARE PARTS</p>
        <h2 className="text-3xl md:text-4xl font-serif font-medium text-gray-900">💎 อะไหล่พรีเมียม &amp; ของหายาก</h2>
        <p className="text-sm md:text-base text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed">
          Mr.Chuti เชี่ยวชาญอะไหล่ Mercedes-Benz มือสอง / ของหายาก — เน้นรุ่น
          <strong className="text-[#C9A961]"> W140 · W124 · W126 · W201 · W202 · W210</strong>
          <br className="hidden md:block" />
          ของแท้ ตรงรุ่น คัดสภาพ · มีจำนวนจำกัด
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
        {items.map((p: any) => {
          const img = firstImage(p)
          const hasPrice = typeof p.price === 'number' && p.price > 0
          const cond = p.condition === 'used-good' ? 'มือสอง สภาพดี' :
            p.condition === 'oem' ? 'OEM แท้' :
            p.condition === 'aftermarket' ? 'Aftermarket' : (p.condition || 'มือสอง')
          return (
            <Link
              key={p.id}
              href={`/products/${p.slug}`}
              className="group bg-white border border-gray-200 hover:border-[#C9A961] hover:shadow-md transition overflow-hidden flex flex-col"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden relative">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <span className="text-6xl">🚗</span>
                    <span className="text-[10px] mt-1">สอบถามรูปจริงทาง LINE</span>
                  </div>
                )}
                {typeof p.stock === 'number' && p.stock <= 1 && p.stock > 0 && (
                  <span className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded">เหลือชิ้นสุดท้าย!</span>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <span className="self-start text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full mb-1">{cond}</span>
                <h3 className="font-serif font-medium text-sm md:text-base text-gray-900 line-clamp-2 group-hover:text-[#C9A961]">{p.name}</h3>
                <div className="mt-auto pt-2">
                  {hasPrice ? (
                    <p className="text-lg font-bold text-green-600">฿{p.price.toLocaleString()}</p>
                  ) : (
                    <p className="text-xs font-semibold text-gray-600">สอบถามราคาทาง LINE</p>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* สอบถามสถานะก่อนตัดสินใจ + dual CTA */}
      <div className="mt-7 bg-amber-50 border border-amber-200 rounded-lg p-4 md:p-5 flex flex-col sm:flex-row items-center gap-4">
        <p className="flex-1 text-sm text-amber-900 text-center sm:text-left">
          <span className="font-semibold">⚠️ กรุณาสอบถามสถานะสินค้าก่อนตัดสินใจ</span> — ของหายาก มีจำนวนจำกัด อาจถูกจองหรือขายไปก่อน
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <a href={LINE_OA} target="_blank" rel="noopener noreferrer"
            className="bg-[#06C755] hover:bg-[#05B04A] text-white font-medium px-5 py-2.5 text-sm whitespace-nowrap transition rounded">💬 ทักไลน์สอบถาม</a>
          <Link href="/search"
            className="border border-[#C9A961] text-[#8B7355] hover:bg-[#C9A961]/10 font-medium px-5 py-2.5 text-sm whitespace-nowrap transition rounded">ดูอะไหล่ทั้งหมด →</Link>
        </div>
      </div>
    </section>
  )
}
