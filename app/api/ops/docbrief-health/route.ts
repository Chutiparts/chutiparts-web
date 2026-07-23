// app/api/ops/docbrief-health/route.ts — ตรวจว่า env ฝั่ง production ตั้งถูกไหม
//
// ทำไมต้องมี: Vercel ตั้ง env เป็น Sensitive = อ่านค่ากลับไม่ได้ พอส่ง Sheet ไม่ผ่าน
// จะเดาไม่ออกว่า "URL ผิด" หรือ "รหัสผิด" ต้องไล่ทีละตัว เสียเวลาหลายรอบ
//
// ปลอดภัย: ต้องล็อกอิน owner ก่อน · ไม่คืนค่าจริงสักตัว
//   - URL คืนแค่ deployment id 16 ตัวแรก (ไม่ใช่ความลับ อยู่ใน address bar อยู่แล้ว)
//   - รหัสคืนแค่ลายนิ้วมือ sha256 10 ตัวแรก (ย้อนกลับเป็นรหัสจริงไม่ได้)
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { opsAuthed } from '@/lib/ops-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const fingerprint = (v: string) => createHash('sha256').update(v).digest('hex').slice(0, 10)

export async function GET() {
  if (!(await opsAuthed())) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบ' }, { status: 401 })
  }

  const url = process.env.DOCBRIEF_SHEET_WEBHOOK_URL || ''
  const secret = process.env.DOCBRIEF_SHEET_SECRET || ''
  const deploymentId = url.match(/macros\/s\/([^/]+)/)?.[1] ?? ''

  return NextResponse.json({
    build: {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
      env: process.env.VERCEL_ENV || 'local',
    },
    webhook: {
      set: !!url,
      deployment_id_prefix: deploymentId.slice(0, 16) || null,
      ends_with_exec: url.endsWith('/exec'),
      length: url.length,
    },
    sheet_secret: {
      set: !!secret,
      length: secret.length,
      fingerprint: secret ? fingerprint(secret) : null,
      has_whitespace: secret !== secret.trim(),
    },
  })
}
