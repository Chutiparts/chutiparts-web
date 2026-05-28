'use client'

import { useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import SearchBar from '@/components/SearchBar'
import FilterDrawer from '@/components/FilterDrawer'
import EmptyState from '@/components/EmptyState'

// Match real Supabase schema (from app/page.tsx original)
type Product = {
  id: string
  slug: string
  name: string
  description?: string | null
  category?: string | null               // English slug: "interior", "electrical", ...
  condition?: string | null              // "used-good" | "oem" | "aftermarket"
  compatible_models?: string[] | null    // ARRAY: ["W140", "W124"]
  price: number
  image_url?: string | null
  stock?: number
}

// อิงจากข้อมูลจริงที่ขายในเว็บ
const KNOWN_MODELS = ['W124', 'W126', 'W140', 'W202', 'W210', 'W220']

// แมป category slug ภาษาอังกฤษ -> ชื่อภาษาไทยที่แสดงใน chip
const CATEGORY_TH: Record<string, string> = {
  interior: 'ภายใน',
  electrical: 'ไฟฟ้า',
  body: 'ตัวถัง',
  engine: 'เครื่องยนต์',
  brake: 'เบรค',
  suspension: 'ช่วงล่าง',
}

export default function HomeClient(props: { products: Product[] }) {
  return (
    <Suspense fallback={<div className="p-8 text-center">กำลังโหลด…</div>}>
      <HomeClientInner {...props} />
    </Suspense>
  )
}

function HomeClientInner({ products }: { products: Product[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const q = params.get('q') ?? ''
  const model = params.get('model')
  const category = params.get('cat')

  // categories จากข้อมูลจริง (distinct)
  const categorySlugs = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) if (p.category) set.add(p.category)
    return Array.from(set).sort()
  }, [products])

  const categoryOptions = useMemo(
    () => categorySlugs.map((slug) => CATEGORY_TH[slug] ?? slug),
    [categorySlugs]
  )

  // map ภาษาไทย -> slug (เวลา filter)
  const slugFromTh = useMemo(() => {
    const m: Record<string, string> = {}
    for (const slug of categorySlugs) m[CATEGORY_TH[slug] ?? slug] = slug
    return m
  }, [categorySlugs])

  // Filter logic — pure derivation from URL state + product list
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return products.filter((p) => {
      if (model) {
        if (!p.compatible_models?.includes(model)) return false
      }
      if (category) {
        const wantedSlug = slugFromTh[category] ?? category
        if (p.category !== wantedSlug) return false
      }
      if (query) {
        const blob = [
          p.name,
          p.slug ?? '',
          p.description ?? '',
          ...(p.compatible_models ?? []),
        ]
          .join(' ')
          .toLowerCase()
        if (!blob.includes(query)) return false
      }
      return true
    })
  }, [products, q, model, category, slugFromTh])

  // URL state — use replace (not push) to keep history clean
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const sp = new URLSearchParams(params.toString())
      if (value === null || value === '') sp.delete(key)
      else sp.set(key, value)
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router]
  )

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [pathname, router])

  const hasFilters = Boolean(q || model || category)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — เหมือนเดิม 100% */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                ChutiBenz <span className="text-yellow-400"></span>
              </h1>
              <p className="text-gray-300 mt-2 text-sm md:text-base">
                คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี | OEM แท้ 100%
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {products.length} รายการพร้อมขาย • รับประกัน 15 วัน • ส่งทั่วไทย
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="https://line.me/ti/p/~mr.chuti5988"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition text-center"
              >
                💬 Line: mr.chuti5988
              </a>
              <a
                href="tel:0818285855"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition text-center"
              >
                📞 081-828-5855
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Search + Filter section (NEW — Day 8) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="mb-4">
          <SearchBar value={q} onChange={(v) => setParam('q', v)} />
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <FilterDrawer
            models={KNOWN_MODELS}
            categories={categoryOptions}
            model={model}
            category={category}
            onChangeModel={(v) => setParam('model', v)}
            onChangeCategory={(v) => setParam('cat', v)}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              พบ <strong className="text-gray-900">{filtered.length}</strong> รายการ
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="text-sm text-yellow-700 underline hover:text-yellow-800"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Products Grid — JSX เหมือนเดิม แค่ใช้ filtered แทน products */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filtered.length === 0 ? (
          <EmptyState onClear={clearAll} hasFilters={hasFilters} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="group block"
              >
                <article className="bg-white rounded-xl shadow-sm group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col h-full cursor-pointer">
                  {/* Image */}
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span className="text-6xl">🚗</span>
                      </div>
                    )}
                    {product.stock != null && product.stock <= 1 && (
                      <span className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                        เหลือชิ้นสุดท้าย!
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-grow">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                        {product.category}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded font-medium">
                        {product.condition === 'used-good'
                          ? 'มือสอง สภาพดี'
                          : product.condition === 'oem'
                          ? 'OEM แท้'
                          : product.condition === 'aftermarket'
                          ? 'Aftermarket'
                          : product.condition}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors">
                      {product.name}
                    </h2>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2 flex-grow">
                      {product.description}
                    </p>

                    {product.compatible_models &&
                      product.compatible_models.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          <span className="text-xs text-gray-500 mr-1">รองรับ:</span>
                          {product.compatible_models.map((m: string) => (
                            <span
                              key={m}
                              className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded font-medium"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      )}

                    <div className="flex items-end justify-between pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500">ราคา</p>
                        <p className="text-2xl font-bold text-green-600">
                          ฿{product.price.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">
                          มี {product.stock} ชิ้น
                        </p>
                        <p className="text-xs text-green-600 font-semibold group-hover:text-green-700 transition-colors">
                          ดูรายละเอียด →
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer — เหมือนเดิม 100% */}
      <footer className="bg-gray-900 text-gray-300 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">ChutiBenz</h3>
              <p className="text-sm">
                คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี
                <br />
                เชี่ยวชาญรุ่นคลาสสิค W124, W126, W140, W202, W210, W220
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">ติดต่อเรา</h3>
              <ul className="space-y-2 text-sm">
                <li>💬 Line: mr.chuti5988</li>
                <li>📞 081-828-5855</li>
                <li>🚚 จัดส่งทั่วประเทศ</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">รับประกัน</h3>
              <ul className="space-y-2 text-sm">
                <li>✅ อะไหล่แท้ OEM 100%</li>
                <li>✅ รับประกัน 15 วัน</li>
                <li>✅ เสียเปลี่ยนได้</li>
                <li>✅ ตรวจสอบก่อนส่ง</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 text-center text-sm">
            <p>© 2026 ChutiBenz. คลังอะไหล่เบนซ์มือสองคุณภาพดี</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
