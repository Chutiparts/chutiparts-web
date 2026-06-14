// app/w140/page.tsx — Phase 2 Chassis Page: W140 (S-Class "ปลาวาฬ")
// 2026-06-14: storytelling + สินค้าพร้อมส่ง + บทความ + CTA + SEO/JSON-LD
// หมายเหตุ: layout.tsx มี Header/Footer ให้แล้ว — หน้านี้ render เฉพาะเนื้อหา
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'

const SITE_URL = 'https://chutibenz.com'
const LINE_OA = 'https://line.me/R/ti/p/%40440ifncj'
const MODEL = 'W140'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'อะไหล่ Mercedes-Benz W140 (ปลาวาฬ) S-Class — มือสอง OEM แท้',
  description:
    'คลังอะไหล่ Mercedes-Benz W140 S-Class "ปลาวาฬ" มือสอง OEM แท้ — 300SE/S320, S420, S500, S600 V12, S70 AMG · เครื่อง M104 M119 M120 · ไฟหน้า HID, โต๊ะปิกนิก, ของหายาก · นำเข้า เทสก่อนส่ง โดย ChutiBenz',
  alternates: { canonical: `${SITE_URL}/w140` },
  openGraph: {
    title: 'อะไหล่ Mercedes-Benz W140 (ปลาวาฬ) S-Class — ChutiBenz',
    description: 'คลังอะไหล่ W140 S-Class มือสอง OEM แท้ — เครื่อง M104/M119/M120, ของหายาก นำเข้า เทสก่อนส่ง',
    url: `${SITE_URL}/w140`,
    type: 'website',
  },
}

const SUBMODELS = [
  { name: '300SE / 300SEL → S320', engine: 'M104 · 3.2 I6', years: '1991–1998' },
  { name: '400SE / 400SEL → S420', engine: 'M119 · 4.2 V8', years: '1991–1998' },
  { name: '500SE / 500SEL → S500', engine: 'M119 · 5.0 V8', years: '1991–1998' },
  { name: '600SE / 600SEL → S600', engine: 'M120 · 6.0 V12', years: '1991–1998' },
  { name: 'S70 / S73 AMG', engine: 'M120 ขยายความจุ', years: 'หายากมาก' },
  { name: 'CL / SEC Coupe (C140)', engine: 'V8 / V12 2 ประตู', years: '1992–1998' },
]

const PARTS_SYSTEMS = [
  { icon: '💡', title: 'ระบบไฟ / โคมไฟ', desc: 'ไฟหน้า HID Xenon แท้, ไฟท้าย, ชุดสายไฟ' },
  { icon: '🪵', title: 'ภายใน / งานไม้', desc: 'โต๊ะปิกนิกลายไม้, คอนโซล, แผงไม้ Walnut' },
  { icon: '⚙️', title: 'เครื่องยนต์', desc: 'M104 / M119 / M120 — ปะเก็น, ปั๊ม, คอยล์, ชุดสายไฟเครื่อง' },
  { icon: '🛞', title: 'ช่วงล่าง / เบรก', desc: 'ลูกหมาก, บูช, ปั๊มเพาเวอร์, จาน/ผ้าเบรก' },
  { icon: '❄️', title: 'แอร์ / ระบบสุญญากาศ', desc: 'ระบบล็อกประตูสุญญากาศ, แอร์, ตู้เย็นหลังออปชั่น' },
  { icon: '🔩', title: 'ตัวถัง / ภายนอก', desc: 'กันชน, กระจังหน้า, กระจกมองข้าง, มือเปิด' },
]

const COMMON_ISSUES = [
  'ชุดสายไฟเครื่อง (M104/M119/M120) เสื่อมกรอบตามอายุ — ควรเช็กก่อนซื้อ',
  'ระบบล็อกประตู/ฝากระโปรงแบบสุญญากาศรั่ว (pneumatic)',
  'งานไม้ภายในแตกลายงา / สีซีด',
  'มอเตอร์กระจก, ที่ปัดน้ำฝน, ระบบแอร์ตามอายุ',
  'เครื่อง M120 V12 ระบบซับซ้อน ค่าซ่อมสูง — อะไหล่แท้สำคัญ',
  'ซีลรั่ว ปั๊มเพาเวอร์ / หม้อน้ำ / ปะเก็นฝาวาล์ว',
]

