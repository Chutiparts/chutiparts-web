// app/ebooks/page.tsx — Phase eBook (server wrapper) — metadata + render client
import type { Metadata } from 'next'
import EbooksClient from './EbooksClient'

const SITE_URL = 'https://chutibenz.com'

export const metadata: Metadata = {
  title: 'eBook คู่มือ Mercedes-Benz คลาสสิก — W202 / W210 (Lite ฟรี / Full)',
  description:
    'ดาวน์โหลด eBook คู่มือ Mercedes-Benz คลาสสิก W202 / W210 — ฉบับ LITE ฟรี · ฉบับเต็ม (Full) เนื้อหาครบ 199 บาท · Bundle W202+W210 349 บาท · โดย ChutiBenz',
  alternates: { canonical: `${SITE_URL}/ebooks` },
  openGraph: {
    title: 'eBook คู่มือ Mercedes-Benz คลาสสิก — ChutiBenz',
    description: 'Lite ฟรี · Full 199 บาท · Bundle W202+W210 349 บาท',
    url: `${SITE_URL}/ebooks`,
    type: 'website',
  },
}

export default function EbooksPage() {
  return <EbooksClient />
}
