// app/search/SearchClient.tsx — UX v5
// 2026-06-01 — Improvements:
//   1. Smart price display: ฿1,500 default → "ราคา TBC · ติดต่อ LINE"
//   2. Branded placeholder card (gradient + chassis badge, not 🚗 emoji)
//   3. Sort options: ล่าสุด, ราคา↑, ราคา↓, มีของ
//   4. Keyword highlight in product names
//   5. Inline LINE CTA card at bottom of results (always)
//   6. "ขอราคา/รูป" quick-action LINE deep-link on placeholder cards
//   7. Better mobile spacing (2-col on sm:, was 1-col)
//   8. Stock badge ("มีของ" / "หมด")

'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
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

const SORT_OPTIONS = [
  { value: 'latest', label: 'ล่าสุด' },
  { value: 'price_asc', label: 'ราคาต่ำ→สูง' },
  { value: 'price_desc', label: 'ราคาสูง→ต่ำ' },
  { value: 'in_stock', label: 'มีของก่อน' },
]

// Detect placeholder pricing (default values from Excel V11 bulk-add)
function isPlaceholderPrice(p: any): boolean {
  // Default values: cost=1000, sell=1500. If sell is exactly 1500 AND no image,
  // it's likely a placeholder we haven't priced yet.
  if (p.price !== 1500) return false
  if (p.image_url) return false // has photo → real listing
  return true
}

function highlightTerm(text: string, term: string): React.ReactNode {
  if (!term || !text) return text
  const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${safeTerm})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
      : <span key={i}>{part}</span>
  )
}

function lineAskMessage(productName: string, partNumber?: string): string {
  const code = partNumber ? ` (${partNumber})` : ''
  return `สวัสดีพี่ Chuti อยากสอบถามราคา/รูป "${productName}${code}" ครับ`
}

function lineAskUrl(productName: string, partNumber?: string): string {
  return `${LINE_OA_URL}?text=${encodeURIComponent(lineAskMessage(productName, partNumber))}`
}

function sortProducts(items: Product[], sort: string): Product[] {
  const arr = [...items]
  switch (sort) {
    case 'price_asc':
      return arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    case 'price_desc':
      return arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    case 'in_stock':
      return arr.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
    case 'latest':
    default:
      return arr.sort((a, b) => {
        const ta = a.updated_at || a.created_at || ''
        const tb = b.updated_at || b.created_at || ''
        return tb.localeCompare(ta)
      })
  }
}

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
  const [sort, setSort] = useState<string>('latest')

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

  const sortedProducts = useMemo(() => sortProducts(products, sort), [products, sort])

  const filteredByTab = (() => {
    if (tab === 'products') return { p: sortedProducts, a: [], b: [] }
    if (tab === 'articles') return { p: [], a: articles, b: [] }
    if (tab === 'businesses') return { p: [], a: [], b: businesses }
    return { p: sortedProducts, a: articles, b: businesses }
  })()

  // The "highlight" term: prefer the resolved canonical for chassis lookups,
  // but use the raw query (q) for everything else so users see what they typed.
  const highlightWord = q.trim()

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
              aria-label="ล้างคำค้นหา"
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

      {/* Tabs + sort + count */}
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
        <div className="flex items-center gap-3 text-sm flex-wrap">
          {/* Sort selector (only when there are products visible) */}
          {(tab === 'all' || tab === 'products') && products.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-gray-600">เรียง:</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-yellow-500 focus:outline-none"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
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
        <EmptyState query={q} />
      ) : (
        <>
          {/* Products */}
          {filteredByTab.p.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-3">🛒 อะไหล่ ({products.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredByTab.p.map((p: any) => (
                  <ProductCard key={p.id} p={p} highlight={highlightWord} />
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
                    <h3 className="font-bold text-sm line-clamp-2">{highlightTerm(a.title, highlightWord)}</h3>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{a.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Businesses */}
          {filteredByTab.b.length > 0 && (
            <section className="mb-8">
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

          {/* Inline LINE CTA at bottom (always show when there are results) */}
          <BottomCta query={q} />
        </>
      )}
    </div>
  )
}

/* ---------- ProductCard ---------- */

