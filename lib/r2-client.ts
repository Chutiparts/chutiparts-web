// lib/r2-client.ts — Cloudflare R2 uploader (S3-compatible, via aws4fetch)
// Phase 1 photo upload — 2026-08-04
// อัพ buffer เข้า R2 bucket แบบ server-side เท่านั้น (key อยู่ใน env · ไม่มี NEXT_PUBLIC_)
// ต้องติดตั้ง: npm install aws4fetch
import { AwsClient } from 'aws4fetch'

function endpoint(): string {
  const acct = process.env.R2_ACCOUNT_ID
  if (!acct) throw new Error('R2_ACCOUNT_ID missing')
  return `https://${acct}.r2.cloudflarestorage.com`
}

function client(): AwsClient {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) throw new Error('R2 credentials missing')
  return new AwsClient({ accessKeyId, secretAccessKey, region: 'auto', service: 's3' })
}

export function r2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_URL
  )
}

/**
 * อัพไฟล์ขึ้น R2 แล้วคืน public URL (พร้อม cache-buster ?v=)
 * @param key   ชื่อไฟล์ใน bucket เช่น "140-001.jpg"
 * @param body  ไฟล์ (ArrayBuffer / Uint8Array)
 * @param contentType เช่น "image/jpeg"
 */
export async function uploadToR2(
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const bucket = process.env.R2_BUCKET!
  const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '')
  const url = `${endpoint()}/${bucket}/${encodeURIComponent(key)}`

  // R2 ต้องการ Content-Length ที่ชัดเจน → ส่ง body เป็น Uint8Array + set header เอง
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body)

  const res = await client().fetch(url, {
    method: 'PUT',
    body: bytes as unknown as BodyInit,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`R2 upload failed ${res.status}: ${detail.slice(0, 300)}`)
  }

  // cache-buster เพราะ key คงที่ (อัพซ้ำ = ทับ) → เว็บต้องเห็นรูปใหม่
  return `${publicUrl}/${encodeURIComponent(key)}?v=${Date.now()}`
}
