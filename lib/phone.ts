// lib/phone.ts — ตรวจ/เทียบเบอร์โทรฝั่ง server (2026-08-21, งาน [C])
//
// ทำไมต้องมี: `POST /api/leads` เดิมตัดเบอร์ที่ 50 ตัวอักษรอย่างเดียว อะไรก็เข้า DB ได้
// และ voice agent ส่งเบอร์ที่ STT ฟังมาอีกที (`agent.py` save_lead) เบอร์เพี้ยน/หลักไม่ครบ
// จึงเข้าถึงตาราง lead ได้หมด · เบอร์ร้านเองก็อยู่ใน system prompt ของ LLM ถ้ามันสับสน
// แล้วเก็บเบอร์ร้านเป็นเบอร์ลูกค้า = ทีมโทรกลับหาตัวเอง
//
// กฎที่ใช้ต้องตรงกับ `agent.py:_is_th_phone` (ชั้นแรกฝั่ง agent) — แก้ที่ไหนแก้อีกที่ด้วย

/** ตัวเลขล้วนในรูปขึ้นต้นด้วย 0 (แปลง +66 → 0) — ใช้ก่อนเทียบ/ตรวจเสมอ */
export function toThDigits(v: string): string {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.startsWith('66') && (d.length === 10 || d.length === 11) ? '0' + d.slice(2) : d
}

/** เบอร์ไทยที่ใช้ได้จริง: มือถือ 10 หลัก (06/08/09) · บ้าน-สนง. 9 หลัก (02 กทม. · 03x-07x ตจว.) */
export function isThaiPhone(v: string): boolean {
  const d = toThDigits(v)
  return /^0[689]\d{8}$/.test(d) || /^0[2-7]\d{7}$/.test(d)
}

/**
 * เบอร์ต่างประเทศที่ไม่ใช่ +66 — ลูกค้าอีบุ๊ก/พาร์ตเนอร์ต่างชาติมีจริง (หน้า /ebooks มี EN)
 * ห้าม reject ทิ้งเพราะไม่เข้ารูปเบอร์ไทย · +66 ให้ตกไปตรวจแบบเบอร์ไทยแทน
 */
export function isIntlPhone(v: string): boolean {
  return /^\+(?!66)\d{7,14}$/.test(String(v ?? '').replace(/[\s\-().]/g, ''))
}

/** เบอร์เดียวกันไหม เทียบที่ตัวเลขล้วน — กันรูปแบบต่างกันหลอกด่าน (081-828-5855 = +66818285855) */
export function samePhone(a: string, b: string): boolean {
  const da = toThDigits(a)
  return da !== '' && da === toThDigits(b)
}

/** ผ่านด่านไหม — ใช้กับ "เบอร์ที่มีค่าแล้ว" เท่านั้น (lead ที่ให้แต่ LINE/อีเมลต้องผ่านตามเดิม) */
export function isAcceptablePhone(v: string): boolean {
  return isThaiPhone(v) || isIntlPhone(v)
}

/**
 * ด่านตรวจเบอร์ของ `POST /api/leads` — คืน error code ถ้าไม่ผ่าน, คืน null ถ้าผ่าน
 *
 * ⚠️ เบอร์ว่าง = "ผ่าน" โดยตั้งใจ: lead ที่ให้มาแค่ LINE id หรืออีเมลต้องเก็บได้ตามเดิม
 * (ฟอร์มเว็บบังคับแค่ "เบอร์ หรือ LINE อย่างน้อย 1 ช่อง" และทางเสียงลูกค้าให้ LINE แทนได้)
 * ตรวจ "เฉพาะเบอร์ที่มีค่า" เท่านั้น
 */
export function checkLeadPhone(phone: string, shopPhone: string): 'shop_phone' | 'invalid_phone' | null {
  const v = String(phone ?? '').trim()
  if (!v) return null
  if (samePhone(v, shopPhone)) return 'shop_phone'   // เบอร์ร้านเอง ≠ ช่องทางติดต่อกลับลูกค้า
  if (!isAcceptablePhone(v)) return 'invalid_phone'
  return null
}