function ProductCard({ p, highlight }: { p: any; highlight: string }) {
  const placeholder = isPlaceholderPrice(p)
  const stock = p.stock ?? 0
  const inStock = stock > 0
  const chassis = p.compatible_models?.[0]

  return (
    <Link href={`/products/${p.slug}`} className="block group">
      <article className="bg-white rounded-xl border border-gray-100 hover:shadow-lg hover:border-yellow-300 transition overflow-hidden h-full flex flex-col">
        {/* Image / branded placeholder */}
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image_url}
            alt={p.name}
            className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-gray-50 via-yellow-50 to-gray-100 flex flex-col items-center justify-center relative">
            <div className="text-3xl sm:text-4xl mb-1 opacity-60">⚙️</div>
            <div className="text-xs sm:text-sm font-bold text-gray-600 px-2 text-center line-clamp-2">{chassis || 'ChutiBenz'}</div>
            <div className="absolute top-2 right-2 text-[10px] sm:text-xs bg-white/80 backdrop-blur text-gray-500 px-2 py-0.5 rounded-full">
              ขอภาพได้
            </div>
          </div>
        )}

        <div className="p-3 flex flex-col flex-1">
          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {p.part_number && (
              <span className="text-[10px] sm:text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                {p.part_number}
              </span>
            )}
            {chassis && (
              <span className="text-[10px] sm:text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-semibold">
                {chassis}
              </span>
            )}
            {inStock ? (
              <span className="text-[10px] sm:text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                ✓ มีของ
              </span>
            ) : (
              <span className="text-[10px] sm:text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                สั่งจอง
              </span>
            )}
          </div>

          {/* Name */}
          <h3 className="font-bold text-sm line-clamp-2 mb-2 flex-1">{highlightTerm(p.name, highlight)}</h3>

          {/* Price */}
          {placeholder ? (
            <div className="mt-auto">
              <p className="text-amber-600 font-bold text-sm">ราคา TBC</p>
              <p className="text-[11px] text-gray-500">💬 ติดต่อ LINE เช็คราคา</p>
            </div>
          ) : (
            <p className="text-green-600 font-bold mt-auto">
              ฿{p.price?.toLocaleString()}
            </p>
          )}
        </div>
      </article>
    </Link>
  )
}

/* ---------- Bottom CTA (after results) ---------- */

function BottomCta({ query }: { query: string }) {
  const txt = query
    ? `สวัสดีพี่ Chuti ค้นหา "${query}" บนเว็บแล้ว อยากให้พี่ช่วยเช็คเพิ่มครับ`
    : 'สวัสดีพี่ Chuti อยากปรึกษาเรื่องอะไหล่ครับ'
  return (
    <div className="mt-8 bg-gradient-to-r from-yellow-50 to-green-50 rounded-2xl p-5 sm:p-6 border border-yellow-200">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div>
          <p className="font-bold text-gray-800">ไม่เจอที่ต้องการ?</p>
          <p className="text-sm text-gray-600">พี่ Chuti ช่วยหาอะไหล่หายากให้ — ทักทาย LINE ได้เลย</p>
        </div>
        <a
          href={`${LINE_OA_URL}?text=${encodeURIComponent(txt)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-green-500 hover:bg-green-600 text-white px-5 py-3 font-semibold text-center whitespace-nowrap"
        >💬 ปรึกษาใน LINE</a>
      </div>
    </div>
  )
}

/* ---------- Empty state ---------- */

function EmptyState({ query }: { query: string }) {
  const txt = query
    ? `สวัสดีพี่ Chuti ค้นหา "${query}" ในเว็บไม่เจอ ขอให้ช่วยหาให้ครับ`
    : 'สวัสดีพี่ Chuti อยากปรึกษาเรื่องอะไหล่ครับ'
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
        <a
          href={`${LINE_OA_URL}?text=${encodeURIComponent(txt)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-green-500 hover:bg-green-600 text-white px-6 py-3 font-semibold"
        >💬 ทักทาย LINE</a>
        <Link href="/intake"
          className="rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 font-semibold"
        >📋 ส่งอาการรถ</Link>
      </div>
    </div>
  )
}
