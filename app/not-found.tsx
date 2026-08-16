import Link from 'next/link'
import { LINE_OA_URL, PHONE } from '@/lib/constants'

const wrap: React.CSSProperties = { minHeight: '72vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 20px', fontFamily: 'system-ui, "Noto Sans Thai", sans-serif' }
const btn: React.CSSProperties = { display: 'inline-block', background: '#17301F', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 15, fontWeight: 700 }
const outline: React.CSSProperties = { display: 'inline-block', background: '#fff', color: '#17301F', textDecoration: 'none', border: '2px solid #17301F', borderRadius: 10, padding: '11px 20px', fontSize: 15, fontWeight: 700 }
const line: React.CSSProperties = { display: 'inline-block', background: '#06C755', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 15, fontWeight: 700 }

export default function NotFound() {
  return (
    <main style={wrap}>
      <div style={{ fontSize: 60 }}>🔍</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#17301F', margin: '14px 0 6px' }}>ไม่พบหน้านี้</h1>
      <p style={{ color: '#5f6b63', fontSize: 15, maxWidth: 440, lineHeight: 1.7 }}>ขออภัยครับ หน้าที่คุณหาไม่มีอยู่ หรืออาจถูกย้ายไปแล้ว — ลองค้นหาอะไหล่ที่ต้องการ หรือกลับหน้าแรกได้เลย</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/" style={btn}>🏠 หน้าแรก</Link>
        <Link href="/search" style={outline}>🔍 ค้นหาอะไหล่</Link>
        <a href={LINE_OA_URL} style={line}>💬 ทัก LINE</a>
      </div>
      <p style={{ color: '#9aa39c', fontSize: 13, marginTop: 20 }}>หรือโทร {PHONE}</p>
    </main>
  )
}
