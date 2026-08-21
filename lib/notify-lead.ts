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

// ── PDPA (2026-08-21) ────────────────────────────────────────
// LINE_ADMIN_TO เป็น "กลุ่มทีม" (ยืนยันแล้ว) ข้อความ push จึงถึงทุกคนในกลุ่ม และค้างใน
// ประวัติแชตถาวร — คนที่ถูกเพิ่มเข้ากลุ่มทีหลังเลื่อนขึ้นไปอ่านของเก่าได้หมด
// จึงห้ามใส่ PII เต็มลงในข้อความ: เบอร์ให้มาสก์ · LINE id/อีเมล ตัดออก (ยังเก็บครบใน DB)
// รูปแบบมาสก์เก็บ 4 ตัวท้าย ให้ตรงกับ agent.py:75 (0899999999 -> xxx-xxx-9999)
// หมายเหตุ: ai-tools.ts:201 maskPhone ใช้ 3 ตัวหน้า+2 ตัวท้าย (089****99) = คนละ convention
// ไม่แก้ตัวนั้นเพราะ /api/ai/v1/* ใช้อยู่ (นอกขอบเขตงานนี้)
function maskPhoneTail4(v?: string | null): string | null {
  if (!v) return null
  const digits = String(v).replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return `xxx-xxx-${digits.slice(-4)}`
}

// ฟิลด์ที่เป็น free text (detail, name, part_wanted) มาสก์ระดับฟิลด์ไม่พอ — ของพวกนี้
// LLM เป็นคนเขียน (`agent.py:365` ประกอบ detail จาก note ของ LLM ล้วน ๆ) ถ้ามันเผลอ
// เขียนเบอร์ลูกค้าลงไป เบอร์เต็มจะทะลุเข้ากลุ่มทั้งที่ฟิลด์ phone มาสก์แล้ว
// ⚠️ ไม่ได้ใช้ regex ของ `agent.py:69` ตรง ๆ — ตัวนั้นคือ /(?:\+66|0)[\d\-\s]{7,12}\d/
// ซึ่งพังในประโยคเต็ม: "ไฟท้าย W140 140-033" จะ match ตั้งแต่ 0 ของ W140 ยาวไปกิน
// รหัสอะไหล่ กลายเป็น "W14xxx-xxx-0033" (เทสยืนยันแล้ว) · "210-820-03-56" ก็โดน
// ตัวนี้รัดกุมขึ้น 3 จุด:
//   (?<![\dA-Za-z]) ต้องไม่มีเลข/ตัวอักษรนำหน้า → ไม่กิน 0 ที่อยู่กลาง W140 / A0004660101
//   นับหลักให้ตรงเบอร์ไทยจริง 9-10 หลัก (มือถือ 10 · บ้าน 9) ไม่ใช่ช่วงกว้าง ๆ
//   (?![\d-]) ห้ามมีเลข/ขีดต่อท้าย → ไม่ match แค่บางส่วนของรหัสยาว ๆ
// ครอบ: 0891234567 · 081-828-5855 · 02-123-4567 · +66891234567
// ไม่แตะ: 140-033 · 210-820-03-56 · W210 · A0004660101
const PHONE_RE = /(?<![\dA-Za-z])(?:\+66[-\s]?|0)\d(?:[-\s]?\d){7,8}(?![\d-])/g

function scrubPhones(v?: string | null): string | null {
  if (!v) return null
  return String(v).replace(PHONE_RE, (m) => maskPhoneTail4(m) ?? 'xxx')
}

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
    l.name ? `ชื่อ: ${scrubPhones(l.name)}` : null,
    // เบอร์มาสก์ — เบอร์เต็มดูได้ที่หน้า ops (cookie auth) เท่านั้น
    l.phone ? `โทร: ${maskPhoneTail4(l.phone)}` : null,
    // ไม่มีเบอร์ = ติดต่อทาง LINE/อีเมล · บอกแค่ช่องทาง ไม่ปล่อยค่าจริงลงกลุ่ม
    !l.phone && l.line_id ? 'ช่องทาง: LINE (เปิดในระบบเพื่อดู)' : null,
    !l.phone && !l.line_id && l.email ? 'ช่องทาง: อีเมล (เปิดในระบบเพื่อดู)' : null,
    `เรื่อง: ${topic}`,
    `มาจาก: ${source}`,
    // scrub ก่อน slice — ถ้า slice ก่อนอาจตัดเบอร์ครึ่งตัวจน regex จับไม่ติด
    l.detail ? `รายละเอียด: ${scrubPhones(l.detail)?.slice(0, 300)}` : null,
    `เวลา: ${when}`,
    '',
    `เปิดดูเบอร์เต็ม/ติดต่อ (ค้นหา #${ref}): ${ADMIN_LEADS_URL}`,
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

// ─────────────────────────────────────────────────────────────
// P0 · แจ้งเตือน "ของเข้าสต็อก → ลูกค้าที่เคยถามหา" (restock notify)
// เรียกจาก receiveOne (server) แบบ best-effort · ไม่ throw
// จับคู่แบบแม่นยำ: contact_leads.part_number = SKU (เริ่มแบบ precision สูง · ขยายทีหลังตามข้อมูล)
// ─────────────────────────────────────────────────────────────
export type RestockLead = {
  id: string
  name?: string | null
  phone?: string | null
  line_id?: string | null
  part_wanted?: string | null
  created_at?: string | null
  status?: string | null
}

export async function notifyRestock(p: {
  sku: string
  partName?: string | null
  carModel?: string | null
  qty?: number | null
  leads: RestockLead[]
}): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const to = process.env.LINE_ADMIN_TO
  if (!token || !to) { console.error('[notify] missing LINE env (restock)'); return }
  if (!p.leads?.length) return

  const when = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })
  const head = [
    '📦 ของเข้าสต็อก — มีลูกค้าเคยถามหา!',
    `${p.partName || p.sku}${p.carModel ? ` · ${p.carModel}` : ''} (${p.sku})`,
    p.qty ? `รับเข้า: ${p.qty} ชิ้น` : null,
    `ลูกค้าที่เคยถาม: ${p.leads.length} ราย — ทักกลับได้เลย 👇`,
    '',
  ].filter(Boolean) as string[]
  const body = p.leads.slice(0, 10).map((l, i) => {
    // มาสก์เหมือน buildMessage — ข้อความนี้ push เข้ากลุ่มเดียวกัน
    const contact = l.phone ? `โทร ${maskPhoneTail4(l.phone)}`
      : (l.line_id ? 'LINE (เปิดในระบบเพื่อดู)' : 'ไม่มีช่องติดต่อ')
    const nm = scrubPhones(l.name) || '(ไม่ระบุชื่อ)'
    // part_wanted ลูกค้าพิมพ์เอง/LLM สรุป = free text ชุดเดียวกับ detail
    const want = l.part_wanted ? ` · "${scrubPhones(l.part_wanted)?.slice(0, 40)}"` : ''
    return `${i + 1}. ${nm} · ${contact}${want}`
  })
  const tail = ['', `เปิดดูเบอร์เต็ม/ติดต่อ: ${ADMIN_LEADS_URL}`, `เวลา: ${when}`]
  const text = [...head, ...body, ...tail].join('\n')

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const b = await res.text().catch(() => '')
      console.error('[notify] restock push failed:', res.status, b.slice(0, 300))
    }
  } catch (e) {
    console.error('[notify] restock push error:', (e as Error)?.message)
  }
}
