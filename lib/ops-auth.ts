// lib/ops-auth.ts — ตรวจสิทธิ์ owner สำหรับหน้า/API ใต้ /ops-x7k2m9
//
// เดิมบางหน้าใช้ "URL ลับ" อย่างเดียว (ไม่มีรหัส) — ใครได้ลิงก์ไปก็เปิดได้
// ไฟล์นี้รวม logic เดิมที่กระจายอยู่ตาม page.tsx ให้เป็นที่เดียว
// ใช้ cookie 'ops_admin' ตัวเดียวกับ Ledger/Stock/เอกสาร → ล็อกอินครั้งเดียวใช้ได้ทุกหน้า
import { cookies } from 'next/headers'
import { createHash, timingSafeEqual } from 'node:crypto'

export const OPS_COOKIE = 'ops_admin'

/** true เมื่อ cookie ตรงกับ ADMIN_OPS_SECRET · ถ้าไม่ได้ตั้ง env ให้ถือว่าไม่ผ่าน (fail closed) */
export async function opsAuthed(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false
  return (await cookies()).get(OPS_COOKIE)?.value === secret
}

/**
 * โทเคนสำหรับให้ API ของเราเรียกหากันเอง (server → server)
 *
 * ทำไมถึงแฮชจาก ADMIN_OPS_SECRET แทนที่จะสร้าง env ตัวใหม่:
 * ตัวนี้ตั้งไว้ใน Vercel อยู่แล้ว (ทุกหน้า ops ใช้ล็อกอิน) → ไม่มีช่วงที่ระบบพัง
 * เพราะลืมใส่ค่าใหม่ · และตัวโทเคนเป็นแฮช ไม่ใช่รหัสจริง หลุดไปก็ล็อกอินไม่ได้
 */
export function internalToken(): string {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return ''
  return createHash('sha256').update(`chutibenz-internal-call:${secret}`).digest('hex')
}

/** เทียบสตริงแบบใช้เวลาคงที่ — กันเดาทีละตัวจากเวลาที่ตอบกลับ */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
