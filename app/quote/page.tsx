// app/quote/page.tsx — Public Quote Form Page (Server Component)
// Phase 1A — 2026-06-09
// Customer flow: รูปอะไหล่ → AI Vision → Mr.Chuti's Admin Inbox

import QuoteForm from './QuoteForm'
import Link from 'next/link'

export const metadata = {
  title: 'ขอประเมินราคาอะไหล่ — ChutiBenz',
  description: 'ส่งรูปอะไหล่ Mercedes-Benz คลาสสิคที่ต้องการ — ทีม Mr.Chuti ตอบกลับใน 4 ชั่วโมง',
}

export default function QuotePage() {
  return (
    <>
      {/* HERO */}
      <section className="bg-[#1C1D2C] text-[#F2EDE0]">
        <div className="container mx-auto px-4 max-w-3xl py-12 md:py-16 text-center">
          <p className="text-[10px] md:text-xs tracking-[0.32em] text-[#C9A961] font-serif mb-3">
            QUOTE REQUEST · MERCEDES-BENZ CLASSIC
          </p>
          <h1 className="text-3xl md:text-4xl font-serif font-medium leading-tight">
            📷 ส่งรูปอะไหล่ที่ต้องการ
            <br />
            <span className="text-[#C9A961]">ตอบกลับใน 4 ชั่วโมง</span>
          </h1>
          <p className="text-sm md:text-base text-[#B8B3A7] mt-5 leading-relaxed">
            อัพโหลดรูปอะไหล่จากรถคุณ · บอกรุ่น/ปี · ทีม Mr.Chuti จะเช็คสต็อก
            <br className="hidden md:block" />
            พร้อมแจ้งราคา · สภาพ · ค่าจัดส่งกลับให้
          </p>
        </div>

        {/* TRUST STRIP */}
        <div className="border-t border-[#2E303F]">
          <div className="container mx-auto px-4 max-w-3xl py-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="text-xs text-[#C9A961]">
                <div className="text-base">✓</div>
                OEM แท้ 100%
              </div>
              <div className="text-xs text-[#C9A961]">
                <div className="text-base">✓</div>
                รับประกัน 15 วัน
              </div>
              <div className="text-xs text-[#C9A961]">
                <div className="text-base">✓</div>
                ส่งทั่วไทย
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="container mx-auto px-4 max-w-2xl py-10 md:py-14">
        <QuoteForm />
      </section>

      {/* INFO STRIP — Why send photo */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="container mx-auto px-4 max-w-3xl py-10">
          <h2 className="text-lg font-serif font-medium text-gray-900 mb-5 text-center">
            ทำไมต้องส่งรูป?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-2xl mb-2">🔍</div>
              <strong className="block text-gray-900 mb-1">เช็คตรงรุ่น</strong>
              อะไหล่ Mercedes คลาสสิคมีหลายซับโมเดล รูปช่วยให้ตรงคันแน่
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-2xl mb-2">📦</div>
              <strong className="block text-gray-900 mb-1">เห็นสภาพชัด</strong>
              ดูจุดสึกหรอ จุดที่ต้องเปลี่ยน เพื่อแนะนำของให้ตรงงาน
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-2xl mb-2">⚡</div>
              <strong className="block text-gray-900 mb-1">ตอบเร็วขึ้น</strong>
              ไม่ต้องถามตอบหลายรอบ ส่งครบครั้งเดียวจบ
            </div>
          </div>
        </div>
      </section>

      {/* ALT CONTACT */}
      <section className="container mx-auto px-4 max-w-3xl py-8 text-center text-sm text-gray-600">
        ติดต่อทางอื่น:
        {' '}
        <a
          href="https://line.me/R/ti/p/%40440ifncj"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#C9A961] hover:underline font-medium"
        >
          💬 LINE mr.chuti5988
        </a>
        {' · '}
        <Link href="/" className="text-[#C9A961] hover:underline">
          ← กลับหน้าแรก
        </Link>
      </section>
    </>
  )
}
