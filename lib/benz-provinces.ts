// lib/benz-provinces.ts — จังหวัด MVP สำหรับ directory "อู่เบนซ์ทั่วไทย"
// slug ↔ ชื่อไทย ↔ อังกฤษ · garages.province เก็บเป็น "ชื่อไทย" (th)
// ที่มา: garage directory spec §Query strategy (10 จังหวัดเริ่มต้น)

export type Province = { slug: string; th: string; en: string }

export const PROVINCES: Province[] = [
  { slug: 'bangkok',            th: 'กรุงเทพมหานคร', en: 'Bangkok' },
  { slug: 'nonthaburi',         th: 'นนทบุรี',       en: 'Nonthaburi' },
  { slug: 'pathum-thani',       th: 'ปทุมธานี',      en: 'Pathum Thani' },
  { slug: 'samut-prakan',       th: 'สมุทรปราการ',   en: 'Samut Prakan' },
  { slug: 'chonburi',           th: 'ชลบุรี',        en: 'Chonburi' },
  { slug: 'chiang-mai',         th: 'เชียงใหม่',      en: 'Chiang Mai' },
  { slug: 'phuket',             th: 'ภูเก็ต',        en: 'Phuket' },
  { slug: 'khon-kaen',          th: 'ขอนแก่น',       en: 'Khon Kaen' },
  { slug: 'nakhon-ratchasima',  th: 'นครราชสีมา',    en: 'Nakhon Ratchasima' },
  { slug: 'songkhla',           th: 'สงขลา',         en: 'Songkhla' },
]

export const provinceBySlug = (slug: string): Province | undefined =>
  PROVINCES.find((p) => p.slug === slug)

export const provinceSlug = (th: string): string =>
  PROVINCES.find((p) => p.th === th)?.slug || encodeURIComponent(th)
