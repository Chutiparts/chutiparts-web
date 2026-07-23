// components/OpsGate.tsx — หน้าจอใส่รหัสสำหรับหน้า ops ที่ยังไม่มีการล็อก
//
// ใช้ cookie 'ops_admin' ตัวเดียวกับ Ledger → ล็อกอินที่ไหนก็ใช้ได้ทุกหน้า
// secure cookie เฉพาะตอน production เท่านั้น (ไม่งั้นล็อกอินบน localhost ไม่ผ่าน)
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { OPS_COOKIE } from '@/lib/ops-auth'

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    ;(await cookies()).set(OPS_COOKIE, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  // ครอบทั้งกลุ่ม ops — เข้าหน้าไหนก็เห็นผลทันที
  revalidatePath('/ops-x7k2m9', 'layout')
}

export default function OpsGate({ title }: { title: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
      <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
        <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
        <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
      </form>
    </div>
  )
}
