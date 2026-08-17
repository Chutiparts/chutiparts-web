// app/feed/facebook/route.ts — Facebook/Meta Commerce product feed (RSS 2.0 · g: namespace)
// ให้ Commerce Manager ดึง URL นี้ (chutibenz.com/feed/facebook) + ตั้ง refresh อัตโนมัติ
// ทุกชิ้น link กลับ /products/[slug] → checkout on our website (ตรงกับโมเดล LINE/เว็บ)
// เงื่อนไข FB: ต้องมีรูป + ราคา > 0 → call-for-price (price<=0) ตัดออก (FB ไม่รับ ฿0)
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE = 'https://chutibenz.com'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export async function GET() {
  const db = svc()

  const { data: products } = await db
    .from('products')
    .select('part_number, name, price, image_url, slug, compatible_models')
    .eq('is_published', true)
    .not('image_url', 'is', null)
    .gt('price', 0)
    .limit(5000)

  // availability จาก stock_records (แหล่งจริงของ on-hand)
  const { data: stocks } = await db
    .from('stock_records')
    .select('sku, qty')
    .is('deleted_at', null)
  const qtyBySku = new Map<string, number>()
  for (const s of stocks || []) {
    const k = String((s as { sku: string }).sku || '')
    qtyBySku.set(k, (qtyBySku.get(k) || 0) + (Number((s as { qty: number }).qty) || 0))
  }

  const items: string[] = []
  for (const p of products || []) {
    const pn = String((p as { part_number: string }).part_number || '').trim()
    const name = String((p as { name: string }).name || '').trim()
    const img = String((p as { image_url: string }).image_url || '').trim()
    const slug = String((p as { slug: string }).slug || '').trim()
    const price = Number((p as { price: number }).price) || 0
    if (!pn || !name || !img || !slug || price <= 0) continue
    const models = (p as { compatible_models: string[] | null }).compatible_models
    const model = Array.isArray(models) && models.length ? String(models[0]) : ''
    const link = `${SITE}/products/${encodeURIComponent(slug)}`
    const inStock = (qtyBySku.get(pn) || 0) > 0
    const desc = `${name}${model ? ` (${model})` : ''} — อะไหล่แท้ Mercedes-Benz คลาสสิก · รับประกัน 15 วัน · ส่งทั่วไทย`

    items.push(
      '    <item>\n' +
      `      <g:id>${esc(pn)}</g:id>\n` +
      `      <g:title>${esc(name)}</g:title>\n` +
      `      <g:description>${esc(desc)}</g:description>\n` +
      `      <g:link>${esc(link)}</g:link>\n` +
      `      <g:image_link>${esc(img)}</g:image_link>\n` +
      `      <g:availability>${inStock ? 'in stock' : 'out of stock'}</g:availability>\n` +
      '      <g:condition>used</g:condition>\n' +
      `      <g:price>${price.toFixed(2)} THB</g:price>\n` +
      '      <g:brand>Mercedes-Benz</g:brand>\n' +
      (pn ? `      <g:mpn>${esc(pn)}</g:mpn>\n` : '') +
      (model ? `      <g:product_type>${esc(model)}</g:product_type>\n` : '') +
      '    </item>'
    )
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
    '  <channel>\n' +
    '    <title>ChutiBenz — อะไหล่แท้ Mercedes-Benz คลาสสิก</title>\n' +
    `    <link>${SITE}</link>\n` +
    '    <description>อะไหล่เมอร์เซเดส-เบนซ์มือสอง OEM แท้ · W124 W126 W140 W201 W202 W210 W220</description>\n' +
    items.join('\n') + '\n' +
    '  </channel>\n' +
    '</rss>\n'

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
