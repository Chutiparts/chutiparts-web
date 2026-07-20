// TARGET PATH: app/api/ai/v1/leads/follow/route.ts
// list_leads_to_follow — ลูกค้าที่ต้องตาม (open: ไม่ใช่ won/lost) · READ-ONLY
// customer contact (phone/email/line) MASKED by default — คืนแค่ contact_masked + ชื่อไว้ให้ตามงานได้
import { NextResponse, type NextRequest } from 'next/server'
import { aiSupa, checkAuth, audit, norm, daysSince, contactMasked, noStore } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const leadOpen = (l: any) => !['won', 'lost'].includes(norm(l.status))

export async function GET(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) return auth.res

  const { searchParams } = new URL(req.url)
  const maxAge = Number(searchParams.get('max_age') || 0) || 0 // 0 = ไม่กรอง

  const supa = aiSupa()
  if (!supa) return NextResponse.json({ v: 1, error: 'server_misconfig' }, { status: 500 })

  const { data, error } = await supa
    .from('contact_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) return NextResponse.json({ v: 1, error: 'query_failed' }, { status: 500 })

  let rows = (data || []).filter(leadOpen)
  const withAge = rows.map((l: any) => ({
    id: l.id ? String(l.id).slice(0, 8).toUpperCase() : null,
    name: l.name || null,
    car_model: l.car_model || null,
    part: l.part_number || null,
    status: norm(l.status) || 'new',
    owner: l.owner || null,
    no_owner: !l.owner,
    contact_masked: contactMasked(l), // ← ไม่มีเบอร์/อีเมล/LINE เต็ม
    age_days: daysSince(l.follow_due || l.last_activity_at || l.created_at),
    source: l.source || null,
  }))
  const filtered = maxAge > 0 ? withAge.filter((x) => x.age_days >= maxAge) : withAge
  filtered.sort((a, b) => b.age_days - a.age_days)

  await audit(supa, auth.tid, 'list_leads_to_follow', { max_age: maxAge }, filtered.length)

  return NextResponse.json({ v: 1, count: filtered.length, leads: filtered }, { headers: noStore })
}
