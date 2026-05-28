// app/businesses/[slug]/page.tsx — Business detail page
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { LINE_OA_URL } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('businesses').select('name, description, cover_image').eq('slug', slug).single()
  if (!data) return { title: 'ไม่พบร้าน' }
  return {
    title: data.name,
    description: data.description,
    openGraph: {
      images: data.cover_image ? [data.cover_image] : undefined,
    },
  }
}

export default async function BusinessDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: biz } = await supabase.from('businesses').select('*').eq('slug', slug).single()
  if (!biz) notFound()

  // Get reviews
  const { data: reviews } = await supabase.from('reviews').select('*').eq('business_id', biz.id).eq('approved', true).order('created_at', { ascending: false }).limit(10)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Hero */}
      {biz.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={biz.cover_image} alt={biz.name} className="w-full h-64 md:h-80 object-cover rounded-2xl mb-6" />
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-bold">{biz.name}</h1>
            <p className="text-gray-600 mt-1">
              {biz.type === 'garage' ? '🔨 อู่ซ่อม' : biz.type === 'parts_shop' ? '🛒 ร้านอะไหล่' : '🔨🛒 อู่ + ร้าน'}
              {biz.province && ` · 📍 ${biz.province}`}
              {biz.district && `, ${biz.district}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {biz.verified && <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">✓ Verified by ChutiBenz</span>}
            {biz.badges?.includes('team_recommended') && <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">⭐ แนะนำโดยทีม</span>}
          </div>
        </div>

        {/* Address */}
        {biz.address && (
          <p className="text-sm text-gray-600 mb-4">📍 {biz.address}</p>
        )}

        {/* Models */}
        {biz.models_expertise && biz.models_expertise.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">🚗 รุ่นที่ถนัด:</p>
            <div className="flex flex-wrap gap-2">
              {biz.models_expertise.map((m: string) => (
                <span key={m} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm font-semibold">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Specialties */}
        {biz.specialties && biz.specialties.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">🔧 งานที่ถนัด:</p>
            <div className="flex flex-wrap gap-2">
              {biz.specialties.map((s: string) => (
                <span key={s} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm">{s}</span>
              ))}
            </div>
          </div>
        )}

        {biz.description && (
          <p className="text-gray-700 mb-6 whitespace-pre-wrap">{biz.description}</p>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {biz.phone && (
            <a href={`tel:${biz.phone}`} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg text-center">
              📞 โทร {biz.phone}
            </a>
          )}
          {biz.line_id && (
            <a href={`https://line.me/R/ti/p/~${biz.line_id.replace('@','')}`} target="_blank" rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg text-center"
            >
              💬 LINE: {biz.line_id}
            </a>
          )}
          <Link href={`/intake?source=biz_${biz.slug}`}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg text-center sm:col-span-2"
          >
            📋 ส่งอาการรถ ขอให้แนะนำ
          </Link>
        </div>
      </div>

      {/* Reviews */}
      {reviews && reviews.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-4">💬 รีวิว ({biz.reviews_count})</h2>
          <div className="space-y-3">
            {reviews.map(r => (
              <article key={r.id} className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-400">{'⭐'.repeat(r.rating)}</span>
                  <span className="text-sm font-semibold">{r.author_name || 'ลูกค้า'}</span>
                  <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('th-TH')}</span>
                </div>
                {r.title && <h3 className="font-semibold mb-1">{r.title}</h3>}
                {r.body && <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-500 mt-6 text-center">
        * รีวิวจากลูกค้าจริง · ChutiBenz ไม่รับผิดชอบบริการของพาร์ทเนอร์โดยตรง
      </p>
    </div>
  )
}
