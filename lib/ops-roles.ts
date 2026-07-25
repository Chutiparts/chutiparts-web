// lib/ops-roles.ts — RBAC หลายบทบาท (blueprint §7) — pure logic ทดสอบได้
//
// lean: ไม่ทำ login ใหม่ (§18) · ใช้ cookie เดิม แต่แยกรหัสตามบทบาทผ่าน env
//   ADMIN_OPS_SECRET      → owner   (ทุกสิทธิ์ · ของเดิม)
//   OPS_REVIEWER_SECRET   → reviewer (ดู/แก้/ยืนยัน/ปฏิเสธ/ทิ้ง)
//   OPS_OPERATOR_SECRET   → operator (อัปโหลด/อ่าน/ดู)
//   OPS_VIEWER_SECRET     → viewer   (ดูอย่างเดียว)
// ถ้าไม่ตั้ง role secret → มีแค่ owner (backward compatible)

export type Role = 'owner' | 'reviewer' | 'operator' | 'viewer'

export type Permission =
  | 'view'        // เปิดดูหน้า/เอกสาร
  | 'upload'      // อัปโหลดไฟล์
  | 'extract'     // สั่ง AI อ่าน (เสียเงิน)
  | 'edit'        // แก้ field/บรรทัด
  | 'confirm'     // ยืนยัน/เข้าสต็อก
  | 'export'      // ส่งเข้า Sheet
  | 'reject'      // ปฏิเสธ
  | 'trash'       // ทิ้งลงถัง
  | 'restore'     // กู้คืนจากถัง
  | 'dedup'       // ตัดสินเอกสารซ้ำ

// ลำดับสิทธิ์ (สูง→ต่ำ) · role สูงกว่าได้สิทธิ์ของ role ต่ำกว่าทั้งหมด
const RANK: Record<Role, number> = { owner: 4, reviewer: 3, operator: 2, viewer: 1 }

// สิทธิ์ขั้นต่ำที่ต้องมีของแต่ละ action
const REQUIRED_RANK: Record<Permission, number> = {
  view: 1,      // viewer+
  upload: 2,    // operator+
  extract: 2,   // operator+
  edit: 3,      // reviewer+
  confirm: 3,   // reviewer+
  reject: 3,    // reviewer+
  trash: 3,     // reviewer+
  dedup: 3,     // reviewer+
  export: 4,    // owner เท่านั้น (ส่งออกจริง)
  restore: 4,   // owner เท่านั้น (กู้คืน = ย้อนการตัดสิน)
}

/** role ทำ permission นี้ได้ไหม */
export function can(role: Role | null, perm: Permission): boolean {
  if (!role) return false
  return RANK[role] >= REQUIRED_RANK[perm]
}

/** ป้ายไทยของ role (ไว้โชว์ UI) */
export const ROLE_TH: Record<Role, string> = {
  owner: 'เจ้าของ', reviewer: 'ผู้ตรวจ', operator: 'ผู้ปฏิบัติงาน', viewer: 'ผู้ดู',
}

export function roleRank(role: Role): number {
  return RANK[role]
}
