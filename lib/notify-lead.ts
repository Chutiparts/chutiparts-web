// lib/notify-lead.ts — แจ้งเตือนแอดมินผ่าน LINE Messaging API (push) เมื่อมี lead ใหม่
// เรียกจาก server เท่านั้น · best-effort: ถ้า fail ให้ log อย่างเดียว ไม่ throw
import { TOPIC_TH, SOURCE_TH } from '@/lib/contact-config'

export type LeadNotify = {
  id: string
  name?: string | null
  phone?: string | null
  line_id?: string | null
  email?: string | null
  topic?: string | null
  source?: string | null
  detail?: string | null
}

const ADMIN_LEADS_URL = 'https://chutibenz.com/ops-x7k2m9/leads'

function buildMessage(l: LeadNotify): string {
  const ref = String(l.id).slice(0, 8).toUpperCase()
  const when = new Date().toLocaleString('th-TH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok',
  })
  const topic = (l.topic && TOPIC_TH[l.topic]) || 'ไม่ระบุ'
  const source = (l.source && SOURCE_TH[l.source]) || 'ไม่ระบุ'
  const lines = [
    '🔔 มี lead ใหม่จากเว็บ ChutiBenz',
    `Ref: ${ref}`,
    l.name ? `ชื่อ: ${l.name}` : null,
    l.phone ? `โทร: ${l.phone}` : null,
    l.line_id ? `LINE: ${l.line_id}` : null,
    l.email ? `Email: ${l.email}` : null,
    `เรื่อง: ${topic}`,
    `มาจาก: ${source}`,
    l.detail ? `รายละเอียด: ${l.detail.slice(0, 300)}` : null,
    `เวลา: ${when}`,
    '',
    `ดูทั้งหมด: ${ADMIN_LEADS_URL}`,
  ].filter(Boolean) as string[]
  return lines.join('\n')
}

// push แจ้งเตือน — ไม่ throw ออกไป (best-effort) เพื่อไม่ให้กระทบ response ของลูกค้า
export async function notifyNewLead(l: LeadNotify): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const to = process.env.LINE_ADMIN_TO
  if (!token || !to) {
    console.error('[notify] missing env LINE_CHANNEL_ACCESS_TOKEN or LINE_ADMIN_TO')
    return
  }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000) // กันค้าง 5 วิ
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: buildMessage(l) }] }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[notify] LINE push failed:', res.status, body.slice(0, 300))
    }
  } catch (e) {
    console.error('[notify] LINE push error:', (e as Error)?.message)
  }
}
