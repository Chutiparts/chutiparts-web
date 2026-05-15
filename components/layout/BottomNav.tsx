'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LINE_OA_URL, PHONE_TEL } from '@/lib/constants'

// Mobile-only sticky bottom nav (PRD requirement)
export default function BottomNav() {
  const pathname = usePathname()
  // Don't show on admin or intake form pages
  if (pathname.startsWith('/admin') || pathname === '/intake' || pathname === '/intake/success') {
    return null
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
      <div className="grid grid-cols-3 gap-1">
        <a
          href={LINE_OA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center py-3 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm"
        >
          <span className="text-xl">💬</span>
          <span className="text-xs mt-1">LINE</span>
        </a>
        <Link
          href="/intake"
          className="flex flex-col items-center justify-center py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm"
        >
          <span className="text-xl">📋</span>
          <span className="text-xs mt-1">ส่งอาการรถ</span>
        </Link>
        <a
          href={PHONE_TEL}
          className="flex flex-col items-center justify-center py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm"
        >
          <span className="text-xl">📞</span>
          <span className="text-xs mt-1">โทร</span>
        </a>
      </div>
    </nav>
  )
}
