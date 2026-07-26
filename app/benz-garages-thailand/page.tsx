// app/benz-garages-thailand/page.tsx — หน้ารวมประเทศ "อู่เบนซ์ทั่วไทย" (country)
// spec §โครงหน้าเว็บ 1) หน้ารวมประเทศ · §Naming
// อัปเดต 26 ก.ค. 2026: เอาป้ายเดโมออก (มีอู่จริงแล้ว) · กริดจังหวัดไดนามิก (เฉพาะจังหวัดที่มีอู่) · เพิ่มช่องค้นหา
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { provinceSlug } from '@/lib/benz-provinces'
import { type Garage } from '../garage/_components'
import { GarageSearch } from '../garage/GarageSearch'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'อู่เบนซ์ทั่วไทย | ค้นหาอู่ซ่อมเบนซ์ใกล้คุณบน ChutiBenz',
  description:
    'รวมอู่เบนซ์ทั่วไทย ค้นหาอู่ซ่อมเบนซ์ตามจังหวัด พร้อมเบอร์โทร พิกัด แผนที่ คะแนนรีวิว และข้อมูลติดต่อเบื้องต้นบน ChutiBenz',
  alternates: { canonical: '/benz-garages-thailand' },
}

type SortKey = 'rating' | 'reviews' | 'updated'

export default async function BenzGaragesThailand({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const { sort } = await searchParams
  const sortKey: SortKey = sort === 'reviews' ? 'reviews' : sort === 'updated' ? 'updated' : 'rating'

  const supabase = await createClient()
  const { data } = await supabase
    .from('garages')
    .select('id, name_th, name_en, slug, province, district, phone, website, rating, review_count, maps_url, classification, updated_at')
    .eq('status', 'published')
  const garages = (data || []) as Garage[]

  // นับจำนวนต่อจังหวัด (เฉพาะที่มี province จริง)
  const countByProvince: Record<string, number> = {}
  for (const g of garages) if (g.province) countByProvince[g.province] = (countByProvince[g.province] || 0) + 1

  // กริดจังหวัด = เฉพาะจังหวัดที่มีอู่จริง เรียงจากมากไปน้อย
  const provincesWithData = Object.entries(countByProvince)
    .map(([th, count]) => ({ th, count, slug: provinceSlug(th) }))
    .sort((a, b) => b.count - a.count)

  // เรียงลิสต์รวม
  const sorted = [...garages].sort((a, b) => {
    if (sortKey === 'reviews') return (b.review_count || 0) - (a.review_count || 0)
    if (sortKey === 'updated') return (b.updated_at || '').localeCompare(a.updated_at || '')
    return (b.rating || 0) - (a.rating || 0)
  })

  const sortTab = (k: SortKey, label: string) => (
    <Link
      href={`/benz-garages-thailand${k === 'rating' ? '' : `?sort=${k}`}`}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${sortKey === k ? 'bg-[#C9A961] text-[#1C1D2C]' : 'bg-white border'}`}
    >
      {label}
    </Link>
  )

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Hero */}
      <header className="mb-6">
        <p className="text-xs tracking-widest text-[#C9A961] font-bold mb-1">CHUTIBENZ DIRECTORY</p>
        <h1 className="text-3xl font-bold mb-2">รวมอู่เบนซ์ทั่วไทย</h1>
        <p className="text-gray-600 max-w-2xl">
          ค้นหาอู่ซ่อมเบนซ์ตามจังหวัด พร้อมข้อมูลติดต่อ พิกัด แผนที่ และคะแนนรีวิว
          เพื่อช่วยให้เจ้าของรถหาข้อมูลเบื้องต้นได้ง่ายขึ้น
        </p>
      </header>

      {/* CTA / province jump — เฉพาะจังหวัดที่มีอู่จริง */}
      {provincesWithData.length > 0 && (
        <section className="mb-7">
          <h2 className="text-lg font-bold mb-3">รวมอู่เบนซ์ตามจังหวัด</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {provincesWithData.map((p) => (
              <Link
                key={p.slug}
                href={`/benz-garages/${p.slug}`}
                className="rounded-xl border bg-white px-3 py-3 hover:border-[#C9A961] hover:shadow-sm transition"
              >
                <div className="font-semibold text-sm">{p.th}</div>
                <div className="text-xs text-gray-500 mt-0.5">{p.count} อู่</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sort + ค้นหา + list */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-lg font-bold">อู่เบนซ์ทั้งหมด ({garages.length})</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">เรียงตาม:</span>
            {sortTab('rating', 'คะแนน')}
            {sortTab('reviews', 'รีวิว')}
            {sortTab('updated', 'อัปเดตล่าสุด')}
          </div>
        </div>

        <GarageSearch garages={sorted} />
      </section>

      <p className="text-xs text-gray-500 mt-8 text-center">
        ข้อมูลเพื่อการค้นหาเบื้องต้น โปรดตรวจสอบรายละเอียดกับอู่โดยตรงก่อนใช้บริการ
      </p>
    </div>
  )
}
