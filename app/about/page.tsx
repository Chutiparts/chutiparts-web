// app/about/page.tsx — About / Founder Story (เรื่องราว ChutiBenz)
// 2026-06-15: หน้าใหม่ · 3 ส่วน (Hero / Founder Story / Trust Points) · โทนจริงใจ ไม่ขายแข็ง
// 2026-06-17: cleanup — "เคยโดน" → "เคยเจ็บ" (metadata + og) · เอา emoji ออกจากปุ่ม LINE
// nav/footer มาจาก layout เหมือนหน้าแรก — หน้านี้ใส่เฉพาะเนื้อหา
import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = 'https://chutibenz.com'
const LINE_OA = 'https://line.me/R/ti/p/%40440ifncj'

export const metadata: Metadata = {
  title: 'เรื่องราวของ ChutiBenz — จากคนซื้อ W140 ที่เคยเจ็บ สู่คลังอะไหล่ที่ให้ความอุ่นใจ',
  description:
    'จากความเจ็บของคนซื้อ Mercedes-Benz W140 คันแรก สู่คลังอะไหล่เบนซ์คลาสสิก W140/W124/W202/W210 ที่ให้ประกัน 15 วัน เพราะอยากให้ลูกค้าซื้ออย่างอุ่นใจ — ซื่อกินไม่หมด คดกินไม่นาน',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'เรื่องราวของ ChutiBenz — คนรัก W140 ที่อยากให้คุณซื้ออะไหล่อย่างอุ่นใจ',
    description:
      'จากคนซื้อ W140 คันแรกที่เคยเจ็บ สู่คลังอะไหล่เบนซ์คลาสสิกที่ให้ประกัน 15 วัน · ซื่อกินไม่หมด คดกินไม่นาน',
    url: `${SITE_URL}/about`,
    type: 'website',
  },
}

const STORY: string[] = [
  'ผมไม่ได้เริ่มต้นจากการเป็นพ่อค้าอะไหล่ครับ',
  'ปี 2019 ผมซื้อ Mercedes-Benz W140 S500 คันแรกในราคา 475,000 บาท คนขายบอกว่า “พี่เติมน้ำมันแล้วใช้ยาวเลย ทุกอย่างสมบูรณ์”',
  'แต่ขับยังไม่ถึง 20 กิโลเมตร แอร์หลังก็ดังจนต้องปิด พอถึงร้านอาหาร น้ำมันเกียร์เริ่มรั่ว สุดท้ายรถเข้าอู่ ช่างบอกว่าเกียร์พัง แอร์ไม่เย็น ความร้อนขึ้น และรถต้องจอดอยู่สามเดือนเพื่อรออะไหล่',
  'ผมจ่ายค่าซ่อมไปอีกประมาณสามแสนบาท รวมแล้วเป็นเงินกว่าเจ็ดแสนบาทกับรถในฝันคันแรกของผม และสุดท้ายผมขายมันทิ้งไปในราคาสามแสนห้า ขาดทุนไปหลายแสนบาทกับรถที่ผมรักมาก',
  'ความเจ็บครั้งนั้นไม่ได้ทำให้ผมเลิกรัก W140 กลับทำให้ผมนั่งศึกษามันอย่างจริงจัง จนรู้ว่ามันมีหลายเวอร์ชัน รุ่นไหนน่าใช้ รุ่นไหนน่าเก็บ และยิ่งรู้ ผมก็ยิ่งหลงรัก',
  'สำหรับผม W140 ไม่ใช่แค่รถรุ่นหนึ่ง แต่คือเสน่ห์ของ Mercedes-Benz ในยุคที่ยังสร้างรถด้วยบุคลิกชัดเจน หนักแน่น และไม่ประนีประนอม',
  'ปัญหาคืออะไหล่ W140 ในไทยหายากมาก หลายชิ้นต้องสั่งจากต่างประเทศ ราคาสูง และรอนาน ผมจึงอาศัยเพื่อนทั่วโลกช่วยหาแหล่งอะไหล่ จากรถคันเดียว กลายเป็นการตามซื้อรถจากต่างประเทศมารื้อเป็นอะไหล่ จนวันนี้ผมมีอะไหล่ทั้ง W140, W124, W202, W210 และ Mercedes-Benz รุ่นคลาสสิกอื่น ๆ ที่คนเล่นรถตามหา',
]

const STORY_2: string[] = [
  'ตอนผมเข้าวงการ อะไหล่มือสองจำนวนมากไม่มีใครให้ประกัน ลูกค้าต้องวัดดวงกันเอง ผมรู้ดีว่าการโดนหลอกหรือซื้อของผิดมันเจ็บแค่ไหน จึงเลือกให้ประกันอะไหล่ 15 วันตั้งแต่วันแรก เพราะผมไม่อยากให้ใครต้องเจอความรู้สึกแบบที่ผมเคยเจอ',
  'ผมอยากให้ลูกค้าซื้อของแล้วอุ่นใจ ไม่ใช่ลุ้นว่าจะโดนหลอกไหม',
  'ทุกวันนี้ไม่ใช่แค่ลูกค้าในไทย ยังมีลูกค้าจากลาวและกัมพูชาที่ไม่เคยเจอผมมาก่อน แต่ไว้ใจส่งรถข้ามประเทศมาให้ผมช่วยดูแลและบูรณะ ตัวผมเองก็ยังเป็นเจ้าของ W140 หลายคันที่ใช้จริง รักจริง และซ่อมจริง',
  'เพราะผมเชื่อว่า ถ้าจะให้ใครไว้ใจฝากรถของเขาไว้กับเรา เราต้องรักรถแบบเดียวกับเขาก่อน',
]

