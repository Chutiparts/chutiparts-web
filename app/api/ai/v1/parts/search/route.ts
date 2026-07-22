// TARGET PATH: app/api/ai/v1/parts/search/route.ts
// search_parts — Path B (คงเหลือ = stock.qty − นับ sales ตาม sku) · READ-ONLY · ไม่คืน PII · ไม่เดารหัส
// Phase 2: ผ่าน handleAiRead = rate-limit(weight 2) + cache/snapshot + fallback (ไม่ล้ม/ไม่หมุน)
import { type NextRequest } from 'next/server'
import { handleAiRead } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleAiRead(req, {
    tool: 'parts/search',
    keyParams: ['q', 'model'],
    fetch: async (supa, sp) => {
      const q = (sp.get('q') || '').trim().slice(0, 80)
      const model = (sp.get('model') || '').trim().slice(0, 40).toUpperCase()

      const [stockRes, salesRes] = await Promise.all([
        supa.from('stock_records').select('*').limit(5000),
        supa.from('sales_records').select('sku').limit(20000),
      ])
      if (stockRes.error) throw new Error('query_failed')

      const soldBySku: Record<string, number> = {}
      ;(salesRes.data || []).forEach((r: any) => {
        const k = String(r.sku || '').trim().toUpperCase()
        if (k) soldBySku[k] = (soldBySku[k] || 0) + Number(r.qty || 1)
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

      return { data: { query: q || null, model: model || null, count: results.length, results, note: 'ไม่พบ = ไม่เดารหัส · ให้ทีมเช็ก' }, resultCount: results.length }
    },
  })
}
