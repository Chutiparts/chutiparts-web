// app/api/leads/route.ts
// 2026-07-04: + rate-limit (5 ครั้ง / 10 นาที / IP) · honeypot+consent+validation เดิมคงไว้
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyNewLead } from '@/lib/notify-lead'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX = {
  name: 150, phone: 50, line: 100, email: 150, model: 60,
  part: 120, budget: 150, detail: 2000, callback: 120, referrer: 300,
}
const TOPICS = ['parts', 'ebook', 'cvd', 'property', 'general']
const SOURCES = ['facebook_page', 'facebook_group', 'instagram', 'google', 'qr', 'direct']

const s = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

export async function POST(req: NextRequest) {
  // rate-limit: 5 ครั้ง / 10 นาที / IP (กันสคริปต์ยิงถล่ม → LINE เด้งรัว)
  const ip = clientIp(req)
  if (!(await rateLimit(`leads:${ip}`, 5, 600))) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ ok: false, error: 'server_misconfig' }, { status: 500 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }) }

  // honeypot กันบอท
  if (typeof body?.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: false, error: 'spam_detected' }, { status: 400 })
  }

  // ต้องยินยอมก่อนเก็บข้อมูล
  if (body?.consent !== true) {
    return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400 })
  }

  // ต้องมีช่องทางติดต่ออย่างน้อย 1 (เบอร์ หรือ LINE)
  const phone = s(body?.phone, MAX.phone)
  const line_id = s(body?.line_id, MAX.line)
  if (!phone && !line_id) {
    return NextResponse.json({ ok: false, error: 'missing_contact' }, { status: 400 })
  }

  const topicRaw = s(body?.topic, 30)
  const topic = TOPICS.includes(topicRaw) ? topicRaw : 'general'
  const sourceRaw = s(body?.source, 40)
  const source = SOURCES.includes(sourceRaw) ? sourceRaw : 'direct'

  const row = {
    status: 'new',
    topic,
    name: s(body?.name, MAX.name) || null,
    phone: phone || null,
    line_id: line_id || null,
    email: s(body?.email, MAX.email) || null,
    car_model: s(body?.car_model, MAX.model) || null,
    part_number: s(body?.part_number, MAX.part) || null,
    budget: s(body?.budget, MAX.budget) || null,
    detail: s(body?.detail, MAX.detail) || null,
    callback_time: s(body?.callback_time, MAX.callback) || null,
    source,
    referrer: s(body?.referrer, MAX.referrer) || null,
    consent: true,
    contact_value: (line_id || phone) || null,     car_year: (() => { const n = parseInt(String(body?.car_year ?? ''), 10); return Number.isFinite(n) ? n : null })(),     part_wanted: s(body?.part_wanted, 120) || null,     photo_channel: s(body?.photo_channel, 40) || null,     priority: (body?.urgent === true || body?.priority === 'hot') ? 'hot' : null,     next_action: 'รอทีมตรวจสอบ',
  }

  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } })
  const { data, error } = await supa.from('contact_leads').insert(row).select('id').single()
  if (error || !data) {
    console.error('[leads] insert failed:', error)
    return NextResponse.json({ ok: false, error: 'lead_insert_failed' }, { status: 500 })
  }
  const ref = String(data.id).slice(0, 8).toUpperCase()

  // แจ้งเตือนแอดมินแบบ best-effort — insert สำเร็จแล้วเสมอ ห้ามทำให้ลูกค้า submit fail
  try {
    await notifyNewLead({
      id: data.id,
      name: row.name,
      phone: row.phone,
      line_id: row.line_id,
      email: row.email,
      topic,
      source,
      detail: row.detail,
    })
  } catch (e) {
    console.error('[leads] notify error:', (e as Error)?.message)
  }

  return NextResponse.json({ ok: true, id: data.id, ref, message: 'received' })
}
