// lib/rate-limit.ts — Supabase-backed rate limiter (shared across serverless instances)
// ใช้ table public.rate_limits (สร้างด้วย rate-limits-table.sql ก่อน)
// ปรัชญา: FAIL-OPEN — ถ้า DB error ให้ปล่อยผ่าน (return true) จะได้ไม่บล็อกลูกค้าจริงตอนระบบมีปัญหา

import { createClient } from '@supabase/supabase-js'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

/** ดึง IP ผู้เรียกจาก header (Vercel ตั้ง x-forwarded-for ให้) */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || ''
  const first = xff.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

/**
 * true = อนุญาต · false = เกินลิมิต (ควรตอบ 429)
 * @param bucket  คีย์เช่น `leads:1.2.3.4`
 * @param limit   จำนวนครั้งสูงสุดในหน้าต่างเวลา
 * @param windowSec  ความยาวหน้าต่าง (วินาที)
 */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const sb = svc()
    const since = new Date(Date.now() - windowSec * 1000).toISOString()

    // ลบแถวเก่ากว่าหน้าต่างของ bucket นี้ทิ้ง (กันตารางบวม + ทำ cleanup ไปในตัว)
    await sb.from('rate_limits').delete().eq('bucket', bucket).lt('created_at', since)

    // นับที่เหลือ = จำนวนครั้งในหน้าต่างเวลา
    const { count } = await sb
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket)
      .gte('created_at', since)

    if ((count ?? 0) >= limit) return false

    await sb.from('rate_limits').insert({ bucket })
    return true
  } catch {
    return true // fail-open
  }
}
