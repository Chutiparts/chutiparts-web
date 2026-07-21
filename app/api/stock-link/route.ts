// app/api/stock-link/route.ts — P1 #22 Ledger → Stock Suggestion (ผูก SKU · owner-only)
// เขียนเฉพาะ sales_records.sku (ตัดสต็อกแบบ Path B: คงเหลือ = รับเข้า − ขายที่มี SKU) + audit ทุก action
// SAFETY: owner-only (cookie ops_admin) · ไม่ลด stock_records.qty ตรง ๆ (กันนับซ้ำ) · ไม่ทับ SKU เดิม · confirm เท่านั้นถึงเขียน
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
  // owner-only (team มี cookie ops_team → ไม่ผ่าน) — กันยิง API ตรงด้วย
  if (!(await isOwner())) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }
  const sale_id = String(body?.sale_id || '').trim()
  const action = String(body?.action || '').trim()
  const sku = body?.sku != null ? String(body.sku).trim() : ''
  if (!sale_id) return NextResponse.json({ ok: false, error: 'missing sale_id' }, { status: 400 })

  const db = svc()

  if (action === 'cancel') {
    // ข้าม draft นี้ — ไม่แก้ stock/sales · แค่ log ไว้ (audit ทุก action)
    await db.from('stock_link_audit').insert({ sale_id, sku: sku || null, action: 'cancel' })
    return NextResponse.json({ ok: true, dismissed: true })
  }

  if (action === 'confirm') {
    if (!sku) return NextResponse.json({ ok: false, error: 'missing sku' }, { status: 400 })
    // 1) SKU ต้องมีจริงใน stock_records (กันผูกมั่ว)
    const { data: st } = await db.from('stock_records').select('id').eq('sku', sku).limit(1)
    if (!st || !st.length) return NextResponse.json({ ok: false, error: 'sku_not_found' }, { status: 400 })
    // 2) sale ต้องมีจริง + ยังไม่เคยผูก SKU (กันทับของเดิม)
    const { data: sale } = await db.from('sales_records').select('id,sku').eq('id', sale_id).limit(1)
    if (!sale || !sale.length) return NextResponse.json({ ok: false, error: 'sale_not_found' }, { status: 404 })
    if (sale[0].sku && String(sale[0].sku).trim()) return NextResponse.json({ ok: false, error: 'already_linked' }, { status: 409 })
    // 3) เขียน sku → Path B ตัดสต็อกเอง
    const { error } = await db.from('sales_records').update({ sku }).eq('id', sale_id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    await db.from('stock_link_audit').insert({ sale_id, sku, action: 'confirm' })
    return NextResponse.json({ ok: true, linked: sku })
  }

  return NextResponse.json({ ok: false, error: 'bad_action' }, { status: 400 })
}
