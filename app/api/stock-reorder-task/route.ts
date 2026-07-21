// app/api/stock-reorder-task/route.ts — P2 #23 Stock Suggestion → สร้าง Task "หาของ/สั่งซื้อ" (owner-only)
// จาก suggestion (ขายดีใกล้หมด) → owner confirm → สร้าง ops_tasks 1 แถว (draft ที่คน confirm แล้ว) + audit
// SAFETY: owner-only (cookie ops_admin) · confirm เท่านั้นถึงเขียน · SKU ต้องมีจริง · dedup 14 วัน กันสร้างซ้ำ · ไม่แตะ stock/sales
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function isOwner(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false
  return (await cookies()).get('ops_admin')?.value === secret
}

export async function POST(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }
  const sku = String(body?.sku || '').trim()
  const part_name = String(body?.part_name || '').trim()
  const car_model = String(body?.car_model || '').trim()
  const reason = String(body?.reason || '').trim()
  const note = String(body?.note || '').trim()
  if (!sku) return NextResponse.json({ ok: false, error: 'missing sku' }, { status: 400 })

  const db = svc()

  // 1) SKU ต้องมีจริงใน stock_records
  const { data: st } = await db.from('stock_records').select('id').eq('sku', sku).limit(1)
  if (!st || !st.length) return NextResponse.json({ ok: false, error: 'sku_not_found' }, { status: 400 })

  // 2) dedup: เคยสร้าง task หาของของ SKU นี้ใน 14 วัน → ไม่สร้างซ้ำ
  const since = new Date(Date.now() - 14 * 86400000).toISOString()
  const { data: recent } = await db.from('stock_link_audit').select('id').eq('action', 'reorder_task').eq('sku', sku).gte('created_at', since).limit(1)
  if (recent && recent.length) return NextResponse.json({ ok: false, error: 'already_requested' }, { status: 409 })

  // 3) สร้าง task (draft ที่ owner confirm แล้ว)
  const title = `หาของ/สั่งซื้อ: ${part_name || sku}${car_model ? ` (${car_model})` : ''} [${sku}]`
  const description = reason || 'ควรหา/สั่งเพิ่ม (ขายดีใกล้หมด)'
  const { error } = await db.from('ops_tasks').insert({
    title,
    task_type: 'sourcing',
    status: 'todo',
    priority: 'medium',
    description,
    note: note || null,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // 4) audit (unified trail · sale_id เป็น marker เพราะไม่มี sale จริง)
  await db.from('stock_link_audit').insert({ sale_id: `reorder:${sku}`, sku, action: 'reorder_task' })

  return NextResponse.json({ ok: true, created: title })
}
