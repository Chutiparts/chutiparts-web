// app/intake/page.tsx — Multi-step intake form (Server Component shell)
import { Suspense } from 'react'
import IntakeFormClient from './IntakeFormClient'

export const metadata = {
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

        <Suspense fallback={<div className="text-center py-12">กำลังโหลด…</div>}>
          <IntakeFormClient />
        </Suspense>
      </div>
    </div>
  )
}
