// app/ops-x7k2m9/add-part/page.tsx — เพิ่มสินค้าใหม่ (พนักงาน) → เขียน products อย่างเดียว
// 2026-08-04 · auth รายหน้าเหมือน /photo · additive · ไม่แตะ stock_records/ledger
// flow: เลือกรุ่น → ระบบ suggest SKU ถัดไป → กรอกชื่อ/ราคา → insert products (is_published:false) → ไป /photo
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import AddPartClient from './AddPartClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/add-part'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

function strip(s: string): string {
  return String(s || '').replace(/[^a-zA-Z0-9]/g, '')
}

async function authed(): Promise<boolean> {
  const c = await cookies()
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && c.get(COOKIE)?.value === secret) return true
  const team = process.env.TEAM_OPS_SECRET
  return !!team && c.get('ops_team')?.value === team
}

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  const team = process.env.TEAM_OPS_SECRET
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }
  if (secret && pw === secret) { (await cookies()).set(COOKIE, secret, opts); (await cookies()).delete('ops_team') }
  else if (team && pw === team) { (await cookies()).set('ops_team', team, opts); (await cookies()).delete(COOKIE) }
  revalidatePath(PATH)
}

// suggest SKU ถัดไปจาก prefix · เลขล้วน "140" → 140-031 (3 หลัก) · หมวด "140-AC" → 140-AC03 (2 หลัก)
async function nextSku(prefix: string): Promise<{ ok: boolean; sku: string }> {
  'use server'
  if (!(await authed())) return { ok: false, sku: '' }
  const pfx = String(prefix || '').trim().replace(/-+$/, '')
  if (!pfx) return { ok: false, sku: '' }
  const db = svc()
  const { data } = await db.from('products').select('part_number').ilike('part_number', pfx + '-%').limit(500)
  const rows = (data || []).map((r: any) => String(r.part_number || ''))
  const hasCat = pfx.includes('-')      // "140-AC" มี dash = หมวดอักษร · "140" ไม่มี = เลขรัน
  const width = hasCat ? 2 : 3
  let max = 0
  for (const r of rows) {
    let tail = ''
    if (hasCat) {
      if (r.toUpperCase().startsWith(pfx.toUpperCase())) tail = r.slice(pfx.length)
    } else {
      if (r.startsWith(pfx + '-')) tail = r.slice(pfx.length + 1)
    }
    if (/^[0-9]+$/.test(tail)) { const n = parseInt(tail, 10); if (n > max) max = n }
  }
  const next = String(max + 1).padStart(width, '0')
  const sku = hasCat ? pfx + next : pfx + '-' + next
  return { ok: true, sku }
}

// server action: เพิ่มสินค้าใหม่ → products (is_published:false) · กันซ้ำด้วย part_number_norm
async function addProduct(formData: FormData): Promise<{ ok: boolean; msg: string; sku?: string; exists?: boolean }> {
  'use server'
  if (!(await authed())) return { ok: false, msg: 'ไม่มีสิทธิ์' }

  const sku   = String(formData.get('sku') || '').trim()
  const name  = String(formData.get('name') || '').trim()
  const model = String(formData.get('model') || '').trim()
  const priceRaw = String(formData.get('price') || '').trim()
  const oem   = String(formData.get('oem') || '').trim()

  if (!sku)  return { ok: false, msg: 'กรุณาใส่ SKU (รหัสอะไหล่)' }
  if (!name) return { ok: false, msg: 'กรุณาใส่ชื่ออะไหล่' }
  const price = priceRaw !== '' && !isNaN(Number(priceRaw)) ? Number(priceRaw) : null
  if (priceRaw !== '' && price == null) return { ok: false, msg: 'ราคาต้องเป็นตัวเลข' }

  const db = svc()
  const norm = strip(sku)

  const { data: dup } = await db.from('products').select('id,part_number').eq('part_number_norm', norm).limit(1)
  if (dup && dup.length > 0) {
    return { ok: false, exists: true, sku, msg: `SKU "${sku}" มีอยู่แล้ว — ไปอัพรูปได้เลย` }
  }

  const modelSlug = model ? String(model).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const slug = modelSlug ? sku + '-' + modelSlug : sku
  const ins: Record<string, unknown> = {
    part_number: sku,
    name,
    slug,
    is_published: false,
  }
  if (model) ins.compatible_models = [model]
  if (price != null) ins.price = price
  if (oem)   { ins.oem_number = oem; ins.oem_number_norm = strip(oem) }

  const { error } = await db.from('products').insert(ins)
  if (error) return { ok: false, msg: 'บันทึกไม่สำเร็จ: ' + error.message }

  revalidatePath(PATH)
  return { ok: true, sku, msg: `เพิ่มสินค้า "${sku}" แล้ว ✓ (ยังไม่ขึ้นเว็บจนกว่าเจ้าของ publish)` }
}

export default async function AddPartPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>เพิ่มสินค้าใหม่</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }
  return <AddPartClient addProduct={addProduct} nextSku={nextSku} />
}
