'use client'
import Link from 'next/link'
import { LINE_OA_URL, PHONE } from '@/lib/constants'

const wrap: React.CSSProperties = { minHeight: '72vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 20px', fontFamily: 'system-ui, "Noto Sans Thai", sans-serif' }
const btn: React.CSSProperties = { display: 'inline-block', background: '#17301F', color: '#fff', textDecoration: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, padding: '12px 20px', fontSize: 15, fontWeight: 700 }
const outline: React.CSSProperties = { display: 'inline-block', background: '#fff', color: '#17301F', textDecoration: 'none', border: '2px solid #17301F', borderRadius: 10, padding: '11px 20px', fontSize: 15, fontWeight: 700 }
const line: React.CSSProperties = { display: 'inline-block', background: '#06C755', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 15, fontWeight: 700 }

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={wrap}>
      <div style={{ fontSize: 60 }}>🛠️</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#17301F', margin: '14px 0 6px' }}>ขออภัย มีบางอย่างขัดข้อง</h1>
      <p style={{ color: '#5f6b63', fontSize: 15, maxWidth: 440, lineHeight: 1.7 }}>ระบบเจอปัญหาชั่วคราว ลองใหม่อีกครั้งได้เลย ถ้ายังไม่หาย ทักหาทีมงาน ChutiBenz ได้ทาง LINE ครับ</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => reset()} style={btn}>🔄 ลองใหม่</button>
        <Link href="/" style={outline}>🏠 หน้าแรก</Link>
        <a href={LINE_OA_URL} style={line}>💬 ทัก LINE</a>
      </div>
      <p style={{ color: '#9aa39c', fontSize: 13, marginTop: 20 }}>หรือโทร {PHONE}</p>
    </main>
  )
}
