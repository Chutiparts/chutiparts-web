// app/ops-x7k2m9/sync/page.tsx — Sheet → Supabase Sync (ทาง C: products catalog only)
// อ่าน products (read-only) มาให้ client ทำ diff · เขียนเฉพาะตอน owner กดยืนยัน ผ่าน server action
// KEY = part_number (เว็บ search/แสดงด้วย part_number · รหัสร้าน 140-001 อยู่ช่องนี้) · sheet SKU → part_number
// SAFETY: owner-only · เขียนเฉพาะ products (ไม่แตะ stock/sales/schema) · ห้ามทับด้วยว่าง
//         อัปเดตของเดิม = แตะแค่ name/car_model/price/oem_number (ไม่ clobber field อื่น) · new = is_published:false
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

type SyncRow = { id?: string | null; part_number: string; name?: string | null; car_model?: string | null; price?: number | null; oem_number?: string | null }
const strip = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '')

// เขียนเฉพาะตอน owner กดยืนยัน · ไม่ทับด้วยว่าง · อัปเดต = minimal · new = is_published:false + set norm/compatible_models
async function applyProductSync(rows: SyncRow[]): Promise<{ ok: boolean; added: number; updated: number; errors: { pn: string; msg: string }[]; batchId: string; at: string }> {
  'use server'
  const at = new Date().toISOString()
  const batchId = 'sync-' + at.replace(/[^0-9]/g, '').slice(0, 14)
  if (!(await authed())) return { ok: false, added: 0, updated: 0, errors: [{ pn: '-', msg: 'unauthorized' }], batchId, at }
  const db = svc()
  let added = 0, updated = 0
  const errors: { pn: string; msg: string }[] = []
  for (const r of Array.isArray(rows) ? rows : []) {
    const pn = String(r.part_number || '').trim()
    if (!pn) { errors.push({ pn: '-', msg: 'part_number ว่าง (ข้าม)' }); continue }
    const name = r.name != null && String(r.name).trim() !== '' ? String(r.name).trim() : null
    const model = r.car_model != null && String(r.car_model).trim() !== '' ? String(r.car_model).trim() : null
    const price = r.price != null && !isNaN(Number(r.price)) ? Number(r.price) : null
    const oem = r.oem_number != null && String(r.oem_number).trim() !== '' ? String(r.oem_number).trim() : null
    try {
      if (r.id) {
        // อัปเดต minimal — เขียนเฉพาะ field ที่มีค่า (ไม่ทับด้วยว่าง · ไม่แตะ compatible_models/category/is_published เดิม)
        const set: Record<string, unknown> = { updated_at: at }
        if (name) set.name = name
        if (model) set.compatible_models = [model]
        if (price != null) set.price = price
        if (oem) { set.oem_number = oem; set.oem_number_norm = strip(oem) }
        const { error } = await db.from('products').update(set).eq('id', r.id)
        if (error) errors.push({ pn, msg: error.message }); else updated++
      } else {
        const ins: Record<string, unknown> = { part_number: pn, part_number_norm: strip(pn), is_published: false }
        if (name) ins.name = name
        if (model) ins.compatible_models = [model]
        if (price != null) ins.price = price
        if (oem) { ins.oem_number = oem; ins.oem_number_norm = strip(oem) }
        const { error } = await db.from('products').insert(ins)
        if (error) errors.push({ pn, msg: error.message }); else added++
      }
    } catch (e: any) { errors.push({ pn, msg: String(e?.message || e) }) }
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

  // อ่าน products อย่างเดียว (ให้ client ทำ diff เทียบ CSV ด้วย part_number) — ไม่แตะ stock/sales
  const res = await svc().from('products').select('*').limit(5000)
  return <SyncClient products={res.data || []} applyProductSync={applyProductSync} />
}
