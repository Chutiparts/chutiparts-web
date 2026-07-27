// lib/line-client.ts — LINE Messaging API helpers (lean · ไม่ใช้ SDK ภายนอก)
// ใช้แค่ crypto (built-in) + fetch (built-in Node 18+) → ไม่เพิ่ม dependency
import crypto from 'crypto'

/** verify X-Line-Signature = HMAC-SHA256 ของ raw body ด้วย channel secret → base64 (timing-safe) */
export function verifyLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** ดึง binary ของรูปจาก LINE content API */
export async function getLineMessageContent(messageId: string, accessToken: string): Promise<{ buffer: Buffer; mime: string }> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`LINE content fetch failed: ${res.status}`)
  const mime = res.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, mime }
}

/** ตอบข้อความกลับด้วย reply token (optional · best-effort ไม่ throw) */
export async function replyLineText(replyToken: string, text: string, accessToken: string): Promise<void> {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    })
  } catch {
    /* best-effort */
  }
}
