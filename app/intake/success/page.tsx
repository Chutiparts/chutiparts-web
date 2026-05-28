// app/intake/success/page.tsx — Confirmation + LINE deep link
import Link from 'next/link'
import { LINE_OA_URL, PHONE_TEL } from '@/lib/constants'

export const metadata = {
  title: 'ส่งเคสสำเร็จ — ChutiBenz',
}

export default function SuccessPage({ searchParams }: {
  searchParams: { case?: string; line?: string }
}) {
  const caseNumber = searchParams.case || ''
  const lineUrl = searchParams.line ? decodeURIComponent(searchParams.line) : LINE_OA_URL

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-7xl mb-4">✅</div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ได้รับเคสของคุณแล้ว!
        </h1>

        {caseNumber && (
          <div className="rounded-lg bg-gray-100 p-3 mb-6">
            <p className="text-sm text-gray-600">Case ID</p>
            <p className="text-xl font-mono font-bold">{caseNumber}</p>
          </div>
        )}

        <p className="text-gray-700 mb-6">
          ทีม ChutiBenz จะติดต่อกลับภายใน <strong className="text-green-600">4 ชั่วโมง</strong>
          <br />
          <span className="text-sm text-gray-500">(เวลาทำการ 9:00-18:00)</span>
        </p>

        {lineUrl && (
          <a href={lineUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold text-lg mb-3"
          >
            💬 เปิด LINE คุยต่อทันที
          </a>
        )}

        <a href={PHONE_TEL}
          className="block w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold mb-3"
        >
          📞 โทร 081-828-5855
        </a>

        <div className="border-t border-gray-200 pt-6 mt-6">
          <h2 className="font-bold text-gray-900 mb-3">ระหว่างรอ ลองอ่าน</h2>
          <div className="space-y-2 text-left">
            <Link href="/articles" className="block text-sm text-blue-600 hover:underline">
              📖 บทความความรู้สำหรับ Mercedes-Benz รุ่นเก่า
            </Link>
            <Link href="/" className="block text-sm text-blue-600 hover:underline">
              🛒 ดูอะไหล่ในสต็อก
            </Link>
          </div>
        </div>

        <Link href="/"
          className="inline-block mt-6 text-sm text-gray-500 hover:text-gray-700"
        >
          ← กลับหน้าแรก
        </Link>
      </div>
    </div>
  )
}
