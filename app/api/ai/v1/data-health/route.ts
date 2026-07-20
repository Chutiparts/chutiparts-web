// TARGET PATH: app/api/ai/v1/data-health/route.ts
// get_data_health — สรุปสุขภาพข้อมูล · READ-ONLY · ไม่มี PII (คืนแต่ตัวเลขนับ)
import { NextResponse, type NextRequest } from 'next/server'
import { aiSupa, checkAuth, audit, norm, daysSince, noStore } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const leadOpen = (l: any) => !['won', 'lost'].includes(norm(l.status))
const taskOpen = (t: any) => !['done', 'cancelled'].includes(norm(t.status) || 'todo')

export async function GET(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) return auth.res

  const supa = aiSupa()
  if (!supa) return NextResponse.json({ v: 1, error: 'server_misconfig' }, { status: 500 })

  const [leadsRes, tasksRes, stockRes, salesRes] = await Promise.all([
    supa.from('contact_leads').select('*').limit(2000),
    supa.from('ops_tasks').select('*').limit(1000),
    supa.from('stock_records').select('*').limit(5000),
    supa.from('sales_records').select('*').limit(20000),
  ])

  const leads = (leadsRes.data || []).filter(leadOpen)
  const tasks = (tasksRes.data || []).filter(taskOpen)
  const stock = stockRes.data || []
  const sales = salesRes.data || []

  const soldBySku: Record<string, number> = {}
  sales.forEach((r: any) => {
    const k = String(r.sku || '').trim().toUpperCase()
    if (k) soldBySku[k] = (soldBySku[k] || 0) + 1
  })
  const sheetStock = stock
    .filter((s: any) => s.qty != null && !isNaN(Number(s.qty)))
    .map((s: any) => {
      const received = Number(s.qty)
      const sold = soldBySku[String(s.sku || '').trim().toUpperCase()] || 0
      return { qty: received - sold, cost: s.cost }
    })

  const health = {
    leads_open: leads.length,
    leads_no_followup: leads.filter((l: any) => !l.owner && !l.follow_due).length,
    tasks_open: tasks.length,
    tasks_stale_3d: tasks.filter((t: any) => daysSince(t.updated_at || t.created_at) > 3).length,
    cost_missing: sheetStock.filter((x) => x.qty > 0 && (x.cost == null || Number(x.cost) === 0)).length,
    out_of_stock_sku: sheetStock.filter((x) => x.qty <= 0).length,
  }

  await audit(supa, auth.tid, 'get_data_health', {}, 1)

  return NextResponse.json({ v: 1, generated_at: new Date().toISOString(), data_health: health }, { headers: noStore })
}
