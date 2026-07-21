// TARGET PATH: app/api/ai/v1/leads/follow/route.ts
// list_leads_to_follow — ลูกค้าที่ต้องตาม (open) · READ-ONLY · customer contact MASKED (contact_masked)
// Phase 2: handleAiRead (weight 2) + cache/snapshot fallback
import { type NextRequest } from 'next/server'
import { handleAiRead, norm, daysSince, contactMasked } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const leadOpen = (l: any) => !['won', 'lost'].includes(norm(l.status))

export async function GET(req: NextRequest) {
  return handleAiRead(req, {
    tool: 'leads/follow',
    keyParams: ['max_age'],
    fetch: async (supa, sp) => {
      const maxAge = Number(sp.get('max_age') || 0) || 0 // 0 = ไม่กรอง

      const { data, error } = await supa.from('contact_leads').select('*').order('created_at', { ascending: false }).limit(1000)
      if (error) throw new Error('query_failed')

      const rows = (data || []).filter(leadOpen)
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

      return { data: { count: filtered.length, leads: filtered }, resultCount: filtered.length }
    },
  })
}
