// app/layout.tsx — Root layout (REPLACES existing if needed)
import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import BottomNav from '@/components/layout/BottomNav'
import FloatingLine from '@/components/layout/FloatingLine'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://chutiparts-web.vercel.app'),
  title: {
    default: 'ChutiParts ⭐ | คลังอะไหล่ Mercedes-Benz มือสอง OEM แท้',
    template: '%s | ChutiParts'
  },
  description: 'คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี OEM แท้ 100% รับประกัน 15 วัน ส่งทั่วไทย — เชี่ยวชาญ W124 W126 W140 W201 W202 W210',
  keywords: ['อะไหล่เบนซ์','อะไหล่ Mercedes-Benz','อะไหล่มือสอง','W124','W126','W140','W201','W202','W210','AMG','OEM','ChutiParts'],
  authors: [{ name: 'ChutiParts' }],
  creator: 'ChutiParts',
  publisher: 'ChutiParts',
  openGraph: {
    title: 'ChutiParts ⭐ | คลังอะไหล่ Mercedes-Benz มือสอง OEM แท้',
    description: 'คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี OEM แท้ 100% รับประกัน 15 วัน ส่งทั่วไทย',
    url: 'https://chutiparts-web.vercel.app',
    siteName: 'ChutiParts',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ChutiParts - คลังอะไหล่ Mercedes-Benz มือสอง' }],
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChutiParts ⭐ | คลังอะไหล่ Mercedes-Benz มือสอง OEM แท้',
    description: 'คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี OEM แท้ 100%',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  verification: {
    google: 'wnRBO1fGy6YJPXBKmm5bS5mhTiOF45wEEbJ53d3N97Q',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen flex flex-col bg-gray-50 text-gray-900 antialiased">
        <Header />
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
        <Footer />
        <BottomNav />
        <FloatingLine />
      </body>
    </html>
  )
}
