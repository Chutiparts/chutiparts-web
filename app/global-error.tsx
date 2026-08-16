'use client'
// global-error.tsx — fallback สุดท้ายเมื่อ root layout ล่ม (ต้องมี html/body เอง)
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 20px', fontFamily: 'system-ui, "Noto Sans Thai", sans-serif', background: '#fff' }}>
        <div style={{ fontSize: 60 }}>🛠️</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#17301F', margin: '14px 0 6px' }}>ขออภัย ระบบขัดข้องชั่วคราว</h1>
        <p style={{ color: '#5f6b63', fontSize: 15, maxWidth: 420, lineHeight: 1.7 }}>กรุณาลองใหม่อีกครั้ง — ChutiBenz อะไหล่เบนซ์มือสอง OEM แท้</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button onClick={() => reset()} style={{ background: '#17301F', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 10, padding: '12px 22px', fontSize: 15, fontWeight: 700 }}>🔄 ลองใหม่</button>
          <a href="/" style={{ background: '#fff', color: '#17301F', textDecoration: 'none', border: '2px solid #17301F', borderRadius: 10, padding: '11px 22px', fontSize: 15, fontWeight: 700 }}>🏠 หน้าแรก</a>
        </div>
      </body>
    </html>
  )
}
