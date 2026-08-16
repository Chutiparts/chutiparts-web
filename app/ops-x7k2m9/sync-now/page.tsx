// app/ops-x7k2m9/sync-now/page.tsx — ปุ่ม Sync ขึ้นเว็บทันที (owner) → trigger /api/sync-stock ด้วย CRON_SECRET ฝั่ง server
// 2026-08-16 · auth owner-only เหมือน add-part · additive · ไม่แตะ cron/route เดิม · เรียก endpoint เดิมผ่าน Bearer
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import SyncNowClient from './SyncNowClient'
import type { SyncResult } from './types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/sync-now'

async function authed(): Promise<boolean> {
  const c = await cookies()
  const secret = process.env.ADMIN_OPS_SECRET
  return !!secret && c.get(COOKIE)?.value === secret
}

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }
  if (secret && pw === secret) (await cookies()).set(COOKIE, secret, opts)
  revalidatePath(PATH)
}

async function runSync(): Promise<SyncResult> {
  'use server'
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const secret = process.env.CRON_SECRET
  if (!secret) return { ok: false, error: 'no_cron_secret', message: 'ไม่พบ CRON_SECRET ใน env' }
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  const base = host ? `https://${host}` : 'https://chutibenz.com'
  try {
    const r = await fetch(`${base}/api/sync-stock`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    return (await r.json()) as SyncResult
  } catch (e) {
    return { ok: false, error: 'fetch_failed', message: e instanceof Error ? e.message : 'unknown' }
  }
}

export default async function SyncNowPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>Sync ขึ้นเว็บ</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านเจ้าของ</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }
  return <SyncNowClient runSync={runSync} />
}
