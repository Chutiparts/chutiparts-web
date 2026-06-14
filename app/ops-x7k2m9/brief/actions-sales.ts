'use server'
// app/ops-x7k2m9/brief/actions-sales.ts
// Phase B — อ่าน ebook leads + orders จริง + overlay สถานะติดตาม (ops_sales_status)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const COOKIE = 'ops_admin'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}
async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false
  return (await cookies()).get(COOKIE)?.value === secret
}

const STATUSES = ['new', 'contacted', 'waiting_payment', 'paid', 'file_sent', 'follow_up']
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

export type SalesData = {
  ok: boolean
  error?: string
  leads?: any[]
  orders?: any[]
  revenue?: { paidCount: number; total: number }
}

async function fetchSales(): Promise<SalesData> {
  const supa = svc()
  const [leadsR, ordersR, statusR] = await Promise.all([
    supa.from('contact_leads').select('id,created_at,name,phone,line_id,detail,source').eq('topic', 'ebook').order('created_at', { ascending: false }).limit(60),
    supa.from('orders').select('id,created_at,customer_name,customer_contact,items,subtotal,status').order('created_at', { ascending: false }).limit(60),
    supa.from('ops_sales_status').select('*'),
  ])
  if (leadsR.error || ordersR.error || statusR.error) return { ok: false, error: 'fetch_failed' }

  const smap = new Map<string, any>()
  for (const s of statusR.data ?? []) smap.set(`${s.ref_type}:${s.ref_id}`, s)

  const leads = (leadsR.data ?? []).map((l) => {
    const st = smap.get(`lead:${l.id}`)
    return {
      ref_type: 'lead', ref_id: String(l.id),
      title: l.name || '(ไม่ระบุชื่อ)',
      contact: l.line_id || l.phone || '-',
      detail: l.detail || '',
      created_at: l.created_at,
      status: st?.status || 'new',
      amount: st?.amount ?? null,
      note: st?.note ?? null,
    }
  })

  const orders = (ordersR.data ?? []).map((o) => {
    const st = smap.get(`order:${o.id}`)
    const items = Array.isArray(o.items) ? o.items : []
    const summary = items.map((it: any) => `${it.name || it.code || '?'}${it.qty ? ` x${it.qty}` : ''}`).join(', ')
    return {
      ref_type: 'order', ref_id: String(o.id),
      title: o.customer_name || `#${String(o.id).slice(0, 8).toUpperCase()}`,
      contact: o.customer_contact || '-',
      detail: summary,
      subtotal: o.subtotal ?? 0,
      order_status: o.status,
      created_at: o.created_at,
      status: st?.status || 'new',
      amount: st?.amount ?? o.subtotal ?? null,
      note: st?.note ?? null,
    }
  })

  // รายได้ eBook เบื้องต้น = ผลรวม amount ของ lead ที่ paid/file_sent
  const paid = leads.filter((l) => l.status === 'paid' || l.status === 'file_sent')
  const total = paid.reduce((s, l) => s + (Number(l.amount) || 0), 0)

  return { ok: true, leads, orders, revenue: { paidCount: paid.length, total } }
}

export async function loadSales(): Promise<SalesData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  return fetchSales()
}

export async function setSaleStatus(input: { ref_type: string; ref_id: string; status: string; amount?: number | string | null; note?: string }): Promise<SalesData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  if (!['lead', 'order'].includes(input.ref_type)) return { ok: false, error: 'bad_ref' }
  if (!STATUSES.includes(input.status)) return { ok: false, error: 'bad_status' }
  const amtNum = input.amount == null || input.amount === '' ? null : Math.trunc(Number(input.amount))
  const row = {
    ref_type: input.ref_type,
    ref_id: String(input.ref_id),
    status: input.status,
    amount: amtNum != null && !isNaN(amtNum) ? amtNum : null,
    note: clip(input.note, 500) || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await svc().from('ops_sales_status').upsert(row, { onConflict: 'ref_type,ref_id' })
  if (error) return { ok: false, error: 'save_failed' }
  return fetchSales()
}
