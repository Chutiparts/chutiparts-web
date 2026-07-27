// app/api/line/webhook/route.ts — LINE Intake → DocBrief OS (V1)
// รับรูปบิล/ใบส่งของจาก LINE OA → เข้า doc_documents (source=line · state=queued · profile=null)
// → รอ "เลือกประเภท (สต็อก/บัญชี)" ในกล่องงาน → เข้า flow เดิม (ไม่ auto-extract · คนตรวจ+ยืนยันเหมือนเดิม)
//
// หลักความปลอดภัย: verify X-Line-Signature · whitelist userId · idempotency ด้วย message.id · secrets ใน env
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLineSignature, getLineMessageContent, replyLineText } from '@/lib/line-client'
import { intakeFile } from '@/lib/docbrief-intake'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

const allowedUsers = (): string[] =>
  (process.env.LINE_ALLOWED_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)

export async function POST(req: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET || ''
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''

  // ต้องอ่าน raw body ตรง ๆ เพื่อ verify signature (ห้าม parse ก่อน)
  const raw = await req.text()
  const sig = req.headers.get('x-line-signature')

  // 1) verify signature — ไม่ผ่าน = 401
  if (!verifyLineSignature(raw, sig, secret)) {
    return new NextResponse('invalid signature', { status: 401 })
  }

  let events: any[] = []
  try { events = JSON.parse(raw).events || [] } catch { events = [] }

  const db = svc()
  const whitelist = allowedUsers()
  const echoUnknown = process.env.LINE_ECHO_UNKNOWN_ID === 'true' // เปิดชั่วคราวตอนตั้งค่าเพื่อดู userId

  for (const ev of events) {
    try {
      if (ev.type !== 'message') continue
      const userId: string | undefined = ev.source?.userId
      const replyToken: string | undefined = ev.replyToken

      // 2) whitelist — ไม่อยู่ในรายชื่อ = ไม่สร้างเอกสาร (เงียบ · เว้นแต่เปิด echo ตอนตั้งค่า)
      if (!userId || !whitelist.includes(userId)) {
        if (echoUnknown && replyToken && userId) {
          await replyLineText(replyToken, `ยังไม่มีสิทธิ์ส่งเอกสาร\nuserId ของคุณ: ${userId}\n(แจ้งเจ้าของร้านเพื่อเพิ่มสิทธิ์)`, token)
        }
        continue
      }

      // 3) รับเฉพาะ image (V1) — อย่างอื่นตอบแนะนำสั้น ๆ
      if (ev.message?.type !== 'image') {
        if (replyToken) await replyLineText(replyToken, 'ส่งเป็น "รูปบิล/ใบส่งของ" เข้ามานะครับ 📷', token)
        continue
      }

      const messageId: string = ev.message.id

      // 4) idempotency — เคยรับ message.id นี้แล้ว = ข้าม (กัน LINE retry สร้างซ้ำ)
      const { data: existing } = await db.from('doc_documents')
        .select('id').filter('review_metadata->>line_message_id', 'eq', messageId).limit(1).maybeSingle()
      if (existing) {
        if (replyToken) await replyLineText(replyToken, 'ได้รับรูปนี้แล้วก่อนหน้า ✅', token)
        continue
      }

      // 5) ดึงรูปจาก LINE → intakeFile (reuse: validate/dedup/storage/queued+audit) · profile=null · source=line
      const { buffer, mime } = await getLineMessageContent(messageId, token)
      const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const outcome = await intakeFile(
        db,
        { name: `line-${messageId}.${ext}`, type: mime, buffer },
        `line:${userId}`,
        null, // profile ยังไม่ระบุ → เลือกในกล่องงาน
        { source: 'line', metadata: { line_user_id: userId, line_message_id: messageId } },
      )

      // 6) reply ให้คนส่งมั่นใจ (ยังไม่อ่าน/ไม่ export — แค่รับเข้าคิว)
      if (replyToken) {
        const msg =
          outcome.status === 'duplicate' ? 'ได้รับรูปนี้แล้วก่อนหน้า ✅ (ไม่สร้างซ้ำ)'
          : outcome.status === 'rejected' ? `รับไม่ได้: ${outcome.message}`
          : 'รับเอกสารแล้ว ✅ เข้าคิวรอเลือกประเภท + ตรวจในระบบ'
        await replyLineText(replyToken, msg, token)
      }
    } catch (e) {
      // best-effort — event เดียวพังต้องไม่ล้มทั้ง batch (กัน LINE retry รัว)
      console.error('[line-webhook] event error', e)
    }
  }

  // ตอบ 200 เสมอ (verify ผ่านแล้ว) เพื่อไม่ให้ LINE retry
  return NextResponse.json({ ok: true })
}
