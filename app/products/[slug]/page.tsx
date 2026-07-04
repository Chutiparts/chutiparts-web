// app/products/[slug]/page.tsx — Product Detail Page (หน้าขายจริง)
// Phase 2 (2026-06-15): เติมเฉพาะจุดจาก Phase 1 — ไม่รื้อโครงเดิม
//   (A) OG/Twitter image รองรับ image_urls (สินค้าแกลเลอรี) + twitter card ชัด
//   (B) ข้อความ "กรุณาสอบถามสถานะสินค้าก่อนตัดสินใจ" เด่นเหนือปุ่มติดต่อ
//   (C) Trust strip 4 ช่อง: ตรวจสภาพ · สอบถามสถานะ · จัดส่ง/นัดรับ · ติดต่อเร็ว
// defensive ต่อ field ใหม่ (image_urls, engine_codes, oem_verified, warranty_days, fitment_note, side)
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import AddToCartButton from '../../components/AddToCartButton'
import L from '@/components/L'
const SITE_URL = 'https://chutibenz.com'
const LINE_OA = 'https://line.me/R/ti/p/%40440ifncj'

// ดึงสินค้าจาก slug (รองรับ slug ไทย + fallback ด้วย code นำหน้าแบบ ASCII)
async function getProductBySlug(slug: string) {
  const supabase = await createClient()
  let product: any = null
  {
    const { data } = await supabase
      .from('products').select('*')
      .eq('slug', slug).eq('is_published', true).limit(1)
    product = data?.[0] ?? null
  }
  if (!product) {
    const codeMatch = slug.match(/^(\d+-\d+)/)
    if (codeMatch) {
      const { data } = await supabase
        .from('products').select('*')
        .ilike('slug', `${codeMatch[1]}-%`).eq('is_published', true).limit(1)
      product = data?.[0] ?? null
    }
  }
  return product
}

// helper: รวมรูปแบบ defensive (image_urls ก่อน, ไม่งั้น image_url)
function productImages(product: any): string[] {
  return Array.isArray(product.image_urls) && product.image_urls.length > 0
    ? product.image_urls
    : product.image_url ? [product.image_url] : []
}

