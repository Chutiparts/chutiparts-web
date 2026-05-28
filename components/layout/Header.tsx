// components/layout/Header.tsx — Quick fix (ไม่มี cart dependency)
// 20 พ.ค. 2026
//
// เวอร์ชันนี้: ลบ "🚗 ChutiBenz ⭐" + เปลี่ยนเป็น "ChutiBenz"
// ไม่ต้องสร้าง cart components ก่อน — apply ได้เลย build ผ่าน
// ภายหลังเมื่อทำ cart เสร็จ → ใช้ FIX-header-clean.txt แทน (มี CartButton)

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/vin-check', label: '🔍 เช็ค VIN ฟรี' },
  { href: '/search', label: '🔍 ค้นหา' },
  { href: '/articles', label: '📖 บทความ' },
  { href: '/garages', label: '🔨 อู่/ร้าน' },
  { href: '/intake', label: '📋 ส่งอาการรถ' },
]

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">

          {/* === BRAND — ข้อความเรียบ ๆ ไม่มี emoji === */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
            aria-label="ChutiBenz หน้าแรก"
          >
            <span className="font-serif text-xl md:text-2xl font-medium text-[#1C1D2C] tracking-tight group-hover:text-[#C9A961] transition">
              ChutiBenz
            </span>
            <span className="hidden md:inline text-[10px] tracking-[0.2em] text-[#8B7355] font-serif uppercase">
              Mercedes-Benz Parts
            </span>
          </Link>

          {/* === DESKTOP NAV === */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm font-medium transition rounded ${
                    active
                      ? 'text-[#C9A961]'
                      : 'text-gray-700 hover:text-[#C9A961]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* === RIGHT: CTA === */}
          <div className="flex items-center gap-2">
            <Link
              href="/intake"
              className="hidden md:inline-block bg-[#C9A961] hover:bg-[#D8B872] text-white font-medium px-4 py-2 text-sm tracking-wide transition rounded"
            >
              ส่งอาการรถ
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-gray-700"
              aria-label="เมนู"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* === MOBILE NAV === */}
        {mobileOpen && (
          <nav className="md:hidden py-3 border-t border-gray-100">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#C9A961] rounded"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/intake"
              onClick={() => setMobileOpen(false)}
              className="block mt-2 mx-3 bg-[#C9A961] text-white font-medium px-4 py-3 text-sm tracking-wide text-center rounded"
            >
              📋 ส่งอาการรถ
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
