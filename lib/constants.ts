// lib/constants.ts — ChutiParts MVP shared constants

export const CHASSIS_MODELS = ['W124', 'W126', 'W140', 'W201', 'W202', 'W210'] as const
export type Chassis = (typeof CHASSIS_MODELS)[number]

// Per MPTS-1 reference
export const MODEL_INFO: Record<Chassis, {
  thai_name: string
  category: 'compact' | 'e-class' | 's-class'
  year_from: number
  year_to: number
  body_styles: string[]
  engines: string[]
  aliases: string[]
}> = {
  W201: {
    thai_name: '190E (เบบี้เบนซ์)',
    category: 'compact',
    year_from: 1982,
    year_to: 1993,
    body_styles: ['sedan'],
    engines: ['M102', 'M103', 'M104'],
    aliases: ['190E', 'เบบี้เบนซ์', 'baby benz'],
  },
  W202: {
    thai_name: 'C-Class รุ่นแรก',
    category: 'compact',
    year_from: 1993,
    year_to: 2000,
    body_styles: ['sedan', 'wagon'],
    engines: ['M111', 'M104', 'M112'],
    aliases: ['C-class รุ่นแรก', 'C36', 'C43'],
  },
  W124: {
    thai_name: 'E-Class รุ่นแรก (ตัว E เก่า)',
    category: 'e-class',
    year_from: 1984,
    year_to: 1996,
    body_styles: ['sedan', 'wagon', 'coupe', 'cabrio'],
    engines: ['M102', 'M103', 'M104', 'M119'],
    aliases: ['ตัว E เก่า', '500E', 'E500', 'E60', 'E50', 'E36'],
  },
  W210: {
    thai_name: 'E-Class รุ่น 2 (ตา 4 รู)',
    category: 'e-class',
    year_from: 1995,
    year_to: 2002,
    body_styles: ['sedan', 'wagon'],
    engines: ['M111', 'M104', 'M112', 'M113'],
    aliases: ['ตัว E ตาเหยี่ยว', 'ตา 4 รู', 'E55'],
  },
  W126: {
    thai_name: 'S-Class รุ่น 2 (ตัว S เหลี่ยม)',
    category: 's-class',
    year_from: 1979,
    year_to: 1991,
    body_styles: ['sedan', 'coupe'],
    engines: ['M103', 'M116', 'M117'],
    aliases: ['ตัว S เหลี่ยม', 'SEC', '6.0 AMG Hammer'],
  },
  W140: {
    thai_name: 'S-Class รุ่น 3 (ตัว S ใหญ่ / หัวแตงโม / ปลาวาฬ)',
    category: 's-class',
    year_from: 1991,
    year_to: 1998,
    body_styles: ['sedan', 'coupe'],
    engines: ['M104', 'M119', 'M120'],
    aliases: ['ปลาวาฬ', 'หัวแตงโม', 'ตัว S ใหญ่', 'CL600', 'S600', 'S70 AMG'],
  },
}

export const INTAKE_TYPES = {
  find_parts: { label: 'หาอะไหล่', icon: '🔧', desc: 'มีอะไหล่ที่ต้องการอยู่แล้ว' },
  find_garage: { label: 'หาอู่/ช่าง', icon: '🔨', desc: 'ต้องการช่างซ่อม' },
  symptom_advice: { label: 'ขอคำแนะนำเรื่องอาการ', icon: '💡', desc: 'รถมีอาการ — ยังไม่แน่ใจอะไรเสีย' },
  general: { label: 'อื่นๆ', icon: '📞', desc: 'มีคำถามอื่น' },
} as const

export type IntakeType = keyof typeof INTAKE_TYPES

