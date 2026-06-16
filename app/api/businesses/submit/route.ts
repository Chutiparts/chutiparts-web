// app/api/businesses/submit/route.ts — รับฟอร์มอู่/ร้าน → คิวรออนุมัติ
// 2026-06-15: insert เข้า business_submissions (status='pending') · server-only (service key)
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const s = (v: any, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const arr = (v: any, max = 12) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, max) : [])

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }) }

  // honeypot — บอทกรอก = ทิ้งเงียบ (ตอบ ok กันเดา)
  if (s(body.website_hp)) return NextResponse.json({ ok: true, ref: 'ok' })

  const name = s(body.name, 150)
  const phone = s(body.phone, 50)
  const line_id = s(body.line_id, 100)
  if (!name) return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 })
  if (!phone && !line_id) return NextResponse.json({ ok: false, error: 'contact_required' }, { status: 400 })

  const type = ['garage', 'parts_shop', 'both'].includes(body.type) ? body.type : 'garage'

  const row = {
    status: 'pending',
    name,
    type,
    province: s(body.province, 60) || null,
    address: s(body.address, 400) || null,
    google_maps_url: s(body.google_maps_url, 500) || null,
    phone: phone || null,
    line_id: line_id || null,
    website: s(body.website, 300) || null,
    models_expertise: arr(body.models_expertise),
    services: arr(body.services),
    description: s(body.description, 1000) || null,
    submitter_note: s(body.submitter_note, 500) || null,
    source_ip: req.headers.get('x-forwarded-for')?.split(',')[0] || null,
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  const supa = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await supa.from('business_submissions').insert(row).select('id').single()
  if (error || !data) {
    console.error('[business_submit] insert failed:', error)
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
  }

  // (ออปชัน) แจ้งเตือน LINE Ops ว่ามีอู่ส่งเข้ามา — best-effort ไม่บล็อก
  // try { await notifyNewBusiness({ id: data.id, name, province: row.province }) } catch {}

  return NextResponse.json({ ok: true, ref: String(data.id).slice(0, 8).toUpperCase() })
}
