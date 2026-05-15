import Link from 'next/link'
import { LINE_OA_URL, PHONE, PHONE_TEL } from '@/lib/constants'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">ChutiParts ⭐</h3>
            <p className="text-sm leading-relaxed">
              คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี
              <br />
              เชี่ยวชาญรุ่นคลาสสิค W124, W126, W140, W201, W202, W210
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">เมนู</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-yellow-400">หน้าแรก</Link></li>
              <li><Link href="/search" className="hover:text-yellow-400">ค้นหาอะไหล่</Link></li>
              <li><Link href="/articles" className="hover:text-yellow-400">บทความความรู้</Link></li>
              <li><Link href="/intake" className="hover:text-yellow-400 font-semibold">📋 ส่งอาการรถ</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">ติดต่อเรา</h3>
            <ul className="space-y-2 text-sm">
              <li><a href={LINE_OA_URL} target="_blank" rel="noopener noreferrer" className="hover:text-green-400">💬 Line: mr.chuti5988</a></li>
              <li><a href={PHONE_TEL} className="hover:text-blue-400">📞 {PHONE}</a></li>
              <li>📍 ส่งทั่วประเทศไทย</li>
            </ul>
          </div>

          {/* Trust */}
          <div>
            <h3 className="text-lg font-bold text-white mb-3">รับประกัน</h3>
            <ul className="space-y-2 text-sm">
              <li>✅ อะไหล่ OEM แท้ 100%</li>
              <li>✅ รับประกัน 15 วัน</li>
              <li>✅ ตรวจสอบก่อนส่ง</li>
              <li>✅ ตอบกลับใน 4 ชั่วโมง</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <p>© 2026 ChutiParts. คลังอะไหล่เบนซ์มือสองคุณภาพดี</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-300">นโยบายความเป็นส่วนตัว</Link>
            <Link href="/about" className="hover:text-gray-300">เกี่ยวกับเรา</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
