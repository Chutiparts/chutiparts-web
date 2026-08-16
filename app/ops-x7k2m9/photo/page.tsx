// app/ops-x7k2m9/photo/page.tsx — Phase 1: อัพรูปอะไหล่ขึ้นเว็บ (เก็บที่ R2)
// 2026-08-04 · login guard รายหน้า (cookie ops_admin) เหมือน risk-guard → ป้องกันตัวเอง ไม่ต้องรอ global auth gate
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import PhotoUploadClient from './PhotoUploadClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/photo'

// auth: owner(ops_admin) หรือ team(ops_team) — เหมือนหน้า sell · หน้านี้อยู่ใน TEAM_ALLOWED (middleware)
async function authed(): Promise<boolean> {
  const c = await cookies()
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && c.get(COOKIE)?.value === secret) return true
  const team = process.env.TEAM_OPS_SECRET
  return !!team && c.get('ops_team')?.value === team
}

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  const team = process.env.TEAM_OPS_SECRET
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }
  if (secret && pw === secret) { (await cookies()).set(COOKIE, secret, opts); (await cookies()).delete('ops_team') }
  else if (team && pw === team) { (await cookies()).set('ops_team', team, opts); (await cookies()).delete(COOKIE) }
  revalidatePath(PATH)
}

export default async function PhotoUploadPage({ searchParams }: { searchParams: Promise<{ sku?: string; flow?: string }> }) {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>อัพรูปอะไหล่</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  const sp = await searchParams
  return <PhotoUploadClient initialSku={(sp.sku ?? '').trim()} flow={sp.flow === '1'} />
}
