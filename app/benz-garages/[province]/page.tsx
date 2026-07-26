// app/benz-garages/[province]/page.tsx — หน้าจังหวัด (province)
// spec §โครงหน้าเว็บ 2) หน้าจังหวัด (H1 · intro · summary · list · FAQ)
// อัปเดต 26 ก.ค. 2026: เอาป้ายเดโมออก (มีอู่จริงแล้ว)
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { provinceBySlug } from '@/lib/benz-provinces'
import { GarageCard, type Garage } from '../../garage/_components'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ province: string }> }) {
  const { province } = await params
  const p = provinceBySlug(province)
  if (!p) return { title: 'ไม่พบจังหวัด' }
  return {
    title: `อู่เบนซ์ใน${p.th} | ChutiBenz`,
    description: `รวมอู่ซ่อมเบนซ์ใน${p.th} พร้อมเบอร์โทร พิกัด แผนที่ และคะแนนรีวิว ค้นหาอู่เบนซ์ใกล้คุณบน ChutiBenz`,
    alternates: { canonical: `/benz-garages/${p.slug}` },
  }
}

export default async function ProvincePage({ params }: { params: Promise<{ province: string }> }) {
  const { province } = await params
  const p = provinceBySlug(province)
  if (!p) notFound()

  const supabase = await createClient()
  const { data } = await supabase
    .from('garages')
    .select('id, name_th, name_en, slug, province, district, phone, website, rating, review_count, maps_url, classification, updated_at')
    .eq('status', 'published')
    .eq('province', p.th)
    .order('rating', { ascending: false, nullsFirst: false })
  const garages = (data || []) as Garage[]

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* breadcrumb */}
      <nav className="text-xs text-gray-500 mb-3">
        <Link href="/benz-garages-thailand" className="hover:underline">อู่เบนซ์ทั่วไทย</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">{p.th}</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-3xl font-bold mb-2">อู่เบนซ์ใน{p.th}</h1>
        <p className="text-gray-600">
          รวมอู่ซ่อมเบนซ์ในพื้นที่{p.th} — พบ <b>{garages.length}</b> อู่ พร้อมข้อมูลติดต่อ พิกัด และคะแนนรีวิวเบื้องต้น
        </p>
      </header>

      {garages.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
          ยังไม่พบอู่ใน{p.th} ลองเลือกจังหวัดอื่นหรือกลับมาดูใหม่อีกครั้ง
          <div className="mt-3">
            <Link href="/benz-garages-thailand" className="text-[#2e6ba8] font-semibold">← กลับหน้ารวมทุกจังหวัด</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {garages.map((g) => (
            <GarageCard key={g.id} g={g} />
          ))}
        </div>
      )}

      {/* FAQ (SEO) */}
      <section className="mt-10">
        <h2 className="text-xl font-bold mb-3">คำถามที่พบบ่อย</h2>
        <div className="space-y-3">
          <details className="rounded-lg border bg-white p-4">
            <summary className="font-semibold cursor-pointer">หาอู่เบนซ์ใน{p.th}จากที่ไหนได้บ้าง?</summary>
            <p className="text-sm text-gray-600 mt-2">
              หน้านี้รวมอู่ซ่อมเบนซ์ใน{p.th}จากข้อมูลสาธารณะ พร้อมเบอร์โทรและพิกัดแผนที่
              แนะนำให้โทรสอบถามกับอู่โดยตรงก่อนเข้ารับบริการทุกครั้ง
            </p>
          </details>
          <details className="rounded-lg border bg-white p-4">
            <summary className="font-semibold cursor-pointer">ข้อมูลอู่อัปเดตบ่อยแค่ไหน?</summary>
            <p className="text-sm text-gray-600 mt-2">
              ข้อมูลมีการตรวจทานเป็นระยะ แต่รายละเอียดบางอย่าง เช่น เวลาเปิด-ปิดหรือบริการ
              อาจเปลี่ยนแปลงได้ ควรยืนยันกับอู่ก่อนใช้บริการ
            </p>
          </details>
        </div>
      </section>

      <p className="text-xs text-gray-500 mt-8 text-center">
        ข้อมูลเพื่อการค้นหาเบื้องต้น โปรดตรวจสอบรายละเอียดกับอู่โดยตรงก่อนใช้บริการ
      </p>
    </div>
  )
}
