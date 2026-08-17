// app/api/ebook-download/route.ts — log การโหลด eBook (นับยอด ไม่ระบุตัวตน)
// เก็บลงตาราง events เดิม: event_name='ebook_download', event_data={ code, version }
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const code = typeof body?.code === 'string' ? body.code.slice(0, 32) : null
    const version = typeof body?.version === 'string' ? body.version.slice(0, 16) : 'LITE'
    if (!code) {
      return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 })
    }
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      { auth: { persistSession: false } },
    )
    await supabase.from('events').insert({
      event_name: 'ebook_download',
      event_data: { code, version },
    })
  } catch {
    // ไม่ให้ error กระทบ UX — log แบบ best-effort
  }
  return NextResponse.json({ ok: true })
}
