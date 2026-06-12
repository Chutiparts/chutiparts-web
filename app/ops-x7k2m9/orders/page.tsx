// app/ops-x7k2m9/orders/page.tsx
// admin: ดูออเดอร์ + ยืนยัน(ตัดสต็อก)/ยกเลิก — ป้องกันด้วย admin secret cookie (env ADMIN_OPS_SECRET)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const COOKIE = 'ops_admin'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

function authed(): boolean {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false
  return cookies().get(COOKIE)?.value === secret
}

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('password') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    cookies().set(COOKIE, secret, { httpOnly: true, secure: true, sameSite: 'lax', path: '/ops-x7k2m9', maxAge: 60 * 60 * 24 * 30 })
  }
  revalidatePath('/ops-x7k2m9/orders')
}

const baht = (n: number) => new Intl.NumberFormat('th-TH').format(n || 0)
const STATUS_TH: Record<string, string> = { pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', cancelled: 'ยกเลิก' }
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

// TODO(phase-next): ย้ายการตัดสต็อกเป็น Postgres RPC/transaction แบบ atomic
async function confirmOrder(formData: FormData) {
  'use server'
  if (!authed()) return
  const id = String(formData.get('id') || '')
  if (!id) return
  const supa = svc()
  const { data: order } = await supa.from('orders').select('id,status,items,stock_deducted').eq('id', id).single()
  if (!order) return
  if (order.status === 'pending' && !order.stock_deducted) {
    for (const it of (order.items as any[]) || []) {
      const pid = it?.id
      const qty = Math.max(0, Math.trunc(Number(it?.qty) || 0))
      if (pid == null || qty <= 0) continue
      const { data: prod } = await supa.from('products').select('stock').eq('id', pid).single()
      if (prod) {
        const newStock = Math.max(0, (Number(prod.stock) || 0) - qty)
        await supa.from('products').update({ stock: newStock }).eq('id', pid)
      }
    }
    await supa.from('orders').update({ status: 'confirmed', stock_deducted: true }).eq('id', id)
  }
  revalidatePath('/ops-x7k2m9/orders')
}

// NOTE(phase-next): การคืน/restore stock เมื่อยกเลิกออเดอร์ที่ confirmed แล้ว = เฟสถัดไป
async function cancelOrder(formData: FormData) {
  'use server'
  if (!authed()) return
  const id = String(formData.get('id') || '')
  if (!id) return
  const supa = svc()
  await supa.from('orders').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending')
  revalidatePath('/ops-x7k2m9/orders')
}

export default async function OrdersPage() {
  if (!authed()) {
    return (
      <section className="container mx-auto px-4 py-20 max-w-sm">
        <h1 className="text-xl font-serif font-medium text-gray-900 mb-1">Admin · Orders</h1>
        <p className="text-sm text-gray-500 mb-6">ใส่รหัสแอดมินเพื่อเข้าดูออเดอร์</p>
        <form action={loginOps} className="space-y-3">
          <input type="password" name="password" placeholder="Admin secret" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none" />
          <button type="submit" className="w-full bg-[#1C1D2C] text-white text-sm font-medium px-4 py-2.5 rounded">เข้าสู่ระบบ</button>
        </form>
        {!process.env.ADMIN_OPS_SECRET && (
          <p className="text-[11px] text-red-600 mt-4">ยังไม่ได้ตั้ง env ADMIN_OPS_SECRET — ตั้งใน Vercel ก่อนใช้งาน</p>
        )}
      </section>
    )
  }

  const supa = svc()
  const { data, error } = await supa.from('orders').select('*').order('created_at', { ascending: false }).limit(200)
  const orders = data ?? []
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const fmt = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
      <p className="text-[10px] tracking-[0.32em] text-[#8B7355] font-serif mb-1">ADMIN · ORDERS</p>
      <h1 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-1">ออเดอร์จากเว็บ</h1>
      <p className="text-sm text-gray-500 mb-8">รอยืนยัน <strong className="text-amber-700">{pendingCount}</strong> · ทั้งหมด {orders.length} · กดยืนยัน = ตัดสต็อกอัตโนมัติ (ครั้งเดียว)</p>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">ดึงข้อมูลไม่สำเร็จ</div>}

      {orders.length === 0 ? (
        <div className="border border-gray-200 bg-gray-50 p-10 text-center text-gray-400">ยังไม่มีออเดอร์</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="border border-gray-200 rounded-lg bg-white p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-900">#{String(o.id).slice(0, 8).toUpperCase()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_CLS[o.status] || ''}`}>{STATUS_TH[o.status] || o.status}</span>
                </div>
                <span className="text-xs text-gray-400">{fmt(o.created_at)}</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-0.5 mb-2">
                {(o.items as any[] || []).map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{it.name}{it.code ? ` (${it.code})` : ''} x {it.qty}</span>
                    <span className="text-gray-500">{it.price == null ? 'ขอใบเสนอราคา' : `฿${baht(it.price * it.qty)}`}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-gray-100 pt-2">
                <div className="text-gray-600">
                  ติดต่อ: <strong className="text-gray-900">{o.customer_contact || '-'}</strong>{o.customer_name ? ` · ${o.customer_name}` : ''}
                  {o.note ? <span className="block text-xs text-gray-500 mt-0.5">{o.note}</span> : null}
                </div>
                <div className="font-medium text-gray-900">รวม ฿{baht(o.subtotal)}{o.has_tbc ? ' +TBC' : ''}</div>
              </div>
              {o.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <form action={confirmOrder}>
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded">ยืนยัน + ตัดสต็อก</button>
                  </form>
                  <form action={cancelOrder}>
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded">ยกเลิก</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