// helper: prefill ข้อความ LINE ด้วยชื่อสินค้า + OEM
function lineLink(product: any) {
  const oem = product.oem_number ? ` OEM ${product.oem_number}` : ''
  const sku = product.part_number ? ` (SKU ${product.part_number})` : ''
  const text = `สอบถามอะไหล่ "${product.name}"${oem}${sku} ยังมีไหมครับ`
  return `${LINE_OA}?text=${encodeURIComponent(text)}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'ไม่พบสินค้า | ChutiBenz' }
  const oem = product.oem_number ? ` ${product.oem_number}` : ''
  const title = `${product.name}${oem}`.trim()
  const description = (
    product.description ||
    `${product.name} อะไหล่ Mercedes-Benz มือสอง${oem ? ` OEM${oem}` : ''} — ChutiBenz`
  ).slice(0, 160)
  const url = `${SITE_URL}/products/${product.slug}`
  // (A) รูปสำหรับแชร์ social — รองรับสินค้าที่มีแค่ image_urls (แกลเลอรี)
  const imgs = productImages(product)
  const ogImages = imgs.length > 0 ? imgs.slice(0, 4).map((u: string) => ({ url: u })) : undefined
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ChutiBenz`,
      description,
      url,
      type: 'website',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ChutiBenz`,
      description,
      images: imgs.length > 0 ? [imgs[0]] : undefined,
    },
  }
}

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const supabase = await createClient()
  const { data: relatedProducts } = await supabase
    .from('products').select('*')
    .eq('category', product.category).eq('is_published', true)
    .neq('id', product.id).limit(3)

  // --- derived (defensive) ---
  const images: string[] = productImages(product)
  const mainImage = images[0] || null
  const hasPrice = typeof product.price === 'number' && product.price > 0
  const engineCodes: string[] = Array.isArray(product.engine_codes) ? product.engine_codes : []
  const altParts: string[] = Array.isArray(product.alt_part_numbers) ? product.alt_part_numbers : []
  const sideLabel = product.side === 'L' ? 'ซ้าย' : product.side === 'R' ? 'ขวา' : null

  // --- JSON-LD Product schema ---
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: images.length > 0 ? images : undefined,
    description: product.description || product.name,
    sku: product.part_number || undefined,
    mpn: product.oem_number || undefined,
    brand: { '@type': 'Brand', name: 'Mercedes-Benz' },
    offers: hasPrice ? {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'THB',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/products/${product.slug}`,
      seller: { '@type': 'Organization', name: 'ChutiBenz' },
    } : undefined,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight hover:text-yellow-400 transition">
            ChutiBenz <span className="text-yellow-400">⭐</span>
          </Link>
          <div className="flex gap-2">
            <a href={LINE_OA} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition">💬 Line</a>
            <a href="tel:0818285855"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition">📞 081-828-5855</a>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link href="/search" className="text-sm text-gray-600 hover:text-gray-900 transition">← กลับไปค้นหาอะไหล่</Link>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-8">

            {/* (1) GALLERY */}
            <div>
              <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                {mainImage ? (
                  <img src={mainImage} alt={product.image_alt || product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <span className="text-8xl">🚗</span>
                    <span className="text-xs mt-2">รูปสินค้ากำลังจัดเตรียม · สอบถามรูปจริงทาง LINE</span>
                  </div>
                )}
                {typeof product.stock === 'number' && product.stock <= 1 && product.stock > 0 && (
                  <span className="absolute top-4 right-4 px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded">เหลือชิ้นสุดท้าย!</span>
                )}
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {images.slice(0, 8).map((src, i) => (
                    <div key={i} className={`aspect-square bg-gray-100 rounded-lg overflow-hidden ${i === 0 ? 'ring-2 ring-yellow-500' : ''}`}>
                      <img src={src} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* INFO */}
            <div className="flex flex-col">
              {/* (2) Tags + Title */}
              <div className="flex flex-wrap gap-2 mb-4">
                {product.category && <span className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">{product.category}</span>}
                <span className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
                  {product.condition === 'used-good' ? 'มือสอง สภาพดี' :
                    product.condition === 'oem' ? 'OEM แท้' :
                    product.condition === 'aftermarket' ? 'Aftermarket' : (product.condition || 'มือสอง')}
                </span>
                {sideLabel && <span className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">ด้าน{sideLabel}</span>}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"><L th={product.name} en={product.name_en} /></h1>

              {product.description && <p className="text-gray-700 mb-6 leading-relaxed">{product.description}</p>}

              {/* (3) รหัส OEM / SKU / เลขเทียบ */}
              <div className="mb-6 space-y-3">
                {product.oem_number ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-gray-500">OEM Part No.</p>
                    <p className="font-mono font-bold text-lg text-gray-900 break-all">{product.oem_number}</p>
                    {product.part_number && (
                      <p className="text-xs text-gray-400 mt-1">รหัสสินค้าในร้าน: <span className="font-mono">{product.part_number}</span></p>
                    )}
                  </div>
                ) : product.part_number ? (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">รหัสสินค้าในร้าน (SKU)</p>
                    <p className="font-mono font-semibold">{product.part_number}</p>
                  </div>
                ) : null}

                {altParts.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">เลขเทียบ / ใช้ร่วม</p>
                    <div className="flex flex-wrap gap-1">
                      {altParts.map((n) => (
                        <span key={n} className="font-mono text-xs bg-white border border-gray-200 px-2 py-1 rounded">{n}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* (4) รุ่นรถที่ใช้ได้ */}
              {Array.isArray(product.compatible_models) && product.compatible_models.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">🚗 รุ่นรถที่ใช้ได้:</p>
                  <div className="flex flex-wrap gap-2">
                    {product.compatible_models.map((m: string) => (
                      <Link key={m} href={`/search?model=${m}`}
                        className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition">{m}</Link>
                    ))}
                  </div>
                </div>
              )}

              {/* (5) รหัสเครื่องที่เกี่ยวข้อง (เฉพาะชิ้นส่วนเครื่อง) */}
              {engineCodes.length > 0 && (
                <div className="mb-5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">🔧 รหัสเครื่องที่เกี่ยวข้อง:</p>
                  <div className="flex flex-wrap gap-2">
                    {engineCodes.map((c) => (
                      <span key={c} className="font-mono px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-sm">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* (6) ราคา + warranty */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <p className="text-sm text-gray-500 mb-1">ราคา</p>
                <div className="flex items-end gap-3">
                  {hasPrice ? (
                    <>
                      <p className="text-4xl md:text-5xl font-bold text-green-600">฿{product.price.toLocaleString()}</p>
                      {typeof product.stock === 'number' && <p className="text-sm text-gray-500 mb-2">มี {product.stock} ชิ้น</p>}
                    </>
                  ) : (
                    <p className="text-xl font-semibold text-gray-700">สอบถามราคาทาง LINE</p>
                  )}
                </div>
                {typeof product.warranty_days === 'number' && product.warranty_days > 0 && (
                  <p className="text-xs text-gray-500 mt-2">🛡️ รับประกัน {product.warranty_days} วัน</p>
                )}
              </div>

              {/* Add to Cart */}
              {hasPrice && <div className="mb-6"><AddToCartButton product={product} /></div>}

              {/* (B) แจ้งสอบถามสถานะก่อนตัดสินใจ — เด่นเหนือปุ่มติดต่อ */}
              <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-900">
                <span className="font-semibold">⚠️ กรุณาสอบถามสถานะสินค้าก่อนตัดสินใจ</span> — สินค้ามือสอง/ของหายาก มีจำนวนจำกัด อาจถูกจองหรือขายไปก่อน ทักไลน์เช็คสถานะล่าสุดได้เลยครับ
              </div>

              {/* (8) CTA */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <a href={lineLink(product)} target="_blank" rel="noopener noreferrer"
                  className="px-6 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-center transition shadow-md hover:shadow-lg">💬 ติดต่อทาง Line</a>
                <a href="tel:0818285855"
                  className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-center transition shadow-md hover:shadow-lg">📞 081-828-5855</a>
              </div>
              <Link href="/intake"
                className="block text-center text-sm text-yellow-700 border border-yellow-400 rounded-xl py-3 mb-6 hover:bg-yellow-50 transition">
                📋 ส่งคำถาม / ขอเช็คความเข้ากันได้ก่อนสั่งซื้อ
              </Link>

              {/* fitment note */}
              {product.fitment_note && (
                <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900">
                  <span className="font-semibold">หมายเหตุการติดตั้ง:</span> {product.fitment_note}
                </div>
              )}

              {/* (9) Trust strip — 4 ช่อง (ตรวจสภาพ · สอบถามสถานะ · จัดส่ง/นัดรับ · ติดต่อเร็ว) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs text-gray-600">
                <div className="p-2"><p className="text-2xl mb-1">🔍</p><p>ตรวจสภาพก่อนส่ง</p></div>
                <div className="p-2"><p className="text-2xl mb-1">💬</p><p>สอบถามสถานะก่อนซื้อ</p></div>
                <div className="p-2"><p className="text-2xl mb-1">🚚</p><p>จัดส่งทั่วไทย / นัดรับได้</p></div>
                <div className="p-2"><p className="text-2xl mb-1">⚡</p><p>ติดต่อกลับโดยเร็ว</p></div>
              </div>
              {product.oem_verified === true && (
                <div className="mt-3 text-center">
                  <span className="inline-block text-xs px-3 py-1 bg-yellow-50 border border-yellow-300 rounded-full text-yellow-700 font-medium">✓ OEM แท้ 100% (ตรวจสอบแล้ว)</span>
                </div>
              )}
            </div>
          </div>

          {/* (7) Checklist ก่อนสั่งซื้อ */}
          <div className="px-6 md:px-8 pb-8">
            <div className="rounded-xl p-5 bg-amber-50 border border-amber-200">
              <h3 className="font-bold text-gray-900 mb-3">✅ ก่อนสั่งซื้อ ควรเทียบให้ตรงก่อน</h3>
              <ul className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
                <li className="flex gap-2"><span className="text-yellow-600">▸</span> รุ่นรถ + ปีที่ผลิต</li>
                <li className="flex gap-2"><span className="text-yellow-600">▸</span> เลข OEM / Part Number บนชิ้นเดิม</li>
                <li className="flex gap-2"><span className="text-yellow-600">▸</span> รหัสเครื่อง (ถ้าเป็นชิ้นส่วนเครื่อง)</li>
                <li className="flex gap-2"><span className="text-yellow-600">▸</span> ด้านซ้าย/ขวา (ถ้ามี)</li>
                <li className="flex gap-2"><span className="text-yellow-600">▸</span> ปลั๊ก/ขั้วต่อ/จำนวนพิน (ชิ้นไฟฟ้า)</li>
                <li className="flex gap-2"><span className="text-yellow-600">▸</span> ไม่แน่ใจ — ส่งรูปชิ้นเดิม + VIN ให้ทีมเช็คก่อน</li>
              </ul>
              <a href={lineLink(product)} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-3 text-sm bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-medium rounded-lg px-4 py-2 transition">
                💬 ส่งรูป + VIN ให้ทีมเช็คความเข้ากันได้
              </a>
            </div>
          </div>
        </div>

        {/* (10) Related */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">💎 สินค้าที่เกี่ยวข้อง</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProducts.map((rp: any) => (
                <Link key={rp.id} href={`/products/${rp.slug}`}
                  className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    {rp.image_url ? (
                      <img src={rp.image_url} alt={rp.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><span className="text-6xl">🚗</span></div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2"><L th={rp.name} en={rp.name_en} /></h3>
                    {typeof rp.price === 'number' && rp.price > 0 ? (
                      <p className="text-2xl font-bold text-green-600">฿{rp.price.toLocaleString()}</p>
                    ) : (
                      <p className="text-sm font-semibold text-gray-600">สอบถามราคาทาง LINE</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* (11) JSON-LD Product schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <footer className="bg-gray-900 text-gray-300 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-sm">
          <p>© 2026 ChutiBenz. คลังอะไหล่เบนซ์มือสองคุณภาพดี</p>
        </div>
      </footer>
    </div>
  )
}
