// TARGET PATH: app/api/ai/v1/parts/search/route.ts
// search_parts — ค้นหาอะไหล่จากคลังจริง (Path B: คงเหลือ = stock_records.qty − นับ sales_records ตาม sku)
// READ-ONLY · ไม่คืน PII · ไม่เดา part number (ไม่พบ = ให้ทีมเช็ก)
import { NextResponse, type NextRequest } from 'next/server'
import { aiSupa, checkAuth, audit, noStore } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) return auth.res

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().slice(0, 80)
  const model = (searchParams.get('model') || '').trim().slice(0, 40).toUpperCase()

  const supa = aiSupa()
  if (!supa) return NextResponse.json({ v: 1, error: 'server_misconfig' }, { status: 500 })

  const [stockRes, salesRes] = await Promise.all([
    supa.from('stock_records').select('*').limit(5000),
    supa.from('sales_records').select('sku').limit(20000),
  ])
  if (stockRes.error) return NextResponse.json({ v: 1, error: 'query_failed' }, { status: 500 })

  const soldBySku: Record<string, number> = {}
  ;(salesRes.data || []).forEach((r: any) => {
    const k = String(r.sku || '').trim().toUpperCase()
    if (k) soldBySku[k] = (soldBySku[k] || 0) + 1
  })

  const qLower = q.toLowerCase()
  let rows = (stockRes.data || []).filter((s: any) => s.qty != null && !isNaN(Number(s.qty)))
  if (model) rows = rows.filter((s: any) => String(s.car_model || '').toUpperCase().includes(model))
  if (qLower) {
    rows = rows.filter(
      (s: any) =>
        String(s.part_name || '').toLowerCase().includes(qLower) ||
        String(s.sku || '').toLowerCase().includes(qLower) ||
        String(s.car_model || '').toLowerCase().includes(qLower),
    )
  }

  const results = rows.slice(0, 50).map((s: any) => {
    const received = Number(s.qty)
    const sold = soldBySku[String(s.sku || '').trim().toUpperCase()] || 0
    const available = received - sold
    return {
      sku: s.sku || null,
      name: s.part_name || null,
      model: s.car_model || null,
      qty_available: available,
      status: available > 0 ? 'in_stock' : 'out_of_stock',
      price: s.set_price != null ? Number(s.set_price) : null,
      location: s.location || null,
      has_photo: !!s.has_image,
    }
  })

  await audit(supa, auth.tid, 'search_parts', { q, model }, results.length)

  return NextResponse.json(
    {
      v: 1,
      query: q || null,
      model: model || null,
      count: results.length,
      results,
      note: 'ไม่พบ = ไม่เดารหัส · ให้ทีมเช็ก',
    },
    { headers: noStore },
  )
}
