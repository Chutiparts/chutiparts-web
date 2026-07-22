// TARGET PATH: app/api/ai/v1/daily-brief/route.ts
// get_daily_brief — SAFE SUMMARY · ไม่ refactor logic Daily Brief เดิม · customer contact masked
// Phase 2: handleAiRead (weight 3 · หนักสุด) + cache/snapshot fallback
import { type NextRequest } from 'next/server'
import { handleAiRead, norm, daysSince, contactMasked } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const leadOpen = (l: any) => !['won', 'lost'].includes(norm(l.status))
const taskOpen = (t: any) => !['done', 'cancelled'].includes(norm(t.status) || 'todo')

export async function GET(req: NextRequest) {
  return handleAiRead(req, {
    tool: 'daily-brief',
    keyParams: ['top'],
    fetch: async (supa, sp) => {
      const top = Math.min(Math.max(Number(sp.get('top') || 5) || 5, 1), 20)

      const [leadsRes, tasksRes, stockRes, salesRes] = await Promise.all([
        supa.from('contact_leads').select('*').order('created_at', { ascending: false }).limit(1000),
        supa.from('ops_tasks').select('*').order('created_at', { ascending: false }).limit(500),
        supa.from('stock_records').select('*').limit(5000),
        supa.from('sales_records').select('*').limit(20000),
      ])

      const leads = leadsRes.data || []
      const tasks = tasksRes.data || []
      const stock = stockRes.data || []
      const sales = salesRes.data || []

      const soldBySku: Record<string, number> = {}
      sales.forEach((r: any) => {
        const k = String(r.sku || '').trim().toUpperCase()
        if (k) soldBySku[k] = (soldBySku[k] || 0) + Number(r.qty || 1)
      })
      const sheetStock = stock
        .filter((s: any) => s.qty != null && !isNaN(Number(s.qty)))
        .map((s: any) => {
          const received = Number(s.qty)
          const sold = soldBySku[String(s.sku || '').trim().toUpperCase()] || 0
          return { sku: s.sku || '', name: s.part_name || '(ไม่ระบุ)', model: s.car_model || '', qty: received - sold }
        })

      const items: any[] = []
      leads.filter(leadOpen).forEach((l: any) => {
        const aging = daysSince(l.follow_due || l.last_activity_at || l.created_at)
        const noOwner = !l.owner
        items.push({
          type: 'lead',
          title: `ตามลูกค้า: ${l.name || '-'}`,
          detail: `${l.part_number || 'อะไหล่'} · ${l.car_model || '-'} · ค้าง ${aging} วัน`,
          action: 'โทร/ทักกลับ',
          owner: l.owner || null,
          contact_masked: contactMasked(l),
          score: 100 + aging + (noOwner ? 30 : 0),
        })
      })
      sheetStock.filter((x) => x.qty <= 0).forEach((x) => {
        items.push({ type: 'stock', title: `สต็อกหมด: ${x.name}`, detail: `${x.model} · SKU ${x.sku}`, action: 'หาเพิ่ม/ถ่ายรูป', owner: null, score: 200 })
      })
      tasks.filter(taskOpen).forEach((t: any) => {
        const overdue = t.due_date ? daysSince(t.due_date) : 0
        items.push({ type: 'task', title: t.title || '(งานไม่มีชื่อ)', detail: `${t.task_type || 'งาน'} · ${norm(t.status) || 'todo'}`, action: 'ทำ/อัปเดตงาน', owner: t.owner || null, score: 120 + Math.max(overdue, 0) })
      })

      items.sort((a, b) => b.score - a.score)
      const brief = items.slice(0, top).map(({ score, ...rest }) => rest)
      const fallback = brief.length === 0
        ? [{ type: 'ok', title: 'ไม่มีงานเร่งด่วนวันนี้', detail: 'leads/สต็อก/งาน อยู่ในเกณฑ์ปกติ', action: null, owner: null }]
        : null

      const ym = new Date().toISOString().slice(0, 7)
      const monthSales = sales.filter((r: any) => String(r.sale_date || '').slice(0, 7) === ym)
      const revenue = monthSales.reduce((s: number, r: any) => s + (Number(r.sale_price) || 0), 0)
      const profit = monthSales.reduce((s: number, r: any) => s + ((Number(r.sale_price) || 0) - (Number(r.cost) || 0)), 0)

      return {
        data: {
          top: fallback || brief,
          summary_this_month: { sales_count: monthSales.length, revenue, profit, out_of_stock_sku: sheetStock.filter((x) => x.qty <= 0).length },
        },
        resultCount: brief.length,
      }
    },
  })
}
