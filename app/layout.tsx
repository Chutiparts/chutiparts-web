// app/layout.tsx — ChutiBenz root layout
// 2026-06-10: เพิ่ม <CartProvider> ครอบทั้งแอป (จำเป็นสำหรับระบบตะกร้า)

import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import { CartProvider } from './context/CartContext'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import ContactHub from '@/components/ContactHub'

const SITE_URL = 'https://chutibenz.com'
const BRAND = 'ChutiBenz'

// ============================================================
// METADATA — Title bar + SEO + Open Graph + Twitter
// ============================================================
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: `${BRAND} | คลังอะไหล่เบนซ์มือสอง OEM แท้ W124 W126 W140 W210`,
    template: `%s | ${BRAND}`,
  },

  description: 'ขายอะไหล่เบนซ์มือสอง OEM แท้ สำหรับ W124 W126 W140 W201 W202 W210 รับประกัน 15 วัน ส่งทั่วไทย โดยทีม Mr.Chuti',

  keywords: [
    'อะไหล่เบนซ์', 'อะไหล่ Mercedes-Benz', 'อะไหล่เบนซ์มือสอง', 'อะไหล่มือสอง OEM แท้',
    'W124', 'W126', 'W140', 'W201', 'W202', 'W210',
    'อะไหล่ W140', 'อะไหล่ W124', 'อะไหล่ W210',
    'AMG', 'OEM', 'ChutiBenz', 'Mr.Chuti', 'chutibenz', 'chutibenz.com',
    'อะไหล่เบนซ์คลาสสิค', 'S-Class', 'E-Class', 'C-Class',
    'หัวแตงโม', 'ปลาวาฬ', 'S70 AMG', 'M120', 'M119', 'M104',
  ],

  authors: [{ name: BRAND }],
  creator: BRAND,
  publisher: BRAND,
  applicationName: BRAND,

  alternates: {
    canonical: SITE_URL,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  openGraph: {
    type: 'website',
    locale: 'th_TH',
    url: SITE_URL,
    siteName: BRAND,
    title: `${BRAND} | คลังอะไหล่เบนซ์มือสอง OEM แท้ W124 W126 W140 W210`,
    description: 'ขายอะไหล่เบนซ์มือสอง OEM แท้ รับประกัน 15 วัน ส่งทั่วไทย — เชี่ยวชาญ W124 W126 W140 W201 W202 W210',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `${BRAND} - คลังอะไหล่ Mercedes-Benz มือสอง OEM แท้`,
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: `${BRAND} | คลังอะไหล่เบนซ์มือสอง OEM แท้`,
    description: 'อะไหล่เบนซ์มือสอง OEM แท้ สำหรับ Mercedes-Benz คลาสสิก รับประกัน 15 วัน',
    images: ['/og-image.png'],
  },

  verification: {
    google: 'wnRBO1fGy6YJPXBKmm5bS5mhTiOF45wEEbJ53d3N97Q',
  },

  viewport: {
    width: 'device-width',
    initialScale: 1,
  },

  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  category: 'automotive',
}

// ============================================================
// ROOT LAYOUT
// ============================================================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <CartProvider>
          <Header />
          <main>{children}</main>

          {/* Footer (basic) */}
          <footer className="bg-[#1C1D2C] text-[#B8B3A7] mt-12 py-10">
            <div className="container mx-auto px-4 max-w-7xl grid md:grid-cols-3 gap-8 text-sm">
              <div>
                <h3 className="font-serif text-lg text-[#F2EDE0] mb-2">ChutiBenz</h3>
                <p className="text-xs leading-relaxed">
                  คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี<br />
                  เชี่ยวชาญรุ่นคลาสสิค W124, W126, W140, W201, W202, W210
                </p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-[#C9A961] tracking-widest mb-3">เมนู</h3>
                <ul className="space-y-1">
                  <li><a href="/" className="hover:text-[#C9A961]">หน้าแรก</a></li>
                  <li><a href="/search" className="hover:text-[#C9A961]">ค้นหาอะไหล่</a></li>
                  <li><a href="/articles" className="hover:text-[#C9A961]">บทความความรู้</a></li>
                  <li><a href="/intake" className="hover:text-[#C9A961]">📋 ส่งอาการรถ</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-medium text-[#C9A961] tracking-widest mb-3">ติดต่อเรา</h3>
                <ul className="space-y-1">
                  <li><a href="https://line.me/R/ti/p/%40440ifncj" target="_blank" rel="noopener noreferrer" className="hover:text-[#C9A961]">💬 Line: mr.chuti5988</a></li>
                  <li><a href="tel:0818285855" className="hover:text-[#C9A961]">📞 081-828-5855</a></li>
                  <li>📍 ส่งทั่วประเทศไทย</li>
                </ul>
                <p className="text-[10px] mt-3 text-[#8B7355]">
                  © 2026 ChutiBenz · คลังอะไหล่เบนซ์มือสองคุณภาพดี
                </p>
              </div>
            </div>
          </footer>

          <Analytics />
          <SpeedInsights />
          <ContactHub />
        </CartProvider>
      </body>
    </html>
  )
}
