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
  title: "ChutiParts - คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี",
  description: "อะไหล่ Mercedes-Benz มือสอง OEM แท้ 100% รับประกัน 15 วัน ส่งทั่วไทย",
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

