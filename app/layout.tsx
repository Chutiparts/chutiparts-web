// app/layout.tsx — ChutiBenz root layout
// 2026-07-04: + <LanguageProvider> (TH/EN site-wide) · footer → <SiteFooter/>
// (metadata block UNCHANGED — ถ้าไม่แน่ใจ ให้คงของเดิม แล้วแก้แค่ 3 จุดตาม README)

import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import SiteFooter from '@/components/layout/SiteFooter'
import { CartProvider } from './context/CartContext'
import { LanguageProvider } from './context/LanguageContext' 
import { FlagsProvider } from './context/FlagsContext'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import ContactHub from '@/components/ContactHub'
import SalesChat from '@/components/SalesChat'
const SITE_URL = 'https://chutibenz.com'
const BRAND = 'ChutiBenz'

// ============================================================
// METADATA — Title bar + SEO + Open Graph + Twitter (ไม่เปลี่ยน)
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
    google: [
      'wnRBO1fGy6YJPXBKmm5bS5mhTiOF45wEEbJ53d3N97Q',
      '8ajqV-H5cbszbcCwvwHQ7Cxs-r7Gt4jpPa3IYSuyDFA',
    ],
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
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <LanguageProvider>
          <FlagsProvider>           <CartProvider>
            <Header />
            <main>{children}</main>
            <SiteFooter />
            <Analytics />
            <SpeedInsights />
            <ContactHub />
            <SalesChat />
          </CartProvider>           </FlagsProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
