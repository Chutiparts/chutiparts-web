import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "./context/CartContext";
import CartUI from "./components/CartUI";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://chutiparts-web.vercel.app"),
  title: {
    default: "ChutiParts ⭐ | คลังอะไหล่ Mercedes-Benz มือสอง OEM แท้",
    template: "%s | ChutiParts",
  },
  description:
    "คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี OEM แท้ 100% รับประกัน 15 วัน ส่งทั่วไทย หัวเกียร์ AMG, ไฟท้าย W124, Vacuum Pump W140 ติดต่อ Line: mr.chuti5988",
  keywords: [
    "อะไหล่เบนซ์",
    "อะไหล่ Mercedes-Benz",
    "อะไหล่มือสอง",
    "อะไหล่ Benz มือสอง",
    "W124",
    "W140",
    "W212",
    "W213",
    "AMG",
    "OEM แท้",
    "อะไหล่รถยนต์",
    "ChutiParts",
    "ไฟท้าย Mercedes-Benz",
    "หัวเกียร์ AMG",
  ],
  authors: [{ name: "ChutiParts" }],
  creator: "ChutiParts",
  publisher: "ChutiParts",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  alternates: {
    canonical: "https://chutiparts-web.vercel.app",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          {children}
          <CartUI />
        </CartProvider>
      </body>
    </html>
  );
}

