// lib/contact-config.ts — ศูนย์รวมช่องทางติดต่อ ChutiBenz (แก้ที่เดียว ใช้ทั้งเว็บ)

export const CONTACT = {
  lineId: 'mr.chuti5988',
  // ลิงก์เปิดแชต LINE — ปรับเป็น LINE OA link จริงได้ถ้าต่างจากนี้
  lineUrl: 'https://line.me/R/ti/p/@mr.chuti5988',
  tel: '0818285855',
  telDisplay: '081-828-5855',
  // TODO(owner): ใส่เบอร์ WhatsApp รูปแบบสากล เช่น '66818285855' (เว้นว่าง = ซ่อนปุ่ม WhatsApp)
  whatsapp: '',
  // TODO(owner): ใส่ลิงก์ Messenger เช่น 'https://m.me/<your-page>' (เว้นว่าง = ซ่อนปุ่ม Messenger)
  messengerUrl: '',
} as const

// auto-reply หลังส่งฟอร์มสำเร็จ
export const AUTO_REPLY =
  'ขอบคุณครับ เราได้รับข้อมูลของคุณเรียบร้อยแล้ว\n' +
  'ทีมงานจะตรวจสอบรายละเอียดและติดต่อกลับโดยเร็วที่สุด'

export const LEAD_TOPICS: { value: string; label: string }[] = [
  { value: 'parts',    label: 'สอบถามอะไหล่ Mercedes-Benz' },
  { value: 'ebook',    label: 'สอบถาม eBook Mercedes' },
  { value: 'cvd',      label: 'สอบถาม CVD Diamond' },
  { value: 'property', label: 'สอบถามที่ดิน / ทรัพย์สิน' },
  { value: 'general',  label: 'สอบถามทั่วไป' },
]

export const TOPIC_TH: Record<string, string> = Object.fromEntries(
  LEAD_TOPICS.map((t) => [t.value, t.label]),
)

export const CAR_MODELS = ['W124', 'W126', 'W140', 'W201', 'W202', 'W210', 'อื่นๆ']

export const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: 'facebook_page',  label: 'Facebook Page' },
  { value: 'facebook_group', label: 'Facebook Group' },
  { value: 'instagram',      label: 'Instagram' },
  { value: 'google',         label: 'Google' },
  { value: 'qr',             label: 'QR Code' },
  { value: 'direct',         label: 'เข้าเว็บโดยตรง' },
]

export const SOURCE_TH: Record<string, string> = Object.fromEntries(
  LEAD_SOURCES.map((s) => [s.value, s.label]),
)

export const LEAD_STATUS: { value: string; label: string }[] = [
  { value: 'new',       label: 'ใหม่' },
  { value: 'contacted', label: 'ติดต่อแล้ว' },
  { value: 'waiting',   label: 'รอข้อมูล' },
  { value: 'won',       label: 'ปิดการขาย' },
  { value: 'lost',      label: 'ไม่สนใจ' },
]
