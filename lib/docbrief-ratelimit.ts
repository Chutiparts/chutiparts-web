// lib/docbrief-ratelimit.ts — Rate limiting (สเปก §1 "ต้องมี rate limiting")
//
// ออกแบบให้ไม่ต้องสร้างตารางใหม่ — นับจากข้อมูลที่มีอยู่แล้ว:
//   extract → นับ doc_metrics (1 แถว = 1 ครั้งที่เรียก Claude = 1 ครั้งที่เสียเงิน)
//   upload  → นับ doc_documents
//   login   → นับ doc_audit action='login.failed'
//
// ปรับเพดานได้ผ่าน env โดยไม่ต้องแก้โค้ด
import type { SupabaseClient } from '@supabase/supabase-js'

const int = (name: string, def: number) => {
  const v = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(v) && v > 0 ? v : def
}

export const LIMITS = {
  extractPerHour: int('DOCBRIEF_MAX_EXTRACT_PER_HOUR', 40),
  extractPerDay: int('DOCBRIEF_MAX_EXTRACT_PER_DAY', 150),
  uploadPerHour: int('DOCBRIEF_MAX_UPLOAD_PER_HOUR', 120),
  loginFailPer15Min: int('DOCBRIEF_MAX_LOGIN_FAIL', 5),
}

export interface RateResult {
  ok: boolean
  message?: string
  used?: number
  limit?: number
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

async function countSince(db: SupabaseClient, table: string, sinceIso: string): Promise<number> {
  try {
    const { count, error } = await db.from(table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sinceIso)
    if (error) return 0 // นับไม่ได้ → ปล่อยผ่าน ดีกว่าบล็อกงานจริง
    return count ?? 0
  } catch {
    return 0
  }
}

async function countLoginFails(db: SupabaseClient, sinceIso: string): Promise<number> {
  try {
    const { count, error } = await db.from('doc_audit')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login.failed')
      .gte('created_at', sinceIso)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/** เรียก Claude ได้อีกไหม — ตัวที่สำคัญที่สุดเพราะเสียเงินจริง */
export async function checkExtractLimit(db: SupabaseClient): Promise<RateResult> {
  const hour = await countSince(db, 'doc_metrics', ago(3_600_000))
  if (hour >= LIMITS.extractPerHour) {
    return {
      ok: false, used: hour, limit: LIMITS.extractPerHour,
      message: `อ่านเอกสารครบ ${LIMITS.extractPerHour} ใบใน 1 ชั่วโมงแล้ว — รอสักครู่แล้วลองใหม่`,
    }
  }
  const day = await countSince(db, 'doc_metrics', ago(86_400_000))
  if (day >= LIMITS.extractPerDay) {
    return {
      ok: false, used: day, limit: LIMITS.extractPerDay,
      message: `อ่านเอกสารครบ ${LIMITS.extractPerDay} ใบใน 24 ชั่วโมงแล้ว — กันค่าใช้จ่ายบานปลาย`,
    }
  }
  return { ok: true, used: hour, limit: LIMITS.extractPerHour }
}

/** อัปโหลดได้อีกไหม — กันยิงไฟล์รัว ๆ จนเปลือง storage */
export async function checkUploadLimit(db: SupabaseClient): Promise<RateResult> {
  const hour = await countSince(db, 'doc_documents', ago(3_600_000))
  if (hour >= LIMITS.uploadPerHour) {
    return {
      ok: false, used: hour, limit: LIMITS.uploadPerHour,
      message: `อัปโหลดครบ ${LIMITS.uploadPerHour} ไฟล์ใน 1 ชั่วโมงแล้ว — รอสักครู่`,
    }
  }
  return { ok: true, used: hour, limit: LIMITS.uploadPerHour }
}

/**
 * หน่วงเวลาเมื่อมีการใส่รหัสผิดถี่ — กันเดารหัส (brute force)
 *
 * ⚠️ ทำไมถึง "หน่วง" ไม่ใช่ "บล็อก":
 * ถ้าบล็อกตรง ๆ ใครก็ตามที่ใส่รหัสผิด 5 ครั้งจะทำให้ owner เข้าระบบไม่ได้ 15 นาที
 * = เปิดช่องกลั่นแกล้ง (DoS) ซึ่งแย่กว่าปัญหาที่จะแก้
 *
 * การหน่วงทำให้เดารหัสไม่คุ้ม (จาก ~1 วินาที/ครั้ง เป็น 5+ วินาที)
 * แต่ owner ที่รู้รหัสจริงยังเข้าได้เสมอ แค่รอแป๊บเดียว
 */
export async function loginThrottleDelayMs(db: SupabaseClient): Promise<number> {
  const fails = await countLoginFails(db, ago(900_000))
  if (fails < LIMITS.loginFailPer15Min) return 0
  // เกินเพดาน → หน่วงเพิ่มขึ้นตามจำนวนครั้งที่ผิด สูงสุด 8 วินาที
  const over = fails - LIMITS.loginFailPer15Min + 1
  return Math.min(over * 2000, 8000)
}

/** บันทึกว่าใส่รหัสผิด (ใช้นับ brute force) */
export async function recordLoginFailure(db: SupabaseClient): Promise<void> {
  try {
    await db.from('doc_audit').insert({
      document_id: null, actor: 'anonymous', action: 'login.failed',
      metadata: { page: 'documents' },
    })
  } catch { /* เงียบไว้ */ }
}
