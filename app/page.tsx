// app/page.tsx — Home (Server Component)
// REPLACES existing page.tsx
// (existing search/filter on homepage stays; we add new sections above)

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { CHASSIS_MODELS, MODEL_INFO, LINE_OA_URL } from '@/lib/constants'
import HomeClient from './HomeClient' // existing — keep search/filter

export const revalidate = 300

export default async function HomePage() {
  const supabase = await createClient()

  const [productsRes, articlesRes] = await Promise.all([
    supabase.from('products').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(12),
    supabase.from('content').select('*').eq('is_published', true).eq('type', 'knowledge').order('published_at', { ascending: false }).limit(3),
  ])

  const products = productsRes.data ?? []
  const articles = articlesRes.data ?? []

  return (
    <>
      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 text-white py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              อะไหล่ <span className="text-yellow-400">Mercedes-Benz</span> มือสอง
              <br />
              ครบ จบ ในที่เดียว
            </h1>
            <p className="text-gray-300 text-lg mt-4">
              เชี่ยวชาญ W124 · W126 · W140 · W201 · W202 · W210
              <br />
              OEM แท้ 100% · รับประกัน 15 วัน · ส่งทั่วไทย
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                href="/intake"
                className="rounded-xl bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-6 py-4 text-lg text-center"
              >
                📋 ส่งอาการรถ → เราตอบกลับใน 4 ชั่วโมง
              </Link>
              <Link
                href="/search"
                className="rounded-xl border-2 border-white/30 hover:bg-white/10 text-white font-semibold px-6 py-4 text-lg text-center"
              >
                🔍 ค้นหาอะไหล่
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ENTRY BY MODEL */}
      <section className="container mx-auto px-4 py-10 max-w-7xl">
        <h2 className="text-2xl font-bold mb-4">🚗 ตามรุ่นรถ</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CHASSIS_MODELS.map((m) => (
            <Link
              key={m}
              href={`/search?model=${m}`}
              className="rounded-xl bg-white border-2 border-gray-200 hover:border-yellow-400 p-4 text-center transition group"
            >
              <div className="font-bold text-lg group-hover:text-yellow-600">{m}</div>
              <div className="text-xs text-gray-500 mt-1">
                {MODEL_INFO[m].thai_name.split(' ').slice(0, 2).join(' ')}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS — uses existing HomeClient with search/filter */}
      <section className="container mx-auto px-4 max-w-7xl">
        <h2 className="text-2xl font-bold mb-4">🛒 อะไหล่พร้อมขาย</h2>
        <HomeClient products={products} />
      </section>

      {/* ARTICLES (if any) */}
      {articles.length > 0 && (
        <section className="container mx-auto px-4 py-10 max-w-7xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">📖 บทความความรู้</h2>
            <Link href="/articles" className="text-sm text-blue-600 hover:underline">
              ดูทั้งหมด →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {articles.map((a: any) => (
              <Link
                key={a.id}
                href={`/articles/${a.slug}`}
                className="block rounded-xl bg-white border border-gray-100 hover:shadow-lg transition overflow-hidden"
              >
                {a.cover_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover_image} alt={a.title} className="w-full h-40 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {a.related_models?.slice(0, 3).map((m: string) => (
                      <span key={m} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">{m}</span>
                    ))}
                  </div>
                  <h3 className="font-bold text-gray-900 line-clamp-2">{a.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA BANNER */}
      <section className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 p-8 md:p-12 text-center text-gray-900">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            ไม่รู้จะถามใคร? ไม่รู้จะเริ่มตรงไหน?
          </h2>
          <p className="text-lg mb-6">
            ส่งอาการรถมาเลย — ทีมตอบกลับใน <strong>4 ชั่วโมง</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/intake"
              className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold px-6 py-4"
            >
              📋 ส่งอาการรถ
            </Link>
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-4"
            >
              💬 ทักทาย Line
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
