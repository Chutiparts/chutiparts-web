'use client'

import { usePathname } from 'next/navigation'
import { LINE_OA_URL } from '@/lib/constants'

// Desktop-only floating LINE button (bottom-right)
export default function FloatingLine() {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null

  return (
    <a
      href={LINE_OA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden md:flex fixed bottom-6 right-6 z-30 h-14 w-14 items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white text-2xl shadow-lg hover:scale-110 transition"
      aria-label="ทักทาย Line"
      title="คุยกับเราใน Line"
    >
      💬
    </a>
  )
}
