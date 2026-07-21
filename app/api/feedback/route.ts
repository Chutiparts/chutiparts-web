// TARGET PATH: app/api/feedback/route.ts
// Phase 2 · บันทึก feedback ของเจ้าของต่อคำแนะนำใน Daily Brief → ตาราง brief_feedback (Gold Dataset)
// เรียกจากหน้า ops (same-origin) · additive ไม่แตะโค้ดเดิม · เขียนเฉพาะตาราง log ไม่แตะข้อมูลธุรกิจ
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FEEDBACK = ['correct', 'not_important', 'remind_again', 'mute']
const s = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(req: NextRequest) {
  // กัน spam
  const ip = clientIp(req)
  if (!(await rateLimit(`feedback:${ip}`, 60, 60))) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  // guard เบา ๆ (ถ้าตั้ง env OPS_FEEDBACK_KEY ไว้ → ต้องส่ง header x-ops-key ให้ตรง · ถ้าไม่ตั้ง = เปิดใช้ได้เลย)
  const need = process.env.OPS_FEEDBACK_KEY
  if (need && req.headers.get('x-ops-key') !== need) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ ok: false, error: 'server_misconfig' }, { status: 500 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }) }

  const feedback = s(body?.feedback, 30)
  if (!FEEDBACK.includes(feedback)) {
    return NextResponse.json({ ok: false, error: 'bad_feedback', allow: FEEDBACK }, { status: 400 })
  }
  const module_ = s(body?.module, 60) || 'daily-brief'

  const row = {
    business: s(body?.business, 60) || 'chutibenz',
    user_ref: s(body?.user_ref, 80) || null,
    module: module_,
    item_key: s(body?.item_key, 80) || null,
    brief_item: s(body?.brief_item, 300) || null,
    ai_recommendation: s(body?.ai_recommendation, 500) || null,
    input_context: body?.input_context && typeof body.input_context === 'object' ? body.input_context : {},
    feedback,
    note: s(body?.note, 300) || null,
  }

  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } })
  const { error } = await supa.from('brief_feedback').insert(row)
  if (error) {
    console.error('[feedback] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
