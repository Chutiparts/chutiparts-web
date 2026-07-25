// lib/ops-auth.ts — ตรวจสิทธิ์ + RBAC สำหรับหน้า/API ใต้ /ops-x7k2m9
//
// RBAC (blueprint §7) แบบ lean — ไม่ทำ login ใหม่ (§18):
//   ใช้ cookie 'ops_admin' เดิม · แยกบทบาทจาก "รหัสที่ตรง"
//     ADMIN_OPS_SECRET     → owner    (ทุกสิทธิ์ · ของเดิม)
//     OPS_REVIEWER_SECRET  → reviewer
//     OPS_OPERATOR_SECRET  → operator
//     OPS_VIEWER_SECRET    → viewer
//   ไม่ตั้ง role secret → มีแค่ owner (พฤติกรรมเดิมเป๊ะ · backward compatible)
import { cookies } from 'next/headers'
import { createHash, timingSafeEqual } from 'node:crypto'
import { can, type Role, type Permission } from './ops-roles'

export const OPS_COOKIE = 'ops_admin'

/** เทียบสตริงแบบใช้เวลาคงที่ — กันเดาทีละตัวจากเวลาที่ตอบกลับ */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// role → ชื่อ env ของรหัส (owner มาก่อนเสมอ)
const ROLE_ENV: [Role, string][] = [
  ['owner', 'ADMIN_OPS_SECRET'],
  ['reviewer', 'OPS_REVIEWER_SECRET'],
  ['operator', 'OPS_OPERATOR_SECRET'],
  ['viewer', 'OPS_VIEWER_SECRET'],
]

/** รหัสนี้ = บทบาทไหน (ใช้ตอน login) · null ถ้าไม่ตรงบทบาทใดเลย */
export function matchRole(pw: string): Role | null {
  if (!pw) return null
  for (const [role, env] of ROLE_ENV) {
    const secret = process.env[env]
    if (secret && safeEqual(pw, secret)) return role
  }
  return null
}

/** บทบาทของผู้ใช้ปัจจุบันจาก cookie · null ถ้ายังไม่ล็อกอิน */
export async function opsRole(): Promise<Role | null> {
  const val = (await cookies()).get(OPS_COOKIE)?.value
  if (!val) return null
  return matchRole(val)
}

/** ล็อกอินอยู่ไหม (บทบาทใดก็ได้) — ใช้เป็น gate เปิดดูหน้า */
export async function opsAuthed(): Promise<boolean> {
  return (await opsRole()) !== null
}

/** มีสิทธิ์ทำ action นี้ไหม — ใช้ guard ฝั่ง server ทุก action สำคัญ (§7) */
export async function requirePerm(perm: Permission): Promise<boolean> {
  return can(await opsRole(), perm)
}

/** ชื่อผู้ทำรายการสำหรับ audit (§7: ผูก actor) */
export async function currentActor(): Promise<string> {
  return (await opsRole()) ?? 'unknown'
}

/**
 * โทเคนสำหรับให้ API ของเราเรียกหากันเอง (server → server)
 * แฮชจาก ADMIN_OPS_SECRET ที่มีใน Vercel อยู่แล้ว → ไม่ต้องเพิ่ม env ใหม่ให้ลืม
 */
export function internalToken(): string {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return ''
  return createHash('sha256').update(`chutibenz-internal-call:${secret}`).digest('hex')
}
