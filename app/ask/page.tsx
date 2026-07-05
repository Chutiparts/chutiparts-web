// app/ask/page.tsx — AI Reception Desk (ฝากคำถามหาอะไหล่)
import type { Metadata } from 'next'
import PartsIntakeForm from '@/components/PartsIntakeForm'

export const metadata: Metadata = {
  title: 'ฝากคำถามหาอะไหล่ | ChutiBenz',
  description: 'ฝากคำถามหาอะไหล่ Mercedes-Benz แจ้งรุ่นรถ ชิ้นอะไหล่ที่ต้องการ และช่องทางติดต่อกลับ ทีมงานจะตรวจสอบและติดต่อกลับให้',
}

export default function AskPage() {
  return (
    <main style={{ background: '#F4EFE4', minHeight: '70vh', padding: '28px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <PartsIntakeForm />
        <p style={{ fontSize: 12, color: '#8a8a8a', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
          ทีมงานจะตรวจสอบสถานะและราคาให้ก่อนติดต่อกลับ · แบบฟอร์มนี้ไม่รับจอง/ชำระเงิน
        </p>
      </div>
    </main>
  )
}
