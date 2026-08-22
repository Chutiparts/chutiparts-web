// app/feed/facebook/route.ts — Facebook/Meta Commerce product feed (RSS 2.0 · g: namespace)
// ให้ Commerce Manager ดึง URL นี้ (chutibenz.com/feed/facebook) + ตั้ง refresh อัตโนมัติรายวัน
// ทุกชิ้น link กลับ /products/[slug] → checkout on our website (ไทยยัง checkout บน FB ไม่ได้)
// เงื่อนไข FB: ต้องมีรูป + ราคา > 0 → call-for-price (price<=0) ตัดออก (FB ไม่รับ ฿0)
//
// ?debug=1 → คืน JSON สรุปว่าตัดอะไรออกไปเพราะอะไร (ไม่ให้ Commerce Manager ดู URL นี้)
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE = 'https://chutibenz.com'

// Meta Commerce Policy — ชิ้นส่วนความปลอดภัยที่ห้ามลงขาย ต้องกรองออกจากฟีดเสมอ
// (ไม่ใช่แค่ที่มีตอนนี้ — กันสินค้าที่จะเพิ่มเข้ามาทีหลังหลุดเข้าฟีดเงียบ ๆ)
const BANNED_RE =
  /ถุงลม|แอร์แบ็ก|แอร์แบ็ค|เข็มขัดนิรภัย|ดึงกลับเข็มขัด|air\s*bag|airbag|seat\s*belt|seatbelt|pretension|\bsrs\b/i

// ─────────────────────────────────────────────────────────────────────────────
// กันรูปที่ Meta ไม่รับ — ตรวจด้วยตาทีละรูปครบทั้ง 38 เมื่อ 2026-08-22
//
// Meta catalog ห้ามรูปมีข้อความโปรโมชัน/ลายน้ำ/เบอร์ติดต่อฝังบนรูป การส่งไปทั้งชุด
// เสี่ยงโดนปฏิเสธทั้ง catalog ไม่ใช่แค่ตัวที่ผิด จึงเปิดร้านด้วยเฉพาะรูปที่สะอาดก่อน
//
// 🔑 วิธีปลดรายการออกจากลิสต์นี้: ถ่าย/ครอปรูปใหม่ให้ไม่มีตัวอักษร → อัปเดต
//    products.image_url → ลบบรรทัดของ SKU นั้นทิ้ง → สินค้าจะกลับเข้าฟีดรอบ fetch ถัดไป
//    เช็กได้ว่าตอนนี้ตัดอะไรอยู่บ้างที่ /feed/facebook?debug=1
const EXCLUDED: Record<string, string> = {
  // ลายน้ำเบอร์โทร/LINE ฝังบนรูป (21 รายการ)
  // ลายน้ำหลายรูปยังโฆษณา LINE id ที่ตายแล้ว (mr.chuti5988 / chuti5988 — ของจริงคือ @440ifncj)
  // และบางรูปมีเบอร์ 081-234-5988 ซึ่งไม่ใช่เบอร์ร้าน (เบอร์ร้าน = 081-828-5855)
  '124-002': 'ลายน้ำบนรูป',
  '124-008': 'ลายน้ำบนรูป',
  '124-009': 'ลายน้ำบนรูป',
  '124-026': 'ลายน้ำบนรูป',
  '124-HL01': 'ลายน้ำบนรูป + โลโก้ HELLA เต็มเฟรม',
  '140-005': 'ลายน้ำบนรูป',
  '140-010': 'ลายน้ำบนรูป',
  '140-025': 'ลายน้ำบนรูป',
  '140-027': 'ลายน้ำบนรูป',
  '140-028': 'ลายน้ำบนรูป',
  '140-029': 'ลายน้ำบนรูป',
  '140-030': 'ลายน้ำบนรูป',
  '140-031': 'ลายน้ำบนรูป',
  '140-033': 'ลายน้ำบนรูป',
  '140-AC01': 'ลายน้ำบนรูป',
  '140-AC02': 'ลายน้ำบนรูป',
  '140-HID01': 'ลายน้ำบนรูป',
  '202-010': 'ลายน้ำบนรูป',
  '202-012': 'ลายน้ำบนรูป',
  '202-014': 'ลายน้ำบนรูป',
  '220-001': 'ลายน้ำบนรูป',
  // image_url ชี้รูปคนละชิ้นกับสินค้า — ขายผิดของ ไม่ใช่แค่ผิดนโยบาย
  '124-003': 'image_url เป็นรูปกระจกมองข้าง แต่สินค้าคือไฟหน้า W124 ขวา (รูปที่ถูกอยู่ใน image_urls แล้ว)',
  '140-026': 'image_url เป็นรูปเบาะหนัง แต่สินค้าคือปั๊มสุญญากาศกลาง ล็อกประตู W140',
  // รูป webp ชื่อ s-l1600* = แพตเทิร์นชื่อไฟล์ของ eBay (ตัดสินใจกันออก 2026-08-22)
  // สองเหตุผลอิสระ ต้องผ่านทั้งคู่ถึงจะเอากลับเข้าฟีดได้:
  //   1) สเปก Meta ระบุ JPEG/PNG — webp เสี่ยงถูกปฏิเสธ
  //   2) ที่มาของรูปไม่ชัด เสี่ยงลิขสิทธิ์ (รูปคนอื่นบน eBay)
  // ทางแก้: ถ่าย JPEG เอง → อัปเดต products.image_url → ลบ 2 บรรทัดนี้ทิ้ง
  '140-004': 'รูปเป็น s-l1600 (1).webp — webp + ที่มาน่าจะเป็น eBay ยังไม่ยืนยันสิทธิ์',
  '140-006': 'รูปเป็น s-l1600.webp — webp + ที่มาน่าจะเป็น eBay ยังไม่ยืนยันสิทธิ์',
}

