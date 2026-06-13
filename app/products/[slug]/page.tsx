import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import AddToCartButton from '../../components/AddToCartButton'

const SITE_URL = 'https://chutibenz.com'

// ดึงสินค้าจาก slug (รองรับ slug ไทย + fallback ด้วย code นำหน้าแบบ ASCII)
async function getProductBySlug(slug: string) {
  const supabase = await createClient()
  let product: any = null

  // 1) ลอง match slug ตรง
  {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .limit(1)
    product = data?.[0] ?? null
  }

  // 2) ถ้าไม่เจอ → match ด้วย code นำหน้า (ASCII-safe, เลี่ยงปัญหาอักขระไทยใน filter)
  if (!product) {
    const codeMatch = slug.match(/^(\d+-\d+)/)
    if (codeMatch) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .ilike('slug', `${codeMatch[1]}-%`)
        .eq('is_published', true)
        .limit(1)
      product = data?.[0] ?? null
    }
  }
  return product
}

// Phase 0 (2026-06-13): metadata รายหน้า — canonical/title/description/og ของสินค้าแต่ละชิ้น
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) {
    return { title: 'ไม่พบสินค้า | ChutiBenz' }
  }
  const oem = product.oem_number ? ` ${product.oem_number}` : ''
  // ไม่เติม " | ChutiBenz" เพราะ layout มี title template เติมให้แล้ว (กันซ้ำ)
  // และไม่เติม chassis ซ้ำ เพราะชื่อสินค้ามักมีรุ่นอยู่แล้ว
  const title = `${product.name}${oem}`.trim()
  const description = (
    product.description ||
    `${product.name} อะไหล่ Mercedes-Benz มือสอง — ChutiBenz`
  ).slice(0, 160)
  const url = `${SITE_URL}/products/${product.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ChutiBenz`,
      description,
      url,
      type: 'website',
      images: product.image_url ? [{ url: product.image_url }] : undefined,
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

  if (!product) {
    notFound()
  }

  const supabase = await createClient()
  const { data: relatedProducts } = await supabase
    .from('products')
    .select('*')
    .eq('category', product.category)
    .eq('is_published', true)
    .neq('id', product.id)
    .limit(3)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold tracking-tight hover:text-yellow-400 transition">
              ChutiBenz <span className="text-yellow-400">⭐</span>
            </Link>
            <div className="flex gap-2">
              <a
                href="https://line.me/ti/p/~mr.chuti5988"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
              >
                💬 Line
              </a>
              <a
                href="tel:0818285855"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition"
              >
                📞 081-828-5855
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition">
          ← กลับหน้าแรก
        </Link>
      </div>

      {/* Product Detail */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-8">
            {/* Image */}
            <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span className="text-9xl">🚗</span>
                </div>
              )}
              {product.stock <= 1 && product.stock > 0 && (
                <span className="absolute top-4 right-4 px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded">
                  เหลือชิ้นสุดท้าย!
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col">
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  {product.category}
                </span>
                <span className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
                  {product.condition === 'used-good' ? 'มือสอง สภาพดี' :
                    product.condition === 'oem' ? 'OEM แท้' :
                    product.condition === 'aftermarket' ? 'Aftermarket' :
                    product.condition}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>

              {/* Description */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                {product.description}
              </p>

              {/* Compatible Models */}
              {product.compatible_models?.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-gray-700 mb-2">🚗 รองรับรุ่น:</p>
                  <div className="flex flex-wrap gap-2">
                    {product.compatible_models.map((model: string) => (
                      <span
                        key={model}
                        className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* OEM Part Number (เด่น) + รหัสสินค้าในร้าน — Phase 0 decision 2 */}
              {product.oem_number ? (
                <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-gray-500">OEM Part No.</p>
                  <p className="font-mono font-bold text-lg text-gray-900">{product.oem_number}</p>
                  {product.part_number && (
                    <p className="text-xs text-gray-400 mt-1">
                      รหัสสินค้าในร้าน: <span className="font-mono">{product.part_number}</span>
                    </p>
                  )}
                </div>
              ) : product.part_number ? (
                <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">รหัสสินค้าในร้าน (SKU)</p>
                  <p className="font-mono font-semibold">{product.part_number}</p>
                </div>
              ) : null}

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <p className="text-sm text-gray-500 mb-1">ราคา</p>
                <div className="flex items-end gap-3">
                  {typeof product.price === 'number' && product.price > 0 ? (
                    <>
                      <p className="text-4xl md:text-5xl font-bold text-green-600">
                        ฿{product.price.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500 mb-2">
                        มี {product.stock} ชิ้น
                      </p>
                    </>
                  ) : (
                    <p className="text-xl font-semibold text-gray-700">
                      ติดต่อสอบถามราคาทาง LINE
                    </p>
                  )}
                </div>
              </div>

              {/* Add to Cart Section */}
              <div className="mb-6">
                <AddToCartButton product={product} />
              </div>

              {/* Contact Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <a
                  href="https://line.me/ti/p/~mr.chuti5988"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-center transition shadow-md hover:shadow-lg"
                >
                  💬 ติดต่อทาง Line
                </a>
                <a
                  href="tel:0818285855"
                  className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-center transition shadow-md hover:shadow-lg"
                >
                  📞 081-828-5855
                </a>
              </div>

              {/* Trust badges — Phase 0 decision 4: ข้อความกลางที่เป็นจริงเท่านั้น */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-600">
                <div className="p-2">
                  <p className="text-2xl mb-1">🔍</p>
                  <p>ตรวจสภาพก่อนส่ง</p>
                </div>
                <div className="p-2">
                  <p className="text-2xl mb-1">📋</p>
                  <p>แจ้งเงื่อนไขก่อนชำระ</p>
                </div>
                <div className="p-2">
                  <p className="text-2xl mb-1">💬</p>
                  <p>ติดต่อกลับโดยเร็ว</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              💎 สินค้าที่เกี่ยวข้อง
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProducts.map((rp) => (
                <Link
                  key={rp.id}
                  href={`/products/${rp.slug}`}
                  className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
                >
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    {rp.image_url ? (
                      <img
                        src={rp.image_url}
                        alt={rp.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span className="text-6xl">🚗</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">
                      {rp.name}
                    </h3>
                    {typeof rp.price === 'number' && rp.price > 0 ? (
                      <p className="text-2xl font-bold text-green-600">
                        ฿{rp.price.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-gray-600">
                        สอบถามราคาทาง LINE
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-sm">
          <p>© 2026 ChutiBenz. คลังอะไหล่เบนซ์มือสองคุณภาพดี</p>
        </div>
      </footer>
    </div>
  )
}
