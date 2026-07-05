// app/ops-x7k2m9/settings/page.tsx — Control Panel (เปิด/ปิดฟีเจอร์เว็บ)
// pattern เดียวกับ ops เดิม: svc() + authed() (cookie ops_admin) + server action toggle
// เขียน site_settings ด้วย service_role · ไม่ต้อง deploy ใหม่ (flip แล้วเว็บอัปเดตเอง)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/settings'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}
async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false
  return (await cookies()).get(COOKIE)?.value === secret
}
async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    ;(await cookies()).set(COOKIE, secret, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  }
  revalidatePath(PATH)
}
async function toggleFlag(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const key = String(formData.get('key') || '')
  const current = String(formData.get('enabled') || '') === 'true'
  if (!key) return
  await svc().from('site_settings').update({ enabled: !current, updated_at: new Date().toISOString() }).eq('key', key)
  revalidatePath(PATH)
}

export default async function SettingsPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>Control Panel</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600 }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  const { data } = await svc().from('site_settings').select('*').order('sort')
  const flags = data || []

  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE4', fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif' }}>
      <div style={{ background: '#17301F', color: '#fff', padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Control Panel — สวิตช์ฟีเจอร์เว็บ</div>
        <div style={{ fontSize: 12, color: '#cbd8cf' }}>เปิด/ปิดได้ทันที ไม่ต้อง deploy ใหม่ · เว็บอัปเดตภายในไม่กี่วินาที</div>
      </div>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: 16 }}>
        {flags.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: 16, color: '#A32D2D', fontSize: 14 }}>
            ยังไม่มีข้อมูลใน site_settings — รัน SQL `01-site-settings.sql` ก่อนครับ
          </div>
        )}
        {flags.map((f: any) => (
          <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{f.label || f.key}</div>
              <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{f.key}</div>
            </div>
            <form action={toggleFlag}>
              <input type="hidden" name="key" value={f.key} />
              <input type="hidden" name="enabled" value={String(f.enabled)} />
              <button type="submit" style={{
                minWidth: 76, padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: f.enabled ? '#0F6E56' : '#D3D1C7', color: f.enabled ? '#fff' : '#5F5E5A',
              }}>{f.enabled ? 'ON' : 'OFF'}</button>
            </form>
          </div>
        ))}
        <p style={{ fontSize: 12, color: '#8a8a8a', marginTop: 14, lineHeight: 1.6 }}>
          กด ON/OFF เพื่อสลับ · ฟีเจอร์ที่ยังไม่ได้ wire เข้าโค้ด สวิตช์จะยังไม่มีผล (เพิ่มทีละอันตามที่ wire)
        </p>
      </div>
    </div>
  )
}
