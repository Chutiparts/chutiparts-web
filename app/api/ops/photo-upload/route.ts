// app/api/ops/photo-upload/route.ts — Phase 1 photo upload API (ChutiBenz)
// 2026-08-04 · v2: ใช้ select('*') อ่าน field แบบปลอดภัย (ตาราง products ไม่มีคอลัมน์ car_model — ใช้ compatible_models)
// GET  ?sku=  → lookup product (โชว์ชื่อ+รูปเดิมก่อนอัพ)
// POST multipart (sku + file) → อัพเข้า R2 → UPDATE products.image_url by part_number
// auth: cookie ops_admin == ADMIN_OPS_SECRET (เหมือน ops หน้าอื่น) · key R2 อยู่ server เท่านั้น
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { uploadToR2, r2Configured } from '@/lib/r2-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const COOKIE = 'ops_admin'
const strip = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '')

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

// auth: owner(ops_admin) หรือ team(ops_team)
async function authed(): Promise<boolean> {
  const c = await cookies()
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && c.get(COOKIE)?.value === secret) return true
  const team = process.env.TEAM_OPS_SECRET
  return !!team && c.get('ops_team')?.value === team
}

type ProductRow = Record<string, unknown> & { id: string; part_number: string | null }

// แปลง compatible_models (array/string) → ข้อความโชว์ผล
function modelText(p: ProductRow): string | null {
  const cm = p.compatible_models
  if (Array.isArray(cm)) return cm.length ? cm.join(', ') : null
  if (typeof cm === 'string' && cm.trim()) return cm.trim()
  if (typeof p.car_model === 'string' && p.car_model.trim()) return p.car_model.trim()
  return null
}

// หา product จาก SKU: exact part_number ก่อน · แล้ว norm · คืน record แรกที่เจอ (select('*') กัน column error)
async function findProduct(skuRaw: string): Promise<ProductRow | null> {
  const sku = skuRaw.trim()
  const norm = strip(sku)
  if (!norm) return null
  const db = svc()

  const byExact = await db.from('products').select('*').eq('part_number', sku).limit(1)
  if (byExact.data && byExact.data.length) return byExact.data[0] as ProductRow

  const byNorm = await db.from('products').select('*').eq('part_number_norm', norm).limit(1)
  if (byNorm.data && byNorm.data.length) return byNorm.data[0] as ProductRow

  // fallback สุดท้าย: ilike กันเว้นวรรค/ตัวพิมพ์ (เช่นพิมพ์ 140-026 แต่เก็บ 140-026 )
  const byLike = await db.from('products').select('*').ilike('part_number', sku).limit(1)
  if (byLike.data && byLike.data.length) return byLike.data[0] as ProductRow

  return null
}

export async function GET(request: NextRequest) {
  if (!(await authed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sku = request.nextUrl.searchParams.get('sku') || ''
  if (!sku.trim()) return NextResponse.json({ error: 'sku required' }, { status: 400 })
  const p = await findProduct(sku)
  if (!p) return NextResponse.json({ found: false })
  return NextResponse.json({
    found: true,
    part_number: p.part_number,
    name: (p.name as string) ?? null,
    car_model: modelText(p),
    image_url: (p.image_url as string) ?? null,
  })
}

export async function POST(request: NextRequest) {
  if (!(await authed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!r2Configured()) {
    return NextResponse.json({ error: 'R2 not configured (ตรวจ env R2_*)' }, { status: 500 })
  }

  try {
    const form = await request.formData()
    const sku = String(form.get('sku') || '').trim()
    const file = form.get('file') as File | null

    if (!sku) return NextResponse.json({ error: 'sku required' }, { status: 400 })
    if (!file || file.size === 0) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'ต้องเป็นไฟล์รูปภาพ' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'รูปใหญ่เกิน 15MB' }, { status: 400 })
    }

    // ต้องมี SKU จริงในระบบก่อน (กันรูปลอย)
    const product = await findProduct(sku)
    if (!product || !product.part_number) {
      return NextResponse.json({ error: `ไม่พบ SKU "${sku}" ในระบบ` }, { status: 404 })
    }

    // key คงที่ = {part_number}.jpg (อัพซ้ำ = ทับ) — client ย่อเป็น jpeg มาแล้ว
    const key = `${product.part_number}.jpg`
    const buffer = await file.arrayBuffer()
    const publicUrl = await uploadToR2(key, buffer, 'image/jpeg')

    // เขียนแค่ image_url — ไม่แตะ field อื่น
    const { error: upErr } = await svc()
      .from('products')
      .update({ image_url: publicUrl })
      .eq('id', product.id)

    if (upErr) {
      return NextResponse.json(
        { error: 'อัพรูปขึ้น R2 สำเร็จ แต่บันทึก image_url ไม่สำเร็จ', details: upErr.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, url: publicUrl, part_number: product.part_number })
  } catch (e) {
    return NextResponse.json(
      { error: 'server error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
