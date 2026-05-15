'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 max-w-7xl flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span>🚗</span>
            <span className="text-gray-900">ChutiParts</span>
            <span className="text-yellow-500">⭐</span>
          </Link>

          {/* Desktop menu */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-yellow-600">หน้าแรก</Link>
            <Link href="/search" className="hover:text-yellow-600">🔍 ค้นหา</Link>
            <Link href="/articles" className="hover:text-yellow-600">📖 บทความ</Link>
            <Link href="/garages" className="hover:text-yellow-600">🔨 อู่/ร้าน</Link>
            <Link
              href="/intake"
              className="rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 font-semibold"
            >
              📋 ส่งอาการรถ
            </Link>
          </nav>

          {/* Mobile burger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2"
            aria-label="เปิดเมนู"
          >
            <span className="text-2xl">{open ? '✕' : '☰'}</span>
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <nav className="md:hidden border-t border-gray-100 bg-white">
            <div className="container mx-auto px-4 py-3 flex flex-col gap-2 text-sm font-medium">
              <Link href="/" onClick={() => setOpen(false)} className="py-2">หน้าแรก</Link>
              <Link href="/search" onClick={() => setOpen(false)} className="py-2">🔍 ค้นหา</Link>
              <Link href="/articles" onClick={() => setOpen(false)} className="py-2">📖 บทความ</Link>
              <Link href="/garages" onClick={() => setOpen(false)} className="py-2">🔨 อู่/ช่าง</Link>
              <Link href="/shops" onClick={() => setOpen(false)} className="py-2">🛒 ร้านอะไหล่</Link>
              <Link
                href="/intake"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-lg bg-yellow-500 text-white px-4 py-3 font-semibold text-center"
              >
                📋 ส่งอาการรถ
              </Link>
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
