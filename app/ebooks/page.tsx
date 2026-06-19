// app/ebooks/page.tsx — Phase eBook (server wrapper) — metadata + render client
// v2 (06-17): ขยาย metadata ให้ครอบทุกหมวด — Free (Lite + W140 Survival Pack) / Classic Guide (W123/W126/W140/W201/W202/W210) / Premium (W124 M119, S70 AMG)
import type { Metadata } from 'next'
import EbooksClient from './EbooksClient'

const SITE_URL = 'https://chutibenz.com'

export const metadata: Metadata = {
  title: 'eBook คู่มือ Mercedes-Benz คลาสสิก — ฟรี / Classic Guide / Premium',
  description:
    'รวม eBook คู่มือ Mercedes-Benz คลาสสิก: ฉบับ LITE ฟรี (W202/W210) · W140 Survival Pack คู่มือซื้อมือสองฟรี 16 หน้า · Classic Guide รายรุ่น W123/W126/W140/W201/W202/W210 เริ่ม 199 บาท · Premium Project W124 M119 V8 Swap และ GENESIS S70 AMG — โดย ChutiBenz',
  keywords: [
    'คู่มือเบนซ์คลาสสิก', 'eBook Mercedes-Benz', 'คู่มือซื้อ W140', 'W140 Survival Pack',
    'คู่มือ W123', 'คู่มือ W126', 'คู่มือ W201', 'คู่มือ W202', 'คู่มือ W210',
    'W124 M119 V8 Swap', 'S70 AMG', 'GENESIS', 'ChutiBenz', 'Mr.Chuti',
  ],
  alternates: { canonical: `${SITE_URL}/ebooks` },
  openGraph: {
    title: 'eBook คู่มือ Mercedes-Benz คลาสสิก — ฟรี / Classic Guide / Premium',
    description:
      'LITE ฟรี + W140 Survival Pack ฟรี · Classic Guide รายรุ่น W123/W126/W140/W201/W202/W210 เริ่ม 199 บาท · Premium W124 M119 V8 Swap / S70 AMG',
    url: `${SITE_URL}/ebooks`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'eBook คู่มือ Mercedes-Benz คลาสสิก — ChutiBenz',
    description:
      'Lite ฟรี · W140 Survival Pack ฟรี · Classic Guide รายรุ่นเริ่ม 199 บาท · Premium Project W124 M119 / S70 AMG',
  },
}

export default function EbooksPage() {
  return <EbooksClient />
}
