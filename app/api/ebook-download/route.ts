// app/api/ebook-download/route.ts — log การโหลด eBook (นับยอด ไม่ระบุตัวตน)
// เก็บลงตาราง events เดิม: event_name='ebook_download', event_data={ code, version }
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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
    const supabase = await createClient()
    await supabase.from('events').insert({
      event_name: 'ebook_download',
      event_data: { code, version },
    })
  } catch {
    // ไม่ให้ error กระทบ UX — log แบบ best-effort
  }
  return NextResponse.json({ ok: true })
}
