'use client'
// app/components/EbookCard.tsx — การ์ด eBook + ยิง event นับยอด (ไม่ระบุตัวตน)
// v2 (07-03): เลิกแจก PDF ตรง → กดการ์ดเปิด LINE ขอรับ Lite (lead funnel) · ปก/ดีไซน์คงเดิม
import { useCallback } from 'react'
const LINE_OA_ID = '@440ifncj'
const liteLineLink = (code: string) =>
  `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/?${encodeURIComponent('ขอรับ eBook Lite รุ่น ' + code)}`
type Book = { code: string; name: string; emoji: string; tagline: string }
export default function EbookCard({ book }: { book: Book }) {
  const logRequest = useCallback(() => {
    try {
      const payload = JSON.stringify({ code: book.code, version: 'LITE' })
      // sendBeacon = fire-and-forget ไม่บล็อกการเปิด LINE
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/ebook-download', new Blob([payload], { type: 'application/json' }))
      } else {
        fetch('/api/ebook-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    } catch {
      /* ignore */
    }
  }, [book.code])
  return (
    <a
      href={liteLineLink(book.code)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={logRequest}
      className="group bg-white border border-gray-200 hover:border-[#C9A961] hover:shadow-md transition overflow-hidden"
    >
      <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/ebooks/${book.code}_cover.jpg`}
          alt={`${book.code} — ${book.name} eBook cover`}
          className="w-full h-full object-cover group-hover:scale-105 transition"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <div className="font-serif font-medium text-base text-gray-900 group-hover:text-[#C9A961]">
          {book.emoji} {book.code}
        </div>
        <div className="text-xs text-[#8B7355] mt-1 line-clamp-1">{book.name}</div>
        <div className="text-[10px] text-gray-500 mt-1 line-clamp-1">{book.tagline}</div>
        <div className="text-[11px] text-[#06C755] mt-2 font-medium flex items-center gap-1">
          <span>💬</span> ขอรับ Lite ทาง LINE
        </div>
      </div>
    </a>
  )
}
