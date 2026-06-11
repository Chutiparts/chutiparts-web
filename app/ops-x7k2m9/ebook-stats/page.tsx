// app/ops-x7k2m9/ebook-stats/page.tsx — สถิติยอดโหลด eBook (path ลับ ไม่ต้องล็อกอิน)
// ดึงจากตาราง events (event_name='ebook_download') แล้วสรุปยอดต่อรุ่น
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const NAMES: Record<string, string> = {
  W123: 'เบนซ์ตาหวาน',
  W124: 'รถถังเยอรมัน',
  W126: 'เจ้าพ่อเซี่ยงไฮ้',
  W140: 'ปลาวาฬปราบเสี่ย',
  W201: 'Baby-Benz',
  W202: 'เบนซ์จิ้มลิ้ม',
  W210: 'ตา 4 รู',
}

export default async function EbookStatsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('events')
    .select('event_data, created_at')
    .eq('event_name', 'ebook_download')
    .order('created_at', { ascending: false })
    .limit(5000)

  const rows = data ?? []

  // สรุปยอดต่อรุ่น
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const code = (r.event_data as any)?.code || 'unknown'
    counts[code] = (counts[code] || 0) + 1
  }
  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const total = rows.length

  const fmt = (d: string) =>
    new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
      <p className="text-[10px] tracking-[0.32em] text-[#8B7355] font-serif mb-1">
        ADMIN · EBOOK ANALYTICS
      </p>
      <h1 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-1">
        📊 ยอดดาวน์โหลด eBook
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        รวมทั้งหมด <strong className="text-[#C9A961]">{total}</strong> ครั้ง · อัปเดตอัตโนมัติทุกครั้งที่เปิดหน้านี้
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          ดึงข้อมูลไม่สำเร็จ: {error.message}
        </div>
      )}

      {/* สรุปต่อรุ่น */}
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-4 py-3">รุ่น</th>
              <th className="text-left font-medium px-4 py-3">ชื่อเล่น</th>
              <th className="text-right font-medium px-4 py-3">ยอดโหลด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summary.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  ยังไม่มีข้อมูลการโหลด
                </td>
              </tr>
            ) : (
              summary.map(([code, n]) => (
                <tr key={code} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{code}</td>
                  <td className="px-4 py-3 text-gray-500">{NAMES[code] || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#C9A961]">{n}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* รายการล่าสุด */}
      <h2 className="text-lg font-serif font-medium text-gray-900 mb-3">🕒 โหลดล่าสุด (20 รายการ)</h2>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-4 py-3">รุ่น</th>
              <th className="text-left font-medium px-4 py-3">เวลา</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.slice(0, 20).map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {(r.event_data as any)?.code || '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{fmt(r.created_at as string)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400 mt-6 leading-relaxed">
        หน้านี้เป็น path ลับสำหรับแอดมิน — ข้อมูลไม่ระบุตัวตน (เก็บแค่รุ่น + เวลา)
      </p>
    </section>
  )
}