// ─────────────────────────────────────────────────────────────────────────────

// รหัสหมวดในเว็บ → หมวดที่คนอ่านรู้เรื่อง (ใช้เป็น product_type ในฟีด)
const CAT_GROUP: Record<string, string> = {
  LGT: 'ไฟส่องสว่าง',
  ELC: 'ระบบไฟฟ้า / ECU',
  BDY: 'ตัวถังและภายนอก',
  BRK: 'เบรค',
  MIR: 'กระจกมองข้าง / มองหลัง',
  WHL: 'ล้อและยาง',
  AIR: 'ระบบแอร์',
  VAC: 'ระบบสุญญากาศ / ไฮดรอลิก',
  ENG: 'เครื่องยนต์',
  TRN: 'เกียร์',
  SUS: 'ช่วงล่าง',
}
const CAT_EN: Record<string, string> = {
  interior: 'ภายในห้องโดยสาร',
  body: 'ตัวถังและภายนอก',
  engine: 'เครื่องยนต์',
  electrical: 'ระบบไฟฟ้า / ECU',
}

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

/** category ในเว็บมี 3 แบบปนกัน: "LGT-01 ไฟหน้า" · "interior" · null → ทำให้อ่านออกเป็นไทยเสมอ */
function productType(category: string, model: string): string {
  const c = category.trim()
  if (!c) return model ? `อะไหล่ ${model}` : 'อะไหล่ Mercedes-Benz'
  const code = /^([A-Z]{3})-\d{2}\b/.exec(c)
  if (code) {
    const group = CAT_GROUP[code[1]]
    const leaf = c.replace(/^[A-Z]{3}-\d{2}\s*/, '').trim()
    return group && leaf ? `${group} > ${leaf}` : (group || leaf || c)
  }
  return CAT_EN[c.toLowerCase()] || c
}

