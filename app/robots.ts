// app/robots.ts — Next.js dynamic robots.txt
// Phase 0 (2026-06-13) — แก้โดเมนให้เป็น chutibenz.com (เดิม live ชี้ vercel.app)
//
// วิธี deploy (GitHub web editor):
//   - ถ้ามีไฟล์ app/robots.ts อยู่แล้ว → Edit → เลือกทั้งหมด → ลบ → วางไฟล์นี้ → Commit
//   - ถ้ายังไม่มี → Add file → Create new file → path = app/robots.ts → วาง → Commit
//
// ⚠️ สำคัญ: hardcode โดเมนตรง ๆ (ไม่อ่านจาก VERCEL_URL/env) เพื่อกัน robots ชี้ vercel.app อีก

import type { MetadataRoute } from 'next'

const SITE_URL = 'https://chutibenz.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',          // API routes
          '/ops-x7k2m9/',   // หน้าแอดมินจริง (orders/leads) — กัน index
          '/admin/',        // เผื่อ path เก่า
          // หมายเหตุ: ไม่ disallow /_next/ — Google ต้องโหลด static assets เพื่อ render หน้า
        ],
      },
      {
        userAgent: ['Googlebot', 'Bingbot'],
        allow: '/',
        disallow: ['/api/', '/ops-x7k2m9/', '/admin/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
