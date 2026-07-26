// lib/garage-import.ts — normalize + dedupe ข้อมูลอู่จาก Apify (Google Maps scraper)
// spec §Data pipeline ขั้น 2 (clean/normalize) + ขั้น 3 (dedupe)
// pure functions ทั้งหมด (มี unit test) — ตัว write DB อยู่ในหน้า admin
// หมายเหตุ: inline รายชื่อจังหวัด (ไม่ import benz-provinces) เพื่อให้ไฟล์นี้ test ได้ด้วย node --test
const PROVINCE_TH = [
  'กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'ชลบุรี',
  'เชียงใหม่', 'ภูเก็ต', 'ขอนแก่น', 'นครราชสีมา', 'สงขลา',
]

export type RawApify = Record<string, unknown>

export type GarageRow = {
  name_th: string
  name_en: string | null
  slug: string
  normalized_name: string
  province: string | null
  district: string | null
  address_raw: string | null
  phone: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  lat: number | null
  lng: number | null
  maps_url: string | null
  place_id: string | null
  status: string
  source: string
  needs_manual_review: boolean
}

const str = (v: unknown): string | null => (v == null ? null : String(v).trim() || null)
const numOrNull = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const intOrNull = (v: unknown): number | null => {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : null
}
const get = (o: RawApify, k: string): unknown => (o == null ? undefined : o[k])

/** ชื่อ normalize สำหรับ dedupe: ตัดช่องว่าง/วรรคตอน/คำต่อท้าย lowercase */
export function normName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\(ตัวอย่าง\)/g, '')
    .replace(/[\s\-_.]+/g, '')
    .replace(/[^฀-๿a-z0-9]/g, '')
}

/** hash สั้น ๆ (djb2) → base36 ใช้ทำ token ท้าย slug ให้ไม่ชน + เสถียร (re-import ได้ slug เดิม) */
export function hash36(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = (((h << 5) + h + input.charCodeAt(i)) >>> 0)
  return h.toString(36).slice(0, 4).padStart(4, '0')
}

/** slug: base (อังกฤษถ้ามี ไม่งั้นไทย) + token เสถียร */
export function slugify(base: string, token: string): string {
  const b = (base || 'garage')
    .toLowerCase()
    .replace(/[^฀-๿a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${b || 'garage'}-${token}`
}

/** เดาจังหวัดจากข้อความ (state/city/address) เทียบรายชื่อจังหวัด MVP */
export function detectProvince(text: string): string | null {
  if (!text) return null
  for (const th of PROVINCE_TH) if (text.includes(th)) return th
  if (/กรุงเทพ|bangkok/i.test(text)) return 'กรุงเทพมหานคร'
  return null
}

/** raw record (Apify Google Maps) → GarageRow ที่ normalize แล้ว */
export function normalizeApify(raw: RawApify): GarageRow {
  const name = str(get(raw, 'title') ?? get(raw, 'name') ?? get(raw, 'name_th')) || ''
  const nameEn = str(get(raw, 'name_en'))
  const address = str(get(raw, 'address') ?? get(raw, 'street') ?? get(raw, 'fullAddress'))
  const stateCity = [str(get(raw, 'state')), str(get(raw, 'city')), str(get(raw, 'district')), address]
    .filter(Boolean)
    .join(' ')
  const province = detectProvince(stateCity)
  const placeId = str(get(raw, 'placeId') ?? get(raw, 'place_id') ?? get(raw, 'cid') ?? get(raw, 'fid'))
  const loc = get(raw, 'location') as RawApify | undefined
  const lat = numOrNull((loc && get(loc, 'lat')) ?? get(raw, 'lat') ?? get(raw, 'latitude'))
  const lng = numOrNull((loc && get(loc, 'lng')) ?? get(raw, 'lng') ?? get(raw, 'longitude'))
  const phone = str(get(raw, 'phone') ?? get(raw, 'phoneUnformatted'))
  const website = str(get(raw, 'website'))
  const mapsUrl = str(get(raw, 'url') ?? get(raw, 'googleMapsUrl') ?? get(raw, 'mapsUrl') ?? get(raw, 'placeUrl'))
  const token = placeId ? hash36(placeId) : hash36(name + (province || ''))

  // ต้องตรวจมือถ้า: ไม่มีชื่อ, ไม่มีจังหวัด, หรือไม่มีช่องทางติดต่อ/แผนที่เลย
  const needsReview = !name || !province || (!phone && !website && !mapsUrl)

  return {
    name_th: name,
    name_en: nameEn,
    slug: slugify(nameEn || name, token),
    normalized_name: normName(name),
    province,
    district: str(get(raw, 'city') ?? get(raw, 'district')),
    address_raw: address,
    phone,
    website,
    rating: numOrNull(get(raw, 'totalScore') ?? get(raw, 'rating') ?? get(raw, 'stars')),
    review_count: intOrNull(get(raw, 'reviewsCount') ?? get(raw, 'reviewCount') ?? get(raw, 'reviews')),
    lat,
    lng,
    maps_url: mapsUrl,
    place_id: placeId,
    status: 'cleaned',
    source: 'apify-google-maps',
    needs_manual_review: needsReview,
  }
}

export type ExistingKey = { id: string; place_id: string | null; normalized_name: string | null; phone: string | null }

/** หา record เดิมที่ซ้ำ: 1) place_id  2) normalized_name + phone — คืน id หรือ null */
export function findDuplicate(row: GarageRow, existing: ExistingKey[]): string | null {
  if (row.place_id) {
    const m = existing.find((e) => e.place_id && e.place_id === row.place_id)
    if (m) return m.id
  }
  if (row.normalized_name && row.phone) {
    const m = existing.find(
      (e) => e.normalized_name === row.normalized_name && e.phone && e.phone === row.phone,
    )
    if (m) return m.id
  }
  return null
}

/** dedupe ภายในชุด import เดียวกัน (กันซ้ำในไฟล์เดียว) — คืน rows ที่ไม่ซ้ำกันเอง */
export function dedupeBatch(rows: GarageRow[]): GarageRow[] {
  const seen = new Set<string>()
  const out: GarageRow[] = []
  for (const r of rows) {
    const key = r.place_id || `${r.normalized_name}|${r.phone || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}
