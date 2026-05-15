// app/businesses/page.tsx — Garage + Shop listing
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { CHASSIS_MODELS } from '@/lib/constants'

export const metadata = {
  title: 'อู่/ร้านอะไหล่ Mercedes-Benz',
  description: 'รายชื่ออู่และร้านอะไหล่ Mercedes-Benz ที่ ChutiParts แนะนำ',
}

export const dynamic = 'force-dynamic'

export default async function BusinessesPage({ searchParams }: { searchParams: { type?: string; province?: string; model?: string } }) {
  const supabase = await createClient()
  let q = supabase.from('businesses').select('*').order('verified', { ascending: false }).order('created_at', { ascending: false })

  if (searchParams.type) q = q.eq('type', searchParams.type)
  if (searchParams.province) q = q.eq('province', searchParams.province)
  if (searchParams.model) q = q.contains('models_expertise', [searchParams.model])

  const { data: businesses } = await q

  const tab = searchParams.type || 'all'

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🔨 อู่ / 🛒 ร้านอะไหล่</h1>
        <p className="text-gray-600">รายชื่ออู่และร้านที่ ChutiParts แนะนำ</p>
      </header>

      {/* Type tabs */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/businesses" className={`rounded-full px-4 py-2 text-sm font-semibold ${!searchParams.type ? 'bg-yellow-500 text-white' : 'bg-white border'}`}>ทั้งหมด</Link>
        <Link href="/businesses?type=garage" className={`rounded-full px-4 py-2 text-sm font-semibold ${searchParams.type === 'garage' ? 'bg-yellow-500 text-white' : 'bg-white border'}`}>🔨 อู่</Link>
        <Link href="/businesses?type=parts_shop" className={`rounded-full px-4 py-2 text-sm font-semibold ${searchParams.type === 'parts_shop' ? 'bg-yellow-500 text-white' : 'bg-white border'}`}>🛒 ร้านอะไหล่</Link>
      </div>

      {/* Model filter */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <span className="text-sm text-gray-600">รุ่นที่ถนัด:</span>
        {CHASSIS_MODELS.map(m => (
          <Link key={m} href={`/businesses${searchParams.type ? `?type=${searchParams.type}&` : '?'}model=${m}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${searchParams.model === m ? 'bg-blue-500 text-white' : 'bg-white border'}`}
          >{m}</Link>
        ))}
      </div>

      {!businesses || businesses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-gray-500">ยังไม่มีรายชื่อ — ติดตามได้เร็วๆ นี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {businesses.map(b => (
            <Link key={b.id} href={`/businesses/${b.slug}`}
              className="block bg-white rounded-xl border border-gray-100 hover:shadow-lg transition overflow-hidden"
            >
              {b.cover_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.cover_image} alt={b.name} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-lg">{b.name}</h2>
                  {b.verified && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">✓ Verified</span>}
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {b.type === 'garage' ? '🔨 อู่ซ่อม' : b.type === 'parts_shop' ? '🛒 ร้านอะไหล่' : '🔨🛒 ทั้งคู่'}
                  {b.province && ` · 📍 ${b.province}`}
                </p>
                {b.models_expertise && b.models_expertise.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {b.models_expertise.slice(0,5).map((m: string) => (
                      <span key={m} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">{m}</span>
                    ))}
                  </div>
                )}
                {b.description && <p className="text-sm text-gray-700 line-clamp-2 mt-2">{b.description}</p>}
                {b.avg_rating > 0 && (
                  <p className="text-xs text-gray-500 mt-2">⭐ {b.avg_rating.toFixed(1)} ({b.reviews_count} รีวิว)</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