export const SYMPTOM_CATEGORIES = [
  { value: 'engine', label: '⚙️ เครื่องยนต์', alias: ['เครื่อง','สตาร์ทไม่ติด','เครื่องดับ','เครื่องสะดุด'] },
  { value: 'transmission', label: '⚙️ เกียร์', alias: ['เกียร์','เกียร์กระตุก','เกียร์ลื่น'] },
  { value: 'electrical', label: '⚡ ไฟฟ้า', alias: ['ไฟ','ระบบไฟ','แบต','ไฟไม่ติด'] },
  { value: 'brake', label: '🛑 เบรค', alias: ['เบรค','ABS','ABS warning'] },
  { value: 'suspension', label: '🚗 ช่วงล่าง', alias: ['ช่วงล่าง','โช๊ค','airmatic'] },
  { value: 'ac_climate', label: '❄️ แอร์', alias: ['แอร์','น้ำยาแอร์','คอมแอร์'] },
  { value: 'body_paint', label: '🎨 ตัวถัง/สี', alias: ['สนิม','ตัวถัง','สี','รอย'] },
  { value: 'interior', label: '💺 ภายใน', alias: ['ภายใน','เบาะ','คอนโซล'] },
  { value: 'lighting', label: '💡 ไฟส่องสว่าง', alias: ['ไฟหน้า','ไฟท้าย','ไฟตัดหมอก'] },
  { value: 'warning_light', label: '⚠️ ไฟเตือนติด', alias: ['ไฟเตือน','warning light','MIL','SRS'] },
  { value: 'sound_noise', label: '🔊 มีเสียงผิดปกติ', alias: ['เสียง','เสียงดัง','noise'] },
  { value: 'other', label: '❓ อื่นๆ', alias: [] },
] as const

export const PARTS_CATEGORIES = [
  { value: 'engine', label: 'เครื่องยนต์' },
  { value: 'transmission', label: 'เกียร์' },
  { value: 'ecu_electrical', label: 'ECU/กล่องไฟฟ้า' },
  { value: 'electrical', label: 'ระบบไฟฟ้า' },
  { value: 'lighting', label: 'ไฟส่องสว่าง' },
  { value: 'brake', label: 'เบรค' },
  { value: 'suspension', label: 'ช่วงล่าง' },
  { value: 'hydraulic', label: 'ไฮดรอลิก' },
  { value: 'differential', label: 'เฟืองท้าย' },
  { value: 'body_exterior', label: 'ตัวถัง/ภายนอก' },
  { value: 'interior', label: 'ภายใน/เบาะ' },
  { value: 'ac_climate', label: 'แอร์/ฮีตเตอร์' },
  { value: 'switches', label: 'สวิตช์' },
  { value: 'relays', label: 'รีเลย์' },
  { value: 'fridge', label: 'ตู้เย็น/แอร์หลัง' },
  { value: 'other', label: 'อื่นๆ' },
] as const

export const PROVINCES = [
  'กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'นครปฐม',
  'เชียงใหม่', 'ขอนแก่น', 'นครราชสีมา', 'ชลบุรี', 'ระยอง',
  'อยุธยา', 'สงขลา', 'สุราษฎร์ธานี', 'ภูเก็ต',
  // ... add more
  'อื่นๆ',
] as const

const LINE_OA_BASIC_ID = '440ifncj' // without @ — actual LINE Basic ID
export const LINE_OA_ID = `@${LINE_OA_BASIC_ID}`
export const LINE_OA_URL = `https://line.me/R/ti/p/%40${LINE_OA_BASIC_ID}`
export const PHONE = '081-828-5855'
export const PHONE_TEL = 'tel:0818285855'

// Build pre-filled LINE message after intake
export function buildLineMessage(caseNumber: string, intakeType: string, summary: string) {
  return `สวัสดีครับ ส่งเคส ${caseNumber} ไว้แล้ว\nเรื่อง: ${intakeType}\n${summary}\nรบกวนตอบกลับครับ`
}

export function buildLineOAMessageUrl(caseNumber: string, intakeType: string, summary: string) {
  const msg = encodeURIComponent(buildLineMessage(caseNumber, intakeType, summary))
  return `https://line.me/R/oaMessage/%40${LINE_OA_BASIC_ID}/?${msg}`
}