/** condition ในเว็บ ('new' | 'used-good' | 'oem' | 'aftermarket' | null) → enum ของ Meta */
function metaCondition(raw: string): 'new' | 'refurbished' | 'used' {
  const c = raw.trim().toLowerCase()
  if (c === 'new' || c === 'nos' || c === 'new-old-stock') return 'new'
  if (c === 'refurbished' || c === 'reconditioned' || c === 'rebuilt') return 'refurbished'
  return 'used' // ค่า default ปลอดภัยที่สุด — อะไหล่มือสองห้ามติด new เด็ดขาด
}

// ─────────────────────────────────────────────────────────────────────────────
// สคีม SKU ของ "อะไหล่แต่ง" (ตกลงกัน 2026-08-22) — {แบรนด์3ตัว}-{ลำดับ3หลัก}
//   AMG-001  BRB-001 (Brabus)  LOR-001 (Lorinser)  VIC-001 (Victor)
// ของแต่งมักใส่ได้หลายรุ่น จึงไม่ผูกรุ่นรถไว้ใน SKU (ต่างจากอะไหล่ปกติ 140-004)
// เลข OEM ของเบนซ์ห้ามเอามาใส่ช่อง part_number — ที่ของมันคือ oem_number แล้วจะไปโผล่เป็น <g:mpn>
const TUNER_BRANDS: Record<string, string> = {
  AMG: 'AMG',
  BRB: 'Brabus',
  LOR: 'Lorinser',
  VIC: 'Victor',
  CAR: 'Carlsson',
  REN: 'Renntech',
}

/** แบรนด์แต่งของชิ้นนี้ (ถ้ามี) → custom_label_2 ใช้ทำคอลเลกชัน "ของแต่ง" ใน Commerce Manager */
function tunerBrand(pn: string, name: string): string {
  const pre = /^([A-Z]{3})-/.exec(pn.toUpperCase())
  if (pre && TUNER_BRANDS[pre[1]]) return TUNER_BRANDS[pre[1]]
  // สินค้าที่ยังไม่ได้ย้ายมาสคีมใหม่ — เดาจากชื่อไว้ก่อน ไม่ให้หลุดคอลเลกชัน
  const m = /\b(AMG|Brabus|Lorinser|Carlsson|Renntech)\b/i.exec(name)
  return m ? (TUNER_BRANDS[m[1].slice(0, 3).toUpperCase()] || m[1]) : ''
}

type Row = {
  part_number: string | null
  name: string | null
  price: number | null
  image_url: string | null
  image_urls: string[] | null
  slug: string | null
  compatible_models: string[] | null
  category: string | null
  condition: string | null
  description: string | null
  oem_number: string | null
  warranty_days: number | null
}