const TRUST: string[] = [
  'ประสบการณ์จริงจากการใช้และบูรณะ W140',
  'อะไหล่ W140 / W124 / W202 / W210 และ Mercedes-Benz คลาสสิก',
  'ให้ความสำคัญกับความซื่อสัตย์และความอุ่นใจ',
  'ลูกค้าจากไทย ลาว และกัมพูชาไว้วางใจ',
  'คติ: ซื่อกินไม่หมด คดกินไม่นาน',
]

export default function AboutPage() {
  return (
    <>
      {/* (1) HERO */}
      <section className="bg-[#1C1D2C] text-[#F2EDE0]">
        <div className="container mx-auto px-4 max-w-4xl py-16 md:py-20 text-center">
          <p className="text-[10px] md:text-xs tracking-[0.32em] text-[#C9A961] font-serif mb-5">
            เรื่องราวของ CHUTIBENZ
          </p>
          <h1 className="text-2xl md:text-4xl font-serif font-medium leading-snug">
            จากความเจ็บของคนซื้อ W140 คันแรก
            <br className="hidden md:block" />
            <span className="text-[#C9A961]"> สู่คลังอะไหล่ Mercedes-Benz คลาสสิก</span>
            <br className="hidden md:block" />
            ที่ตั้งใจให้ลูกค้าซื้ออย่างอุ่นใจ
          </h1>
        </div>
      </section>

      {/* (1.5) TRUST BOX สั้น — สรุปก่อนเข้าเรื่องยาว (ลอยทับขอบ hero) */}
      <section className="container mx-auto px-4 max-w-3xl relative z-10 -mt-7 md:-mt-9">
        <div className="bg-white border border-[#C9A961]/40 shadow-sm rounded-xl px-5 py-4 md:px-8 md:py-5 text-center">
          <p className="text-gray-800 text-[15px] md:text-base leading-relaxed">
            <span className="font-semibold text-gray-900">ChutiBenz</span> เกิดจากคนรัก W140 ที่เคยเจ็บกับอะไหล่และการซ่อมจริง
            เราจึงให้ความสำคัญกับ<span className="font-medium text-[#8B7355]">ข้อมูลที่ชัดเจน</span>และ
            <span className="font-medium text-[#8B7355]">ความอุ่นใจของลูกค้า</span>
          </p>
        </div>
      </section>

      {/* (2) FOUNDER STORY */}
      <section className="container mx-auto px-4 max-w-3xl pt-10 md:pt-12 pb-14 md:pb-16">
        <div className="space-y-5 text-[15px] md:text-base text-gray-700 leading-loose">
          {STORY.map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          {/* คั่นด้วยหัวข้อ "ความอุ่นใจ" */}
          <p className="pt-2 text-lg md:text-xl font-serif font-medium text-gray-900">
            แต่สิ่งที่ผมตั้งใจที่สุดคือเรื่อง “ความอุ่นใจ”
          </p>
          {STORY_2.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {/* คติ — เน้นแบบสุภาพ ไม่เป็นสโลแกนโต้ง */}
        <div className="mt-10 border-l-2 border-[#C9A961] pl-5 py-1">
          <p className="font-serif text-xl md:text-2xl text-gray-900">“ซื่อกินไม่หมด คดกินไม่นาน”</p>
          <p className="mt-3 text-gray-700 leading-relaxed">
            ผมไม่ได้อยากขายให้ได้เยอะที่สุด แต่อยากขายของที่ผมกล้ารับประกัน
            ให้กับคนที่สบายใจพอจะกลับมาหาผมอีก
          </p>
          <p className="mt-3 text-gray-700">นั่นคือเหตุผลที่ ChutiBenz มีอยู่ครับ</p>
        </div>
      </section>

      {/* (3) TRUST POINTS */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 max-w-4xl py-12 md:py-14">
          <h2 className="text-center text-2xl font-serif font-medium text-gray-900 mb-8">ทำไมลูกค้าถึงไว้วางใจ</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {TRUST.map((t, i) => (
              <div key={i} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4">
                <span className="text-[#C9A961] text-lg font-serif leading-none mt-0.5">✓</span>
                <span className="text-gray-800 text-[15px] leading-relaxed">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — นุ่ม ไม่ขายแข็ง */}
      <section className="container mx-auto px-4 max-w-3xl py-14 text-center">
        <p className="text-gray-700 mb-6">ถ้าคุณกำลังตามหาอะไหล่ หรืออยากปรึกษาเรื่องรถคันโปรด ทักผมมาได้เลยครับ ยินดีคุยเสมอ</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={LINE_OA}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#06C755] hover:bg-[#05B04A] text-white font-medium rounded-lg px-7 py-3.5 transition"
          >
            ทักทาย / ปรึกษาทาง LINE
          </a>
          <Link
            href="/search"
            className="border border-[#C9A961] text-[#8B7355] hover:bg-[#C9A961]/10 font-medium rounded-lg px-7 py-3.5 transition"
          >
            ดูอะไหล่ทั้งหมด →
          </Link>
        </div>
      </section>
    </>
  )
}
