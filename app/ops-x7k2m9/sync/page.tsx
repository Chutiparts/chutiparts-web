// app/ops-x7k2m9/sync/page.tsx — Sheet → Supabase Sync (ทาง C: products catalog only)
// อ่าน products (read-only) มาให้ client ทำ diff · เขียนเฉพาะตอน owner กดยืนยัน ผ่าน server action
// SAFETY: owner-only auth · เขียนเฉพาะ products (ไม่แตะ stock_records/sales_records) · ไม่แตะ schema
//         ห้ามทับด้วยค่าว่าง (เขียนเฉพาะ field ที่มีค่าใน CSV) · new SKU = is_published:false (ซ่อนจากเว็บลูกค้า)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import SyncClient from './SyncClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/sync'

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

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    ;(await cookies()).set(COOKIE, secret, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  }
  revalidatePath(PATH)
}

type SyncRow = { id?: string | null; sku: string; name?: string | null; car_model?: string | null; price?: number | null; oem_number?: string | null }

// เขียนเฉพาะตอน owner กดยืนยัน · เขียนเฉพาะ field ที่มีค่า (ไม่ทับด้วยว่าง) · new = is_published:false
async function applyProductSync(rows: SyncRow[]): Promise<{ ok: boolean; added: number; updated: number; errors: { sku: string; msg: string }[]; batchId: string; at: string }> {
  'use server'
  const at = new Date().toISOString()
  const batchId = 'sync-' + at.replace(/[^0-9]/g, '').slice(0, 14)
  if (!(await authed())) return { ok: false, added: 0, updated: 0, errors: [{ sku: '-', msg: 'unauthorized' }], batchId, at }
  const db = svc()
  let added = 0, updated = 0
  const errors: { sku: string; msg: string }[] = []
  for (const r of Array.isArray(rows) ? rows : []) {
    const sku = String(r.sku || '').trim()
    if (!sku) { errors.push({ sku: '-', msg: 'SKU ว่าง (ข้าม)' }); continue }
    // เขียนเฉพาะ field ที่มีค่า (SAFETY#3: ไม่ทับด้วยว่าง)
    const set: Record<string, unknown> = {}
    if (r.name != null && String(r.name).trim() !== '') set.name = String(r.name).trim()
    if (r.car_model != null && String(r.car_model).trim() !== '') set.car_model = String(r.car_model).trim()
    if (r.price != null && !isNaN(Number(r.price))) set.price = Number(r.price)
    if (r.oem_number != null && String(r.oem_number).trim() !== '') set.oem_number = String(r.oem_number).trim()
    try {
      if (r.id) {
        set.updated_at = at
        const { error } = await db.from('products').update(set).eq('id', r.id)
        if (error) errors.push({ sku, msg: error.message }); else updated++
      } else {
        const { error } = await db.from('products').insert({ sku, is_published: false, ...set })
        if (error) errors.push({ sku, msg: error.message }); else added++
      }
    } catch (e: any) { errors.push({ sku, msg: String(e?.message || e) }) }
  }
  revalidatePath(PATH)
  return { ok: errors.length === 0, added, updated, errors, batchId, at }
}

export default async function SyncPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>Sheet Sync — Owner only</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  // อ่าน products อย่างเดียว (ให้ client ทำ diff เทียบ CSV) — ไม่แตะ stock/sales
  const res = await svc().from('products').select('id,sku,name,car_model,price,oem_number,is_published,image_url').limit(5000)
  return <SyncClient products={res.data || []} applyProductSync={applyProductSync} />
}