export async function GET(req: Request) {
  const db = svc()
  const debug = new URL(req.url).searchParams.get('debug') === '1'

  const { data: products } = await db
    .from('products')
    // ต้องเป็น string literal ตัวเดียว — Supabase อ่าน type จากตัวอักษรในนี้ ถ้าต่อสตริงจะ infer พัง
    .select('part_number, name, price, image_url, image_urls, slug, compatible_models, category, condition, description, oem_number, warranty_days')
    .eq('is_published', true)
    .not('image_url', 'is', null)
    .gt('price', 0)
    .limit(5000)

  // availability + quantity จาก stock_records (แหล่งจริงของ on-hand)
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
  const dropped: Array<{ id: string; reason: string }> = []

  for (const p of (products || []) as Row[]) {
    const pn = String(p.part_number || '').trim()
    const name = String(p.name || '').trim()
    const img = String(p.image_url || '').trim()
    const slug = String(p.slug || '').trim()
    const price = Number(p.price) || 0
    if (!pn || !name || !img || !slug || price <= 0) {
      dropped.push({ id: pn || slug || '(ไม่มี id)', reason: 'ฟิลด์บังคับไม่ครบ' })
      continue
    }

    // Meta Commerce Policy: ชิ้นส่วนความปลอดภัยห้ามขาย
    if (BANNED_RE.test(name) || BANNED_RE.test(String(p.category || ''))) {
      dropped.push({ id: pn, reason: 'ชิ้นส่วนความปลอดภัยต้องห้ามตาม Meta Commerce Policy' })
      continue
    }

    // รูปไม่ผ่านเกณฑ์ Meta (ลายน้ำ / รูปไม่ตรงสินค้า) — ดูรายละเอียดที่ EXCLUDED ด้านบน
    if (EXCLUDED[pn]) {
      dropped.push({ id: pn, reason: EXCLUDED[pn] })
      continue
    }

    const tuner = tunerBrand(pn, name)
    const models = Array.isArray(p.compatible_models) ? p.compatible_models.filter(Boolean) : []
    const model = models.length ? String(models[0]) : ''
    const link = `${SITE}/products/${encodeURIComponent(slug)}`
    const qty = qtyBySku.get(pn) || 0
    const warranty = Number(p.warranty_days) || 15

    // description: ใช้ของจริงจากหน้าสินค้าก่อนเสมอ (ระบุสภาพ/ตำหนิตามจริง) แล้วค่อยต่อท้ายด้วยเงื่อนไขร้าน
    const own = String(p.description || '').replace(/\s+/g, ' ').trim()
    const tail = `อะไหล่แท้ Mercedes-Benz คลาสสิก · รับประกัน ${warranty} วัน · ส่งทั่วไทย`
    const desc = (own ? `${own} — ${tail}` : `${name}${model ? ` (${model})` : ''} — ${tail}`).slice(0, 4900)

    // รูปเพิ่ม: image_urls ที่ไม่ซ้ำกับรูปหลัก (Meta รับได้สูงสุด 20)
    const extra = (Array.isArray(p.image_urls) ? p.image_urls : [])
      .map((u) => String(u || '').trim())
      .filter((u) => u && u !== img)
      .slice(0, 20)

    items.push(
      '    <item>\n' +
      `      <g:id>${esc(pn)}</g:id>\n` +
      `      <g:title>${esc(name)}</g:title>\n` +
      `      <g:description>${esc(desc)}</g:description>\n` +
      `      <g:link>${esc(link)}</g:link>\n` +
      `      <g:image_link>${esc(img)}</g:image_link>\n` +
      extra.map((u) => `      <g:additional_image_link>${esc(u)}</g:additional_image_link>\n`).join('') +
      `      <g:availability>${qty > 0 ? 'in stock' : 'out of stock'}</g:availability>\n` +
      `      <g:quantity_to_sell_on_facebook>${Math.max(0, qty)}</g:quantity_to_sell_on_facebook>\n` +
      `      <g:condition>${metaCondition(String(p.condition || ''))}</g:condition>\n` +
      `      <g:price>${price.toFixed(2)} THB</g:price>\n` +
      '      <g:brand>Mercedes-Benz</g:brand>\n' +
      `      <g:mpn>${esc(p.oem_number || pn)}</g:mpn>\n` +
      `      <g:product_type>${esc(productType(String(p.category || ''), model))}</g:product_type>\n` +
      '      <g:google_product_category>Vehicles &amp; Parts &gt; Vehicle Parts &amp; Accessories</g:google_product_category>\n' +
      (model ? `      <g:custom_label_0>${esc(model)}</g:custom_label_0>\n` : '') +
      (models.length > 1 ? `      <g:custom_label_1>${esc(models.join(' '))}</g:custom_label_1>\n` : '') +
      (tuner ? `      <g:custom_label_2>${esc(tuner)}</g:custom_label_2>\n` : '') +
      '    </item>',
    )
  }

  if (debug) {
    return Response.json(
      { total: (products || []).length, in_feed: items.length, dropped },
      { headers: { 'Cache-Control': 'no-store' } },
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
