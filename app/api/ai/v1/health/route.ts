// TARGET PATH: app/api/ai/v1/health/route.ts
// Health check — verifies env / db / kill switch. ไม่แตะข้อมูลธุรกิจ.
// ⚠️ ต้อง token เหมือน endpoint อื่น (ไม่ public — กันเปิดเผยว่า AI Tool Layer เปิดอยู่)
import { NextResponse, type NextRequest } from 'next/server'
import { checkAuth, noStore } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // checkAuth บังคับ: kill switch (503) → token env (500) → Bearer ถูก/ผิด (401)
  const auth = checkAuth(req)
  if (!auth.ok) return auth.res

  const hasDb = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
  const status = hasDb ? 'ok' : 'misconfig'
  return NextResponse.json(
    { v: 1, enabled: true, status, checks: { token: true, db: hasDb } },
    { status: hasDb ? 200 : 500, headers: noStore },
  )
}
