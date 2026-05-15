'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { CHASSIS_MODELS, PARTS_CATEGORIES, LINE_OA_URL } from '@/lib/constants'

type Product = any
type Article = any
type Business = any

type Props = {
  initialQuery: string
  initialModel: string
  initialCategory: string
  initialType: string
  products: Product[]
  articles: Article[]
  businesses: Business[]
  resolved: { canonical?: string; type?: string } | null
}

const TABS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'products', label: 'อะไหล่' },
  { value: 'articles', label: 'บทความ' },
  { value: 'businesses', label: 'อู่/ร้าน' },
]

export default function SearchClient({
  initialQuery, initialModel, initialCategory, initialType,
  products, articles, businesses, resolved,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(initialQuery)
  const [model, setModel] = useState(initialModel)
  const [cat, setCat] = useState(initialCategory)
  const [tab, setTab] = useState(initialType)

  // Debounced URL update
  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams()
      if (q) sp.set('q', q)
      if (model) sp.set('model', model)
      if (cat) sp.set('cat', cat)
      if (tab !== 'all') sp.set('type', tab)
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 300)
    return () => clearTimeout(t)
  }, [q, model, cat, tab, router, pathname])

  const totalCount = products.length + articles.length + businesses.length
  const hasFilters = q || model || cat

  const filteredByTab = (() => {
    if (tab === 'products') return { p: products, a: [], b: [] }
    if (tab === 'articles') return { p: [], a: articles, b: [] }
    if (tab === 'businesses') return { p: [], a: [], b: businesses }
    return { p: products, a: articles, b: businesses }
  })()

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาอะไหล่ เช่น ไฟท้าย, W140, ECU, ปลาวาฬ"
            className="w-full rounded-xl border-2 border-gray-300 bg-white py-4 pl-12 pr-12 text-lg focus:border-yellow-500 focus:outline-none"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
            >✕</button>
          )}
        </div>

        {resolved?.canonical && resolved.canonical !== q && (
          <p className="text-sm text-gray-600 mt-2">
            💡 ตีความเป็น: <strong className="text-yellow-700">{resolved.canonical}</strong> ({resolved.type})
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-600">🚗 รุ่น:</span>
          {CHASSIS_MODELS.map((m) => (
            <button
              key={m}
              onClick={() => setModel(model === m ? '' : m)}
              className={[
                'rounded-full px-3 py-1 text-sm font-semibold border-2 transition',
                model === m
                  ? 'bg-yellow-500 text-white border-yellow-500'
                  : 'bg-white border-gray-200 hover:border-yellow-400',
              ].join(' ')}
            >{m}</button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-600">🏷 หมวด:</span>
          {PARTS_CATEGORIES.slice(0, 8).map((c) => (
            <button
              key={c.value}
              onClick={() => setCat(cat === c.value ? '' : c.value)}
              className={[
                'rounded-full px-3 py-1 text-sm font-semibold border-2 transition',
                cat === c.value
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white border-gray-200 hover:border-blue-400',
              ].join(' ')}
            >{c.label}</button>
          ))}
        </div>
      </div>

      {/* Tabs + count */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={[
                'rounded-md px-4 py-2 text-sm font-semibold transition',
                tab === t.value ? 'bg-white text-gray-900 shadow' : 'text-gray-600',
              ].join(' ')}
            >{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>พบ <strong>{totalCount}</strong> รายการ</span>
          {hasFilters && (
            <button
              onClick={() => {
                setQ(''); setModel(''); setCat(''); setTab('all')
              }}
              className="text-yellow-700 underline"
            >ล้างทั้งหมด</button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {totalCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Products */}
          {filteredByTab.p.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-3">🛒 อะไหล่ ({products.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredByTab.p.map((p: any) => (
                  <Link key={p.id} href={`/products/${p.slug}`} className="block">
                    <article className="bg-white rounded-xl border border-gray-100 hover:shadow-lg transition overflow-hidden">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center text-5xl">🚗</div>
                      )}
                      <div className="p-3">
                        <div className="flex flex-wrap gap-1 mb-2">
                          {p.category && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{p.category}</span>}
                          {p.compatible_models?.[0] && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">{p.compatible_models[0]}</span>}
                        </div>
                        <h3 className="font-bold text-sm line-clamp-2">{p.name}</h3>
                        <p className="text-green-600 font-bold mt-2">฿{p.price?.toLocaleString()}</p>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Articles */}
          {filteredByTab.a.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-3">📖 บทความ ({articles.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredByTab.a.map((a: any) => (
                  <Link key={a.id} href={`/articles/${a.slug}`}
                    className="block bg-white rounded-lg border border-gray-100 hover:shadow-md transition p-4"
                  >
                    <h3 className="font-bold text-sm line-clamp-2">{a.title}</h3>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{a.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Businesses */}
          {filteredByTab.b.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-3">🔨 อู่/ร้าน ({businesses.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredByTab.b.map((b: any) => (
                  <Link key={b.id} href={`/businesses/${b.slug}`}
                    className="block bg-white rounded-lg border border-gray-100 hover:shadow-md transition p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold">{b.name}</h3>
                      {b.verified && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Verified</span>}
                    </div>
                    <p className="text-xs text-gray-600">{b.type === 'garage' ? '🔨 อู่' : '🛒 ร้านอะไหล่'} · {b.province}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-white rounded-2xl">
      <div className="text-7xl mb-4">🔍</div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">ไม่พบรายการที่ค้น</h2>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        ลองพิมพ์ชื่อ ชิ้นส่วน หรือรุ่นรถที่ต่างออกไป
        <br />
        หรือบอกเราใน LINE เราจะช่วยหาให้
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a href={LINE_OA_URL} target="_blank" rel="noopener noreferrer"
          className="rounded-lg bg-green-500 hover:bg-green-600 text-white px-6 py-3 font-semibold"
        >💬 ทักทาย LINE</a>
        <Link href="/intake"
          className="rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 font-semibold"
        >📋 ส่งอาการรถ</Link>
      </div>
    </div>
  )
}
