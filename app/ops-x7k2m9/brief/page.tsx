// app/ops-x7k2m9/brief/page.tsx
// OpsBrief Private — server auth gate + login (dark) + render dashboard
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import OpsBriefClient from './OpsBriefClient'
import { loadData } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'OpsBrief Private', robots: { index: false, follow: false } }

const COOKIE = 'ops_admin'

async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false // fail-closed
  return (await cookies()).get(COOKIE)?.value === secret
}

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('password') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    ;(await cookies()).set(COOKIE, secret, { httpOnly: true, secure: true, sameSite: 'lax', path: '/ops-x7k2m9', maxAge: 60 * 60 * 24 * 30 })
  }
  revalidatePath('/ops-x7k2m9/brief')
}

export default async function Page() {
  if (!(await authed())) {
    const hasSecret = !!process.env.ADMIN_OPS_SECRET
    return (
      <div className="min-h-screen bg-[#0B0C14] text-[#E7E3D8] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <p className="text-[10px] tracking-[0.34em] text-[#C9A961] mb-2">PRIVATE · COMMAND ROOM</p>
          <h1 className="text-2xl font-serif font-medium mb-1">OpsBrief</h1>
          <p className="text-sm text-[#B8B3A7] mb-6">ใส่รหัสแอดมินเพื่อเข้าศูนย์คุมงานภายใน</p>
          <form action={loginOps} className="space-y-3">
            <input
              type="password"
              name="password"
              placeholder="Admin secret"
              autoComplete="current-password"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#6b6f80] focus:border-[#C9A961] focus:outline-none"
            />
            <button type="submit" className="w-full bg-[#C9A961] hover:bg-[#D8B872] text-[#1C1D2C] text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
              เข้าสู่ระบบ
            </button>
          </form>
          {!hasSecret && (
            <p className="text-[11px] text-red-400 mt-4 leading-relaxed">
              ⚠️ ยังไม่ได้ตั้ง env <code className="bg-white/10 px-1 rounded">ADMIN_OPS_SECRET</code> ใน Vercel — ระบบล็อกไว้ (fail-closed) ตั้งค่าก่อนจึงเข้าใช้งานได้
            </p>
          )}
        </div>
      </div>
    )
  }

  const data = await loadData()
  return <OpsBriefClient initialItems={data.items || []} initialDecisions={data.decisions || []} />
}
