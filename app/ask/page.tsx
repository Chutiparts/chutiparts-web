// app/ask/page.tsx — AI Reception Desk (ฝากคำถามหาอะไหล่) + ปุ่มคุยด่วน LINE/WhatsApp (prefill)
import type { Metadata } from 'next'
import PartsIntakeForm from '@/components/PartsIntakeForm'
import AskQuickContact from '@/components/AskQuickContact'

export const metadata: Metadata = {
  title: 'ฝากคำถามหาอะไหล่ | ChutiBenz',
  description: 'ฝากคำถามหาอะไหล่ Mercedes-Benz แจ้งรุ่นรถ ชิ้นอะไหล่ที่ต้องการ และช่องทางติดต่อกลับ ทีมงานจะตรวจสอบและติดต่อกลับให้',
}

export default function AskPage() {
  return (
    <main style={{ background: '#F4EFE4', minHeight: '70vh', padding: '28px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* คุยด่วน — ต่อสาย LINE/WhatsApp พร้อมคำถาม */}
        <div style={{ background: '#17301F', borderRadius: 14, padding: '18px 18px 20px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>คุยหาอะไหล่ด่วน 💬</div>
          <div style={{ color: '#cbd8cf', fontSize: 13, margin: '4px 0 14px' }}>กดแล้วแชตเปิดพร้อมคำถาม — พิมพ์รุ่น/อะไหล่แล้วส่งได้เลย</div>
          <AskQuickContact />
        </div>

        <div style={{ textAlign: 'center', color: '#8a8a8a', fontSize: 13, margin: '4px 0 14px' }}>— หรือฝากข้อมูลไว้ให้ทีมติดต่อกลับ —</div>

        <PartsIntakeForm />
        <p style={{ fontSize: 12, color: '#8a8a8a', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
          ทีมงานจะตรวจสอบสถานะและราคาให้ก่อนติดต่อกลับ · แบบฟอร์มนี้ไม่รับจอง/ชำระเงิน
        </p>
      </div>
    </main>
  )
}
