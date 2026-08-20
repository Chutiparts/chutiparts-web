// app/intake/page.tsx — Multi-step intake form (Server Component shell)
import { Suspense } from 'react'
import IntakeFormClient from './IntakeFormClient'

export const metadata = {
  alternates: { canonical: 'https://chutibenz.com/intake' },
  title: 'ส่งอาการรถ — ChutiBenz',
  description: 'บอกอาการรถของคุณ ทีมจะตอบกลับใน 4 ชั่วโมง — เชี่ยวชาญ W124 W126 W140 W201 W202 W210',
}

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="container mx-auto max-w-2xl px-4 py-6 md:py-10">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📋 ส่งอาการรถ</h1>
          <p className="text-sm text-gray-600 mt-1">
            ทีม ChutiBenz จะตอบกลับใน 4 ชั่วโมง (เวลาทำการ 9:00-18:00)
          </p>
        </header>

        <section className="mb-8 space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            บริการ <strong>ส่งอาการรถ (Diagnose)</strong> ของ ChutiBenz ช่วยเจ้าของรถ Mercedes-Benz คลาสสิก
            (W124 · W126 · W140 · W201 · W202 · W210) ที่ยังไม่แน่ใจว่าอาการที่เจอเกิดจากอะไหล่ชิ้นไหน —
            เพียงบอกอาการที่พบ ทีมผู้เชี่ยวชาญ (โดย Mr.Chuti เจ้าของรถ V12) จะช่วยวิเคราะห์เบื้องต้น
            แนะนำอะไหล่ที่ควรตรวจ และเช็กสต็อกจริงให้
          </p>
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">ข้อมูลที่ควรเตรียม</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>รุ่นรถและปี (เช่น W140 ปี 1995)</li>
              <li>อาการที่พบ และเกิดตอนไหน (เช่น สตาร์ทติดยากตอนเช้า / มีเสียงตอนเลี้ยว)</li>
              <li>รูปถ่ายจุดที่สงสัย หรือรหัสอะไหล่เดิม (ถ้ามี)</li>
              <li>เบอร์โทรหรือ LINE สำหรับติดต่อกลับ</li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">ตัวอย่างเคส</h2>
            <p>
              &ldquo;รถ W210 ปี 1999 มีน้ำหยดใต้ท้องรถฝั่งคนขับ สงสัยหม้อน้ำหรือท่อ&rdquo; —
              ทีมช่วยวิเคราะห์และเช็กว่ามีหม้อน้ำ/ท่อยางในสต็อกไหม แล้วแจ้งราคาและวิธีสั่งกลับไป
            </p>
          </div>
        </section>

        <Suspense fallback={<div className="text-center py-12">กำลังโหลด…</div>}>
          <IntakeFormClient />
        </Suspense>
      </div>
    </div>
  )
}
