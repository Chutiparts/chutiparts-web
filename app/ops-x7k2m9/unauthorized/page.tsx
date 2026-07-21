// TARGET PATH: app/ops-x7k2m9/unauthorized/page.tsx
// หน้าแจ้งทีมงานเมื่อเปิด URL owner-only (middleware redirect มาที่นี่)
export const dynamic = 'force-dynamic'

export default function Unauthorized() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: 'center', background: '#fff', border: '1px solid #e7e3d8', borderRadius: 14, padding: '34px 28px' }}>
        <div style={{ fontSize: 42 }}>🔒</div>
        <h1 style={{ fontSize: 19, margin: '10px 0 8px', color: '#17301F' }}>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</h1>
        <p style={{ color: '#666', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          หากต้องการเข้าถึง กรุณาเข้าสู่ระบบด้วยรหัสเจ้าของ<br />
          <span style={{ fontSize: 12.5, color: '#999' }}>สำหรับทีมงาน: ใช้เพื่ออัปเดตงาน ลูกค้า และสต็อกเท่านั้น</span>
        </p>
        <a href="/ops-x7k2m9/parts-desk" style={{ display: 'inline-block', marginTop: 18, background: '#17301F', color: '#fff', padding: '10px 20px', borderRadius: 9, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>← กลับไปหน้างานของทีม</a>
      </div>
    </div>
  )
}
