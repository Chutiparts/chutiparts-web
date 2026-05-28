// app/about/page.tsx — About ChutiBenz
import Link from 'next/link'
import { LINE_OA_URL, PHONE_TEL } from '@/lib/constants'

export const metadata = {
  title: 'เกี่ยวกับ ChutiBenz',
  description: 'ทีมงาน ChutiBenz — คลังอะไหล่ Mercedes-Benz มือสอง คุณภาพดี',
}

export default function AboutPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">เกี่ยวกับ ChutiBenz ⭐</h1>

      <section className="mb-8 prose prose-lg">
        <p>
          <strong>ChutiBenz</strong> (Mr.Chuti อะไหล่เบนซ์มือสอง) คือคลังอะไหล่ Mercedes-Benz รุ่นคลาสสิคที่เน้นคุณภาพ
          ความน่าเชื่อถือ และการให้คำแนะนำที่ตรงประเด็น
        </p>

        <p>
          เราเชี่ยวชาญรุ่น <strong>W124, W126, W140, W201, W202, W210</strong> — ครอบคลุมตั้งแต่ baby benz (190E)
          ไปจนถึง S-Class ตัวคลาสสิค
        </p>
      </section>

      <section className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
        <h2 className="text-2xl font-bold mb-4">🎯 พันธกิจ</h2>
        <ul className="space-y-3 text-gray-700">
          <li className="flex gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <strong>อะไหล่แท้ OEM 100%</strong>
              <p className="text-sm text-gray-600">ผ่านการตรวจสอบก่อนส่งทุกชิ้น</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <strong>ระบบส่งอาการรถ</strong>
              <p className="text-sm text-gray-600">ลูกค้าบอกรถมีอาการอะไร — ทีมช่วยแนะนำพร้อมอะไหล่ที่ตรงปัญหา</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-2xl">🤝</span>
            <div>
              <strong>เครือข่ายช่างพาร์ทเนอร์</strong>
              <p className="text-sm text-gray-600">แนะนำอู่ที่ผ่านการ verify จากเรา</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-2xl">⏱</span>
            <div>
              <strong>ตอบกลับใน 4 ชั่วโมง</strong>
              <p className="text-sm text-gray-600">ในเวลาทำการ 9:00-18:00</p>
            </div>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 p-6 text-center mb-8">
        <h2 className="text-2xl font-bold mb-3">เริ่มต้นได้เลย</h2>
        <p className="mb-4">ส่งอาการรถ — เราจะติดต่อกลับใน 4 ชั่วโมง</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/intake" className="rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-bold px-6 py-3">
            📋 ส่งอาการรถ
          </Link>
          <a href={LINE_OA_URL} target="_blank" rel="noopener noreferrer"
            className="rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3"
          >💬 LINE</a>
          <a href={PHONE_TEL} className="rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-3">📞 โทร</a>
        </div>
      </section>

      <section className="text-sm text-gray-500 text-center">
        <p>
          Mr.Chuti อะไหล่เบนซ์มือสอง · กรุงเทพมหานคร · ประเทศไทย
        </p>
      </section>
    </article>
  )
}
