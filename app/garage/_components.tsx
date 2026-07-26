// app/garage/_components.tsx — ชิ้นส่วนใช้ร่วม directory อู่เบนซ์
import Link from 'next/link'

export type Garage = {
  id: string
  name_th: string
  name_en?: string | null
  slug?: string | null
  province?: string | null
  district?: string | null
  address_raw?: string | null
  phone?: string | null
  website?: string | null
  rating?: number | null
  review_count?: number | null
  lat?: number | null
  lng?: number | null
  maps_url?: string | null
  classification?: string | null
  description?: string | null
  updated_at?: string | null
}

const CLASS_LABEL: Record<string, string> = {
  benz_specialist: 'เบนซ์เฉพาะทาง',
  european_specialist: 'รถยุโรป',
  general_garage: 'อู่ทั่วไป',
}

export function Stars({ rating, count }: { rating?: number | null; count?: number | null }) {
  if (!rating) return <span className="text-xs text-gray-400">ยังไม่มีคะแนน</span>
  return (
    <span className="text-sm">
      <span className="text-yellow-500">★</span> <b>{rating.toFixed(1)}</b>
      {count ? <span className="text-gray-400 text-xs"> ({count})</span> : null}
    </span>
  )
}

export function GarageCard({ g }: { g: Garage }) {
  const href = g.slug ? `/garage/${g.slug}` : '#'
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-white p-4 hover:border-[#C9A961] hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold truncate">{g.name_th}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            📍 {g.province || '-'}
            {g.district && g.district !== '-' ? `, ${g.district}` : ''}
          </div>
        </div>
        {g.classification && CLASS_LABEL[g.classification] && (
          <span className="shrink-0 bg-yellow-100 text-yellow-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {CLASS_LABEL[g.classification]}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <Stars rating={g.rating} count={g.review_count} />
        <span className="text-xs text-[#2e6ba8]">ดูรายละเอียด →</span>
      </div>
    </Link>
  )
}

export function DemoBanner() {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-800">
      🧪 <b>เดโม · ข้อมูลตัวอย่าง</b> — ระหว่างพัฒนา · ข้อมูลจริงจะดึงจาก Google Maps แล้วผ่านการตรวจก่อนเผยแพร่ ·
      โปรดโทรเช็กกับอู่ก่อนใช้บริการ
    </div>
  )
}
