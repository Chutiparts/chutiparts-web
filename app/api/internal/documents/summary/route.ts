// app/api/internal/documents/summary/route.ts
// §4.2 — endpoint ให้ระบบอื่นดึงสรุปเอกสารไปโชว์ (read-only)
//
// ⚠️ Daily Brief ในแอปนี้ "ไม่ได้" เรียกผ่าน HTTP — มัน import getDocSummary() ตรง ๆ
//    (อยู่แอปเดียวกัน เรียกตรงเร็วกว่าและไม่ต้องเปิดช่องทาง auth เพิ่ม)
//    endpoint นี้มีไว้เผื่ออนาคตที่มีระบบนอกแอปมาดึง — ป้องกันด้วย secret header
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDocSummary } from '@/lib/docbrief-summary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const secret = process.env.DOCBRIEF_INTERNAL_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า DOCBRIEF_INTERNAL_SECRET' }, { status: 503 })
  }
  const provided = req.headers.get('x-internal-secret')
  if (provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } },
  )

  const summary = await getDocSummary(db)
  return NextResponse.json(summary, {
    headers: { 'cache-control': 'no-store' },
  })
}
