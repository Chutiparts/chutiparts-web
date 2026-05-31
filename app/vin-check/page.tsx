// app/vin-check/page.tsx — VIN Check ฟรี (Customer-facing)
// Phase 1 — 2026-05-31

import type { Metadata } from 'next'
import Link from 'next/link'
import VinCheckForm from './VinCheckForm'

export const metadata: Metadata = {
  title: 'VIN Check Mercedes-Benz ฟรี — ChutiBenz',
  description: 'ตรวจ VIN Mercedes-Benz ฟรี — รู้รุ่นย่อย, ปีผลิต, plant, option จากโรงงาน · บริการโดย Mr.Chuti · ตอบใน 4 ชั่วโมง',
  alternates: { canonical: 'https://chutibenz.com/vin-check' },
  openGraph: {
    title: 'VIN Check Mercedes ฟรี · ChutiBenz',
    description: 'ส่ง VIN รถ Mercedes ของคุณ — เช็คฟรีโดย expert',
    type: 'website',
  },
}

export default function VinCheckPage() {
  return (
    <main className="container mx-auto px-4 py-12 max-w-4xl">

      {/* === Breadcrumb === */}
      <nav className="text-sm text-gray-600 mb-6">
        <Link href="/" className="hover:text-[#C9A961]">หน้าแรก</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">VIN Check</span>
      </nav>

      {/* === Hero === */}
      <header className="mb-10 text-center">
        <div className="text-xs text-[#8B7355] uppercase tracking-[0.2em] mb-3">
          FREE EXPERT SERVICE · ตอบใน 4 ชั่วโมง
        </div>
        <h1 className="font-serif text-3xl md:text-5xl font-medium text-gray-900 mb-4">
          เช็ค VIN Mercedes ฟรี
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          ส่ง VIN รถ Mercedes ของคุณ — Mr.Chuti ตรวจสอบให้ฟรี
          รู้รุ่นย่อย, ปีผลิต, plant, option ที่ติดมาจากโรงงาน
        </p>
        <p className="text-sm text-[#8B7355] mt-3 italic">
          บริการเทียบเท่า ฿1,500-2,500 — ที่ ChutiBenz ทำให้ฟรี
        </p>
      </header>

      {/* === Why Use === */}
      <section className="mb-12">
        <h2 className="font-serif text-2xl text-gray-900 mb-6 text-center">
          ทำไมต้องเช็ค VIN ก่อน?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: '🛡', title: 'ป้องกันโดน VIN clone', desc: 'รถขโมยถูกเปลี่ยน VIN เลียนแบบของจริง · เช็คให้รู้ก่อนซื้อ' },
            { icon: '📋', title: 'รู้รุ่นย่อยจริง', desc: 'บางคันถูก swap engine · VIN บอกความจริงเสมอ' },
            { icon: '🎨', title: 'รู้สีเดิมจากโรงงาน', desc: 'ดูว่าเคยทำสีหรือเปลี่ยนสีหรือไม่ · กระทบมูลค่า' },
            { icon: '⚙️', title: 'รู้ option ติดรถ', desc: 'Sunroof, Leather, Sound system, Sport package — ครบทุกอย่าง' },
            { icon: '📅', title: 'ปีผลิตจริง vs ปีในเล่ม', desc: 'บางคันต่างกัน 6-12 เดือน · กระทบราคาประเมิน' },
            { icon: '🏭', title: 'Plant ที่ผลิต', desc: 'Stuttgart / Mexico / South Africa — กระทบ collector value' },
            { icon: '✅', title: 'อะไหล่ตรงรุ่นย่อย 100%', desc: 'ECU/sensor หลายรุ่นใกล้กัน · เช็ค VIN ก่อนสั่งซื้อ ประหยัด ฿5,000-15,000' },
            { icon: '🚨', title: 'Recall check', desc: 'ดูว่ารถคุณเคยถูก recall หรือไม่ · บางจุดยังต้องทำ' },
          ].map((item, i) => (
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

      {/* === How It Works === */}
      <section className="mb-12 bg-gray-50 border border-gray-200 rounded-lg p-6 md:p-8">
        <h2 className="font-serif text-2xl text-gray-900 mb-6 text-center">
          ขั้นตอนใช้บริการ
        </h2>
        <ol className="space-y-4 max-w-2xl mx-auto">
          {[
            { num: '1', title: 'ส่ง VIN + รุ่น', desc: 'กรอกฟอร์มข้างล่าง — ใช้เวลา 2 นาที' },
            { num: '2', title: 'รอ Mr.Chuti ตรวจ', desc: 'ภายใน 4 ชั่วโมง (เวลา 9-18 น. จ-ส)' },
            { num: '3', title: 'รับ Report เต็ม', desc: 'ส่งทาง LINE หรือ Email — ครบทุกข้อมูล' },
            { num: '4', title: 'ปรึกษาเพิ่มได้', desc: 'มีคำถามต่อ ทักไลน์ได้เลย ฟรี' },
          ].map((step, i) => (
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

      {/* === Form === */}
      <section className="mb-12">
        <h2 className="font-serif text-2xl text-gray-900 mb-6 text-center">
          ส่ง VIN ของคุณ
        </h2>
        <VinCheckForm />
      </section>

      {/* === VIN Location Guide === */}
      <section className="mb-12 bg-[#1C1D2C] text-[#F2EDE0] p-6 md:p-8 rounded-lg">
        <h2 className="font-serif text-2xl mb-4">📍 หา VIN ในรถ Mercedes ของคุณ</h2>
        <p className="text-[#B8B3A7] mb-4">VIN มี 17 ตัวอักษร — หาได้ที่:</p>
        <ul className="space-y-2 text-[#F2EDE0]">
          <li>✓ มุมล่างซ้ายของกระจกหน้า (มองจากนอกรถ)</li>
          <li>✓ ใต้กระโปรงหน้า ฝั่ง passenger</li>
          <li>✓ เสา B ฝั่งคนขับ (เปิดประตู)</li>
          <li>✓ สมุดทะเบียนรถ หน้าแรก ช่อง "หมายเลขตัวรถ"</li>
        </ul>
        <p className="text-sm text-[#8B7355] mt-4 italic">
          ตัวอย่าง: WDB1400322A123456
        </p>
      </section>

      {/* === Trust Signal === */}
      <section className="mb-12 text-center">
        <p className="text-gray-600 italic">
          "10+ ปีที่ผมเก็บอะไหล่ Mercedes — ผมตรวจ VIN มาเป็นพัน
          ไม่มีอะไรน่ายินดีเท่าช่วยให้ owner Mercedes ไม่โดนหลอกอีกแล้ว"
        </p>
        <p className="text-sm text-[#8B7355] mt-2">— Mr.Chuti, ChutiBenz</p>
      </section>

      {/* JSON-LD Service Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'VIN Check Mercedes-Benz ฟรี',
            description: 'บริการตรวจสอบ VIN รถ Mercedes-Benz ฟรี โดย expert ที่เชี่ยวชาญรุ่นคลาสสิค',
            provider: {
              '@type': 'Organization',
              name: 'ChutiBenz',
              url: 'https://chutibenz.com',
            },
            areaServed: { '@type': 'Country', name: 'Thailand' },
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'THB',
              availability: 'https://schema.org/InStock',
            },
            url: 'https://chutibenz.com/vin-check',
          }),
        }}
      />
    </main>
  )
}
