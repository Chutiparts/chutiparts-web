// app/garage/[slug]/page.tsx — หน้ารายอู่ (garage detail) + LocalBusiness JSON-LD
// spec §โครงหน้าเว็บ 3) หน้ารายอู่ · §Structured data (name/address/phone/geo/hours ต้องตรงหน้า)
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { provinceSlug } from '@/lib/benz-provinces'
import { Stars, type Garage } from '../_components'

export const dynamic = 'force-dynamic'

type Service = { service_key: string; service_label: string | null }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('garages').select('name_th, province, description').eq('slug', slug).eq('status', 'published').single()
  if (!data) return { title: 'ไม่พบอู่' }
  return {
    title: `${data.name_th}${data.province ? ` · อู่เบนซ์${data.province}` : ''} | ChutiBenz`,
    description: data.description || `ข้อมูลติดต่อ พิกัด แผนที่ และคะแนนรีวิวของ ${data.name_th} บน ChutiBenz`,
    alternates: { canonical: `/garage/${slug}` },
  }
}

export default async function GarageDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: g } = await supabase.from('garages').select('*').eq('slug', slug).eq('status', 'published').single()
  if (!g) notFound()
  const garage = g as Garage

  const [{ data: svcData }, { data: meta }] = await Promise.all([
    supabase.from('garage_services').select('service_key, service_label').eq('garage_id', garage.id),
    supabase.from('garage_reviews_meta').select('opening_hours_json').eq('garage_id', garage.id).maybeSingle(),
  ])
  const services = (svcData || []) as Service[]
  const hasPhone = garage.phone && garage.phone !== '-'

  // LocalBusiness (AutoRepair) JSON-LD — ใส่เฉพาะ field ที่แสดงบนหน้า (ต้องตรงกันจริง)
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    name: garage.name_th,
    ...(garage.address_raw ? {
      address: {
        '@type': 'PostalAddress',
        streetAddress: garage.address_raw,
        ...(garage.district && garage.district !== '-' ? { addressLocality: garage.district } : {}),
        ...(garage.province ? { addressRegion: garage.province } : {}),
        addressCountry: 'TH',
      },
    } : {}),
    ...(hasPhone ? { telephone: garage.phone } : {}),
    ...(garage.website ? { url: garage.website } : {}),
    ...(garage.lat && garage.lng ? { geo: { '@type': 'GeoCoordinates', latitude: garage.lat, longitude: garage.lng } } : {}),
    ...(garage.maps_url ? { hasMap: garage.maps_url } : {}),
    ...(garage.rating ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: garage.rating, reviewCount: garage.review_count || 0 },
    } : {}),
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* breadcrumb */}
      <nav className="text-xs text-gray-500 mb-3">
        <Link href="/benz-garages-thailand" className="hover:underline">อู่เบนซ์ทั่วไทย</Link>
        {garage.province && (
          <>
            <span className="mx-1.5">/</span>
            <Link href={`/benz-garages/${provinceSlug(garage.province)}`} className="hover:underline">{garage.province}</Link>
          </>
        )}
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">{garage.name_th}</span>
      </nav>

      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div>
            <h1 className="text-3xl font-bold">{garage.name_th}</h1>
            {garage.name_en && <p className="text-gray-500 text-sm">{garage.name_en}</p>}
            <p className="text-gray-600 mt-1">
              🔧 อู่ซ่อมเบนซ์
              {garage.province && ` · 📍 ${garage.province}`}
              {garage.district && garage.district !== '-' ? `, ${garage.district}` : ''}
            </p>
          </div>
          <Stars rating={garage.rating} count={garage.review_count} />
        </div>

        {garage.address_raw && <p className="text-sm text-gray-600 mb-3">📍 {garage.address_raw}</p>}
        {garage.description && <p className="text-gray-700 mb-4 whitespace-pre-wrap">{garage.description}</p>}

        {/* service tags */}
        {services.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">🔧 บริการ:</p>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <span key={s.service_key} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm">
                  {s.service_label || s.service_key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* opening hours */}
        {meta?.opening_hours_json && (
          <details className="mb-4 rounded-lg border p-3">
            <summary className="text-sm font-semibold cursor-pointer">🕒 เวลาทำการ</summary>
            <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{JSON.stringify(meta.opening_hours_json, null, 2)}</pre>
          </details>
        )}

        {/* actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {hasPhone && (
            <a href={`tel:${garage.phone}`} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg text-center">
              📞 โทร {garage.phone}
            </a>
          )}
          {garage.maps_url && (
            <a href={garage.maps_url} target="_blank" rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg text-center">
              🗺️ เปิด Google Maps
            </a>
          )}
          {garage.website && (
            <a href={garage.website} target="_blank" rel="noopener noreferrer"
              className="bg-white border font-bold py-3 rounded-lg text-center sm:col-span-2 hover:border-[#C9A961]">
              🌐 เว็บไซต์อู่
            </a>
          )}
        </div>

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
          ⚠️ โปรดโทรเช็กกับอู่ก่อนเข้ารับบริการ — ข้อมูลบางรายการอาจมีการเปลี่ยนแปลง
          {garage.updated_at && ` · ตรวจล่าสุด ${new Date(garage.updated_at).toLocaleDateString('th-TH')}`}
        </p>
      </div>

      <div className="text-center mt-6">
        <Link href="/benz-garages-thailand" className="text-[#2e6ba8] font-semibold text-sm">← กลับหน้ารวมอู่เบนซ์ทั่วไทย</Link>
      </div>
    </div>
  )
}
