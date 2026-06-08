// app/about/page.tsx — About ChutiBenz + Mr.Chuti Story
import Link from 'next/link'
import { LINE_OA_URL, PHONE_TEL } from '@/lib/constants'

export const metadata = {
  title: 'เกี่ยวกับ Mr.Chuti & ChutiBenz — เจ้าของรถ S70 AMG ตัวจริง',
  description: 'จากเจ้าของรถ V12 ตัวจริง สู่คลังอะไหล่ Mercedes-Benz Classic — Mr.Chuti story · 10+ ปีในวงการ · S70 AMG 1 ใน ~10 คันในไทย',
}

export default function AboutPage() {
  return (
    <>
      {/* HERO — Dark Premium */}
      <section className="bg-[#1C1D2C] text-[#F2EDE0]">
        <div className="container mx-auto px-4 max-w-5xl py-14 md:py-20">
          <p className="text-[10px] md:text-xs tracking-[0.32em] text-[#C9A961] font-serif mb-5 text-center">
            FROM A REAL V12 OWNER · TO YOU
          </p>
          <h1 className="text-3xl md:text-5xl font-serif font-medium leading-tight tracking-tight text-center">
            ผมคือ <span className="text-[#C9A961]">Mr.Chuti</span>
            <br />
            <em className="text-[#B8B3A7] text-2xl md:text-4xl not-italic">เจ้าของรถ S70 AMG ตัวจริง</em>
          </h1>
          <p className="text-center text-sm md:text-base text-[#B8B3A7] mt-6 max-w-2xl mx-auto leading-relaxed">
            ผมเล่นรถ Mercedes-Benz Classic มา 10+ ปี · เป็นเจ้าของ <strong className="text-[#C9A961]">W140 S70 AMG</strong> 1 ใน ~10 คันในไทย
            <br className="hidden md:block" />
            ChutiBenz = คลังอะไหล่จากเจ้าของรถจริง — ไม่ใช่พ่อค้าที่ไม่เคยขับ
          </p>
        </div>

        {/* Hero image */}
        <div className="container mx-auto px-4 max-w-5xl pb-14">
          <div className="relative overflow-hidden border border-[#2E303F]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-w140.jpg"
              alt="W140 S70 AMG — Mr.Chuti's daily driver"
              className="w-full h-full object-cover aspect-[16/9]"
            />
            <p className="absolute bottom-4 right-4 text-xs text-[#C9A961] tracking-widest font-serif bg-[#1C1D2C]/90 px-3 py-1.5">
              W140 · S70 AMG · 1 ใน ~10 คันในไทย
            </p>
          </div>
        </div>
      </section>

      {/* STORY */}
      <section className="container mx-auto px-4 max-w-3xl py-14 md:py-16">
        <p className="text-[10px] tracking-[0.32em] text-[#8B7355] font-serif mb-3 text-center">
          MY STORY
        </p>
        <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 text-center mb-10">
          เริ่มจากความหลงใหล · จบที่การส่งต่อความรู้
        </h2>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700 leading-relaxed">
          <p>
            ย้อนกลับไป 10+ ปีก่อน — ผม Chuti ตกหลุมรัก Mercedes-Benz ยุค 80-90 ตั้งแต่ครั้งแรกที่ได้ขับ <strong>W126</strong> ของพ่อ
            ความเงียบ ความนุ่ม ความ over-engineering ของรถยุคนั้น ทำให้ผมคิดเสมอว่า
            <em className="text-[#C9A961]">&ldquo;รถสมัยใหม่ไปไม่ถึงหรอก&rdquo;</em>
          </p>

          <p>
            จากรถคันแรก W126 → W124 (รถถังเยอรมัน) → W201 (Baby-Benz) → จนมาถึง
            <strong className="text-[#C9A961]"> W140 S70 AMG</strong> — รถ flagship V12 ที่ใหญ่ที่สุดของยุค
            ผมเป็นเจ้าของ <strong>1 ใน ~10 คันในไทย</strong>
          </p>

          <p>
            ตลอด 10 ปี ผมเจอปัญหาหลักเหมือนกัน — <strong>อะไหล่ของแท้หายาก คนขายไม่เข้าใจรถ
            ช่างไม่กล้าซ่อม คนที่ตั้งใจซื้อรถคลาสสิคโดน &ldquo;หลอก&rdquo; เยอะเกินไป</strong>
          </p>

          <p>
            ผมเลยตัดสินใจเปิด <strong>ChutiBenz</strong> — คลังอะไหล่ที่ผมจัดเก็บไว้ใช้กับรถผมเอง
            ของแท้ทั้งหมด · ผ่านการตรวจทุกชิ้น · คุยกันเหมือนเพื่อนเล่นรถ ไม่ใช่ลูกค้า
          </p>

          <p className="text-center text-lg italic text-[#C9A961] border-l-4 border-[#C9A961]/30 pl-4 my-8">
            &ldquo;ที่ ChutiBenz = คลังอะไหล่จากเจ้าของรถจริง<br />
            ไม่ใช่พ่อค้าที่ไม่เคยขับ&rdquo;
          </p>
        </div>
      </section>

      {/* THE NUMBERS */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-4 max-w-5xl py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-serif font-medium text-[#C9A961]">10+</div>
              <div className="text-xs md:text-sm text-gray-600 mt-2">ปีในวงการ Mercedes Classic</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-serif font-medium text-[#C9A961]">7</div>
              <div className="text-xs md:text-sm text-gray-600 mt-2">รุ่นเชี่ยวชาญ<br />(W123-W210)</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-serif font-medium text-[#C9A961]">5</div>
              <div className="text-xs md:text-sm text-gray-600 mt-2">eBook ฟรี<br />คู่มือเลือกซื้อ</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-serif font-medium text-[#C9A961]">4</div>
              <div className="text-xs md:text-sm text-gray-600 mt-2">ชั่วโมงตอบกลับ<br />(ในเวลาทำการ)</div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHUTIBENZ */}
      <section className="container mx-auto px-4 max-w-5xl py-14 md:py-16">
        <p className="text-[10px] tracking-[0.32em] text-[#8B7355] font-serif mb-3 text-center">
          WHY CHUTIBENZ
        </p>
        <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 text-center mb-10">
          4 เหตุผลที่คนเล่นรถคลาสสิคเลือกเรา
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 hover:border-[#C9A961] transition p-6">
            <div className="text-3xl mb-3">🔧</div>
            <h3 className="font-serif font-medium text-lg text-gray-900 mb-2">อะไหล่แท้ OEM 100%</h3>
            <p className="text-sm text-gray-600">ของแท้ Mercedes-Benz · ตรวจทุกชิ้นก่อนส่ง · คลังจากรถผมเอง</p>
          </div>
          <div className="bg-white border border-gray-200 hover:border-[#C9A961] transition p-6">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-serif font-medium text-lg text-gray-900 mb-2">ระบบส่งอาการรถ</h3>
            <p className="text-sm text-gray-600">บอกอาการ → ทีมแนะนำอะไหล่ + ช่างที่ verify · จบในที่เดียว</p>
          </div>
          <div className="bg-white border border-gray-200 hover:border-[#C9A961] transition p-6">
            <div className="text-3xl mb-3">🤝</div>
            <h3 className="font-serif font-medium text-lg text-gray-900 mb-2">เครือข่ายช่างพาร์ทเนอร์</h3>
            <p className="text-sm text-gray-600">อู่ที่ผ่านการ verify · เข้าใจรถคลาสสิค · ไม่หลอก</p>
          </div>
          <div className="bg-white border border-gray-200 hover:border-[#C9A961] transition p-6">
            <div className="text-3xl mb-3">⏱</div>
            <h3 className="font-serif font-medium text-lg text-gray-900 mb-2">ตอบกลับใน 4 ชั่วโมง</h3>
            <p className="text-sm text-gray-600">ในเวลา 9:00-18:00 · LINE / โทร / Inbox FB</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="bg-[#1C1D2C] text-[#F2EDE0] p-8 md:p-12 text-center">
          <p className="text-[10px] tracking-[0.32em] text-[#C9A961] font-serif mb-3">START HERE</p>
          <h2 className="text-2xl md:text-3xl font-serif font-medium mb-3">
            เริ่มคุยกันได้เลย — ผมตอบเอง
          </h2>
          <p className="text-base text-[#B8B3A7] mb-7">
            ส่งอาการรถ · ทักไลน์ · หรือโทร — ในเวลา <strong className="text-[#C9A961]">4 ชั่วโมง</strong> ผมจะตอบ
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
              className="bg-[#06C755] hover:bg-[#05B04A] text-white font-medium px-7 py-3.5 tracking-wide transition"
            >
              💬 ทักไลน์ mr.chuti5988
            </a>
            <a
              href={PHONE_TEL}
              className="border border-[#C9A961] text-[#C9A961] hover:bg-[#C9A961]/10 font-medium px-7 py-3.5 tracking-wide transition"
            >
              📞 โทร
            </a>
          </div>
          <p className="text-xs text-[#B8B3A7] mt-6">
            Mr.Chuti อะไหล่เบนซ์มือสอง · กรุงเทพมหานคร · ประเทศไทย
          </p>
        </div>
      </section>
    </>
  )
}
