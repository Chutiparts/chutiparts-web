// app/ops-x7k2m9/stock-in/page.tsx — สเต็ป "รับเข้าสต็อก + publish" ของ flow เพิ่มสินค้า (owner)
// 2026-08-16 · reuse pattern sanctioned: stock_records(qty:0) จาก confirmStockDocument + received movement จากปุ่ม Ledger
// ห้ามเขียน qty ตรง — บวกผ่าน stock_movements(received) → trigger คุม · publish = set is_published ตรง DB
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import StockInClient from './StockInClient'

export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/stock-in'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function authed(): Promise<boolean> {
  const c = await cookies()
  const secret = process.env.ADMIN_OPS_SECRET
  return !!secret && c.get(COOKIE)?.value === secret
}

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }
  if (secret && pw === secret) (await cookies()).set(COOKIE, secret, opts)
  revalidatePath(PATH)
}

export type ProductInfo = {
  found: boolean
  part_number?: string
  name?: string | null
  image_url?: string | null
  is_published?: boolean
  car_model?: string | null
  category?: string | null
  price?: number | null
  in_stock?: boolean // มี stock_records active แล้วไหม
}

const num = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').replace(/,/g, '').trim()
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim()
  return v === '' ? null : v
}

// ── รับเข้าชิ้นเดียว: หา/สร้าง stock_records → received movement (trigger บวก qty) ──
async function receiveOne(_prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  'use server'
  if (!(await authed())) return { ok: false, message: 'ต้องเข้าสู่ระบบ' }
  const sku = str(formData, 'sku')
  if (!sku) return { ok: false, message: 'ไม่พบ SKU' }
  const qty = num(formData, 'qty')
  if (qty == null || !Number.isInteger(qty) || qty <= 0) return { ok: false, message: 'จำนวนต้องเป็นเลขจำนวนเต็มมากกว่า 0' }
  const cost = num(formData, 'cost')
  const setPrice = num(formData, 'set_price')
  const location = str(formData, 'location')
  const db = svc()

  // product info (ชื่อ/รุ่น/หมวด) สำหรับกรณีสร้าง stock row ใหม่
  const { data: prod } = await db.from('products')
    .select('name, compatible_models, category, part_number')
    .eq('part_number', sku).limit(1).maybeSingle()

  // หา active stock_records ที่ SKU ตรง
  const { data: existing } = await db.from('stock_records')
    .select('id').eq('sku', sku).is('deleted_at', null)
  if ((existing?.length ?? 0) > 1) return { ok: false, message: `SKU "${sku}" มี stock หลายรายการ active — เลือกไม่ได้ ต้องแก้ให้เหลือรายการเดียวก่อน` }

  let targetId = existing?.[0]?.id as string | undefined
  if (!targetId) {
    const carModel = Array.isArray(prod?.compatible_models) ? (prod?.compatible_models[0] ?? null) : null
    const { data: rec, error } = await db.from('stock_records').insert({
      sku,
      part_name: prod?.name ?? sku,
      car_model: carModel,
      qty: 0, // on-hand มาจาก received movement (ห้ามเขียน qty ตรง)
      cost,
      set_price: setPrice,
      location,
      status: 'in_stock',
      has_image: false,
      source: 'รับเข้าเอง (flow เพิ่มสินค้า)',
      date_in: new Date().toISOString().slice(0, 10),
      note: prod?.category ? String(prod.category) : null,
    }).select('id').single()
    if (error || !rec) return { ok: false, message: `สร้าง stock ไม่สำเร็จ: ${error?.message ?? 'unknown'}` }
    targetId = rec.id as string
  }

  // received movement → trigger บวก qty (pattern เดียวกับปุ่มรับเข้าใน Ledger)
  const { error: mvErr } = await db.from('stock_movements').insert({
    stock_record_id: targetId, qty_change: qty, movement_type: 'received',
    actor: 'owner', note: 'รับเข้าเพิ่ม (flow เพิ่มสินค้า)',
  })
  if (mvErr) return { ok: false, message: `รับเข้าไม่สำเร็จ: ${mvErr.message}` }
  revalidatePath(PATH)
  return { ok: true, message: `รับเข้าสต็อก ${qty} ชิ้นแล้ว ✓ (SKU ${sku})` }
}

// ── publish: set is_published ตรง DB ──
async function publishOne(_prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  'use server'
  if (!(await authed())) return { ok: false, message: 'ต้องเข้าสู่ระบบ' }
  const sku = str(formData, 'sku')
  if (!sku) return { ok: false, message: 'ไม่พบ SKU' }
  const db = svc()
  const { error, count } = await db.from('products')
    .update({ is_published: true }, { count: 'exact' })
    .eq('part_number', sku)
  if (error) return { ok: false, message: `publish ไม่สำเร็จ: ${error.message}` }
  if (!count) return { ok: false, message: `ไม่พบสินค้า SKU "${sku}" ใน products (ยังไม่ได้เพิ่มสินค้า?)` }
  revalidatePath(PATH)
  return { ok: true, message: `ขึ้นเว็บแล้ว ✓ (SKU ${sku})` }
}

async function lookupProduct(sku: string): Promise<ProductInfo> {
  const db = svc()
  const { data: p } = await db.from('products')
    .select('part_number, name, image_url, is_published, compatible_models, category, price')
    .eq('part_number', sku).limit(1).maybeSingle()
  if (!p) return { found: false }
  const { data: st } = await db.from('stock_records').select('id').eq('sku', sku).is('deleted_at', null).limit(1)
  return {
    found: true,
    part_number: p.part_number as string,
    name: p.name as string | null,
    image_url: p.image_url as string | null,
    is_published: !!p.is_published,
    car_model: Array.isArray(p.compatible_models) ? (p.compatible_models[0] ?? null) : null,
    category: (p.category as string | null) ?? null,
    price: (p.price as number | null) ?? null,
    in_stock: (st?.length ?? 0) > 0,
  }
}

export default async function StockInPage({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>รับเข้าสต็อก + ขึ้นเว็บ</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านเจ้าของ</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }
  const sp = await searchParams
  const sku = (sp.sku ?? '').trim()
  const info = sku ? await lookupProduct(sku) : { found: false }
  return <StockInClient sku={sku} info={info} receiveOne={receiveOne} publishOne={publishOne} />
}