export default async function W140Page() {
  const supabase = await createClient()

  const [{ data: products }, { data: articles }] = await Promise.all([
    supabase.from('products').select('*').eq('is_published', true).contains('compatible_models', [MODEL]).limit(8),
    supabase.from('content').select('*').eq('is_published', true).contains('related_models', [MODEL]).limit(3),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'อะไหล่ Mercedes-Benz W140 (ปลาวาฬ) — ChutiBenz',
    url: `${SITE_URL}/w140`,
    about: { '@type': 'Thing', name: 'Mercedes-Benz W140 S-Class' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'W140', item: `${SITE_URL}/w140` },
      ],
    },
  }

  return (
    <>
      {/* HERO */}
      <section className="bg-[#1C1D2C] text-[#F2EDE0]">
        <div className="container mx-auto px-4 max-w-7xl py-14 md:py-20">
          <p className="text-[10px] md:text-xs tracking-[0.32em] text-[#C9A961] font-serif mb-4">CLASSIC MERCEDES-BENZ · S-CLASS</p>
          <h1 className="text-3xl md:text-5xl font-serif font-medium leading-tight">
            อะไหล่ <span className="text-[#C9A961]">W140</span> — S-Class “ปลาวาฬ”
          </h1>
          <p className="text-[#B8B3A7] mt-5 max-w-2xl leading-relaxed">
            แฟลกชิป S-Class ปี 1991–1998 ที่ Mercedes ทุ่มสุดตัว — รถที่ over-engineered ที่สุดในยุคนั้น
            ตั้งแต่เครื่อง 6 สูบ M104 ไปจนถึง V12 M120 และตำนาน S70 AMG · ChutiBenz คัดอะไหล่ OEM แท้ นำเข้า เทสก่อนส่ง
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link href="/search?model=W140" className="bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-6 py-3 tracking-wide transition">ดูอะไหล่ W140 ทั้งหมด →</Link>
            <Link href="/intake" className="border border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961]/10 font-medium px-6 py-3 tracking-wide transition">📋 ฝากหาอะไหล่ / ส่งอาการรถ</Link>
          </div>
        </div>
      </section>

      {/* SUBMODELS */}
      <section className="container mx-auto px-4 max-w-7xl py-12">
        <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-6">รุ่นย่อย & ช่วงปี</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUBMODELS.map((s) => (
            <div key={s.name} className="border border-gray-200 rounded-lg p-4 bg-white">
              <p className="font-semibold text-gray-900">{s.name}</p>
              <p className="text-sm text-[#8B7355] mt-1">{s.engine}</p>
              <p className="text-xs text-gray-500 mt-1">{s.years}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-4">* ปี 1993 Mercedes เปลี่ยนชื่อรุ่น เช่น 300SE → S320, 500SEL → S500L</p>
      </section>

      {/* PARTS SYSTEMS */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 max-w-7xl py-12">
          <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-6">ระบบอะไหล่หลัก</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PARTS_SYSTEMS.map((p) => (
              <div key={p.title} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="text-3xl mb-2">{p.icon}</div>
                <p className="font-semibold text-gray-900">{p.title}</p>
                <p className="text-sm text-gray-600 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMON ISSUES */}
      <section className="container mx-auto px-4 max-w-7xl py-12">
        <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-2">โรคประจำรุ่น W140 (เช็กก่อนซื้อ)</h2>
        <p className="text-sm text-gray-500 mb-6">รู้ก่อน ซื้ออะไหล่ตรงจุด — ข้อมูลจากประสบการณ์จริง</p>
        <ul className="grid md:grid-cols-2 gap-3">
          {COMMON_ISSUES.map((c, i) => (
            <li key={i} className="flex gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-gray-800">
              <span className="text-[#C9A961] font-bold">▸</span>{c}
            </li>
          ))}
        </ul>
        <Link href="/intake" className="inline-block mt-5 text-sm bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium rounded-lg px-5 py-2.5 transition">
          💬 ไม่แน่ใจอาการรถ? ส่งให้ทีมเช็ก
        </Link>
      </section>

      {/* PRODUCTS */}
      {products && products.length > 0 && (
        <section className="bg-gray-50 border-y border-gray-100">
          <div className="container mx-auto px-4 max-w-7xl py-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900">🛒 อะไหล่ W140 พร้อมส่ง</h2>
              <Link href="/search?model=W140" className="text-sm text-[#C9A961] hover:underline">ดูทั้งหมด →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p: any) => (
                <Link key={p.id} href={`/products/${p.slug}`} className="group bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-[#C9A961] hover:shadow-md transition">
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🚗</div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{p.name}</h3>
                    {typeof p.price === 'number' && p.price > 0 ? (
                      <p className="text-[#C9A961] font-semibold mt-1">฿{p.price.toLocaleString()}</p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">สอบถามราคาทาง LINE</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ARTICLES */}
      {articles && articles.length > 0 && (
        <section className="container mx-auto px-4 max-w-7xl py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900">📖 บทความ W140</h2>
            <Link href="/articles" className="text-sm text-[#C9A961] hover:underline">ดูทั้งหมด →</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {articles.map((a: any) => (
              <Link key={a.id} href={`/articles/${a.slug}`} className="block rounded-md bg-white border border-gray-200 hover:border-[#C9A961] hover:shadow-md transition overflow-hidden">
                {a.cover_image && <img src={a.cover_image} alt={a.title} className="w-full h-40 object-cover" />}
                <div className="p-4">
                  <h3 className="font-serif font-medium text-gray-900 line-clamp-2">{a.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container mx-auto px-4 max-w-7xl py-12">
        <div className="bg-[#1C1D2C] text-[#F2EDE0] p-8 md:p-12 text-center rounded-xl">
          <h2 className="text-2xl md:text-3xl font-serif font-medium mb-3">หาอะไหล่ W140 ไม่เจอ?</h2>
          <p className="text-[#B8B3A7] mb-7">ส่งรุ่นรถ + VIN หรืออาการ — ทีม Mr.Chuti ช่วยหาอะไหล่หายากให้</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/intake" className="bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-7 py-3.5 tracking-wide transition">📋 ส่งอาการรถ / VIN</Link>
            <a href={LINE_OA} target="_blank" rel="noopener noreferrer" className="border border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961]/10 font-medium px-7 py-3.5 tracking-wide transition">💬 ทักทาย LINE</a>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  )
}
