// app/page.tsx — Home (Server Component) — eBook-First Launch
// v6 = ปิดแจก FULL ทุกรุ่น → โหลดได้เฉพาะ LITE PDF ฟรี · ฉบับเต็ม = สินค้าขายผ่านไลน์
//      (replaces v5 "อ่านออนไลน์ฉบับเต็ม" W124/W140)
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { CHASSIS_MODELS, LINE_OA_URL } from '@/lib/constants'

export const revalidate = 300

export default async function HomePage() {
  const supabase = await createClient()

  const articlesRes = await supabase
    .from('content')
    .select('*')
    .eq('is_published', true)
    .eq('type', 'knowledge')
    .order('published_at', { ascending: false })
    .limit(3)

  const articles = articlesRes.data ?? []

  return (
    <>
      {/* HERO — Split Layout Dark Premium */}
      <section className="bg-[#1C1D2C] text-[#F2EDE0]">
        <div className="container mx-auto px-4 max-w-7xl grid md:grid-cols-2 gap-8 py-12 md:py-16 items-center">

          {/* LEFT: Content */}
          <div>
            <p className="text-[10px] md:text-xs tracking-[0.32em] text-[#C9A961] font-serif mb-5">
              CLASSIC MERCEDES-BENZ
            </p>

            <h1 className="text-3xl md:text-5xl font-serif font-medium leading-tight tracking-tight">
              อะไหล่ <span className="text-[#C9A961]">Mercedes-Benz</span>
              <br />
              คลาสสิก
              <br />
              <em className="text-[#B8B3A7] text-2xl md:text-4xl not-italic">จบในที่เดียว</em>
            </h1>

            {/* Chassis pills */}
            <div className="flex flex-wrap gap-2 mt-6">
              {CHASSIS_MODELS.map((m) => (
                <Link
                  key={m}
                  href={`/search?model=${m}`}
                  className="inline-block border border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961] hover:text-[#1C1D2C] transition px-3 py-1.5 text-xs font-serif tracking-wider"
                >
                  {m}
                </Link>
              ))}
            </div>

            <p className="text-sm text-[#8E8F9E] mt-4">
              OEM แท้ · รับประกัน 15 วัน · ส่งทั่วไทย
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <Link
                href="/intake"
                className="rounded-none bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-6 py-3.5 text-center tracking-wide transition"
              >
                📋 ส่งภาพอะไหล่ให้ประเมิน
              </Link>
              <Link
                href="/search"
                className="rounded-none border border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961]/10 font-medium px-6 py-3.5 text-center tracking-wide transition"
              >
                ค้นหาอะไหล่ →
              </Link>
            </div>
          </div>

          {/* RIGHT: Hero image with glow */}
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,169,97,0.18)_0%,transparent_65%)] z-0"></div>
            <div className="relative z-10 overflow-hidden border border-[#2E303F]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-w140.jpg"
                alt="Mercedes-Benz W140 S70 AMG — Mr.Chuti's collection"
                className="w-full h-full object-cover aspect-[4/3]"
              />
            </div>
            <p className="absolute bottom-3 right-3 text-[10px] text-[#C9A961] tracking-widest font-serif bg-[#1C1D2C]/80 px-2 py-1 z-20">
              W140 · S70 AMG
            </p>
            {/* eBook CTA RIBBON — top-left */}
            <a
              href="#ebooks"
              className="absolute top-4 left-4 z-20 bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] px-3 py-2 text-xs md:text-sm font-medium tracking-wide shadow-lg transition-all hover:scale-105 flex items-center gap-1.5"
            >
              📖 <span>eBook ฟรี 5 เล่ม</span>
              <span className="text-[#1C1D2C]/70">↓</span>
            </a>
          </div>
        </div>

        {/* TRUST BADGES STRIP */}
        <div className="border-t border-[#2E303F]">
          <div className="container mx-auto px-4 max-w-7xl py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white/[0.03] border border-[#C9A961]/25 px-5 py-3.5 flex items-start gap-3">
                <span className="text-[#C9A961] text-lg font-serif">✓</span>
                <div>
                  <p className="text-xs font-medium text-[#C9A961] tracking-widest">OEM แท้ 100%</p>
                  <p className="text-[11px] text-[#B8B3A7] mt-1">ของแท้ Mercedes-Benz · ผ่านการตรวจทุกชิ้น</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-[#C9A961]/25 px-5 py-3.5 flex items-start gap-3">
                <span className="text-[#C9A961] text-lg font-serif">✓</span>
                <div>
                  <p className="text-xs font-medium text-[#C9A961] tracking-widest">ส่งทั่วไทย</p>
                  <p className="text-[11px] text-[#B8B3A7] mt-1">EMS / Kerry / Flash · เก็บปลายทางได้</p>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-[#C9A961]/25 px-5 py-3.5 flex items-start gap-3">
                <span className="text-[#C9A961] text-lg font-serif">✓</span>
                <div>
                  <p className="text-xs font-medium text-[#C9A961] tracking-widest">ตอบใน 4 ชั่วโมง</p>
                  <p className="text-[11px] text-[#B8B3A7] mt-1">ทีม Mr.Chuti · เจ้าของรถ V12 ตัวจริง</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION: eBook ฟรี — Hero Lead Magnet         */}
      {/* ============================================ */}
      <section id="ebooks" className="container mx-auto px-4 py-14 md:py-16 max-w-7xl scroll-mt-20">
        <div className="text-center mb-10">
          <p className="text-[10px] tracking-[0.32em] text-[#8B7355] font-serif mb-2">
            FREE EBOOKS · MERCEDES-BENZ CLASSIC
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-medium text-gray-900">
            📖 ดาวน์โหลด eBook ฟรี — 5 รุ่นในตำนาน (ฉบับ LITE)
          </h2>
          <p className="text-sm md:text-base text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed">
            คู่มือฉบับ <strong className="text-[#C9A961]">คนเล่นจริง</strong> — เลือกซื้อให้เป็น ดูอาการให้ออก
            <br className="hidden md:block" />
            จากประสบการณ์ <strong className="text-[#C9A961]">10+ ปี</strong> ของ Mr.Chuti · ทุกรุ่นโหลดฉบับ LITE ฟรี · <strong className="text-[#C9A961]">ฉบับเต็ม</strong> สั่งซื้อทางไลน์
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {[
            { code: 'W123', name: 'เบนซ์ตาหวาน', emoji: '👁', tagline: 'E-Class รุ่นต้น' },
            { code: 'W124', name: 'รถถังเยอรมัน', emoji: '🛡', tagline: 'E-Class · E500' },
            { code: 'W126', name: 'เจ้าพ่อเซี่ยงไฮ้', emoji: '👑', tagline: 'S-Class ตำนาน' },
            { code: 'W140', name: 'ปลาวาฬปราบเสี่ย', emoji: '🐋', tagline: 'S-Class · S70 AMG' },
            { code: 'W201', name: 'Baby-Benz', emoji: '👶', tagline: '190E คลาสสิคเริ่มต้น' },
          ].map((book) => {
            const href = `/ebooks/${book.code}_LITE.pdf`
            return (
              <a
                key={book.code}
                href={href}
                download
                className="group bg-white border border-gray-200 hover:border-[#C9A961] hover:shadow-md transition overflow-hidden"
              >
                <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/ebooks/${book.code}_cover.jpg`}
                    alt={`${book.code} — ${book.name} eBook cover`}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <div className="font-serif font-medium text-base text-gray-900 group-hover:text-[#C9A961]">
                    {book.emoji} {book.code}
                  </div>
                  <div className="text-xs text-[#8B7355] mt-1 line-clamp-1">{book.name}</div>
                  <div className="text-[10px] text-gray-500 mt-1 line-clamp-1">{book.tagline}</div>
                  <div className="text-[11px] text-[#C9A961] mt-2 font-medium flex items-center gap-1">
                    <span>⬇</span> LITE · ฟรี
                  </div>
                </div>
              </a>
            )
          })}
        </div>

        {/* LINE banner — FULL version = paid product */}
        <div className="mt-8 bg-gray-50 border border-gray-200 p-4 md:p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-shrink-0 text-4xl">📚</div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-base font-medium text-gray-900">
              ต้องการ <strong>eBook ฉบับเต็ม</strong> (เนื้อหาครบทุกบท + รูปประกอบเชิงลึก)?
            </p>
            <p className="text-sm text-gray-600 mt-1">
              ฉบับเต็มมีจำหน่ายเฉพาะทางไลน์ — ทักไลน์{' '}
              <a
                href={LINE_OA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C9A961] hover:underline font-medium"
              >
                mr.chuti5988
              </a>
              {' '}เพื่อสั่งซื้อ / สอบถามราคา
            </p>
          </div>
          <a
            href={LINE_OA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#06C755] hover:bg-[#05B04A] text-white font-medium px-6 py-3 text-sm whitespace-nowrap transition"
          >
            💬 สั่งซื้อเล่มเต็มทางไลน์
          </a>
        </div>
      </section>

      {/* ARTICLES */}
      {articles.length > 0 && (
        <section className="container mx-auto px-4 py-10 max-w-7xl border-t border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-medium text-gray-900">📖 บทความความรู้</h2>
            <Link href="/articles" className="text-sm text-[#C9A961] hover:underline">ดูทั้งหมด →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {articles.map((a: any) => (
              <Link
                key={a.id}
                href={`/articles/${a.slug}`}
                className="block rounded-md bg-white border border-gray-200 hover:border-[#C9A961] hover:shadow-md transition overflow-hidden"
              >
                {a.cover_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover_image} alt={a.title} className="w-full h-40 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {a.related_models?.slice(0, 3).map((m: string) => (
                      <span key={m} className="text-xs bg-[#C9A961]/10 text-[#8B7355] border border-[#C9A961]/30 px-2 py-0.5">{m}</span>
                    ))}
                  </div>
                  <h3 className="font-serif font-medium text-gray-900 line-clamp-2">{a.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA BANNER — dark premium */}
      <section className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="bg-[#1C1D2C] text-[#F2EDE0] p-8 md:p-12 text-center">
          <p className="text-[10px] tracking-[0.32em] text-[#C9A961] font-serif mb-3">CAN&apos;T FIND WHAT YOU NEED?</p>
          <h2 className="text-2xl md:text-3xl font-serif font-medium mb-3">
            ไม่รู้จะถามใคร? ไม่รู้จะเริ่มตรงไหน?
          </h2>
          <p className="text-base text-[#B8B3A7] mb-7">
            ส่งอาการรถมาเลย — ทีมตอบกลับใน <strong className="text-[#C9A961]">4 ชั่วโมง</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/intake"
              className="bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] font-medium px-7 py-3.5 tracking-wide transition"
            >
              📋 ส่งอาการรถ
            </Link>
            <a
              href={LINE_OA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961]/10 font-medium px-7 py-3.5 tracking-wide transition"
            >
              💬 ทักทาย LINE
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
