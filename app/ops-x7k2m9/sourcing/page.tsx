// app/ops-x7k2m9/sourcing/page.tsx
// Sourcing Helper (internal) — server auth gate (ops_admin, ร่วมกับหน้า ops อื่น) + render client
// อยู่ใต้ app/ops-x7k2m9/layout.tsx → ได้ sidebar OpsShell อัตโนมัติ
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import SourcingClient from './SourcingClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sourcing Helper', robots: { index: false, follow: false } }

const COOKIE = 'ops_admin'

async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  const c = await cookies() // fail-closed
  if (secret && c.get(COOKIE)?.value === secret) return true
  const team = process.env.TEAM_OPS_SECRET
  return !!team && c.get('ops_team')?.value === team
}

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('password') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  const team = process.env.TEAM_OPS_SECRET
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/ops-x7k2m9', maxAge: 60 * 60 * 24 * 30 }
  if (secret && pw === secret) {
    ;(await cookies()).set(COOKIE, secret, opts)
    ;(await cookies()).delete('ops_team')
  } else if (team && pw === team) {
    ;(await cookies()).set('ops_team', team, opts)
    ;(await cookies()).delete(COOKIE)
  }
  revalidatePath('/ops-x7k2m9/sourcing')
}

export default async function Page() {
  if (!(await authed())) {
    const hasSecret = !!process.env.ADMIN_OPS_SECRET
    return (
      <div className="min-h-screen bg-[#0B0C14] text-[#E7E3D8] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <p className="text-[10px] tracking-[0.34em] text-[#C9A961] mb-2">PRIVATE · SOURCING</p>
          <h1 className="text-2xl font-serif font-medium mb-1">เครื่องมือหาของฝั่งใน</h1>
          <p className="text-sm text-[#B8B3A7] mb-6">ใส่รหัสแอดมินเพื่อเข้าใช้งาน</p>
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
              ⚠️ ยังไม่ได้ตั้ง env <code className="bg-white/10 px-1 rounded">ADMIN_OPS_SECRET</code> ใน Vercel — ระบบล็อกไว้ (fail-closed)
            </p>
          )}
        </div>
      </div>
    )
  }
  return <SourcingClient />
}
