// lib/docbrief-repository.ts — Repository (ค้นเอกสารย้อนหลัง) — blueprint §5
// แยก logic การแปลง query params → filter ออกมาให้ทดสอบได้ (pure · ไม่ import next/supabase)

export interface RepoFilters {
  q: string            // keyword: vendor_name / doc_no
  state: string        // '' = ทุกสถานะ
  profile: string      // '' | 'accounting' | 'stock'
  vendor: string
  dateFrom: string     // YYYY-MM-DD หรือ ''
  dateTo: string
  amountMin: number | null
  amountMax: number | null
  dupOnly: boolean     // เฉพาะที่ธง possible_duplicate
  source: string
}

const STATES = ['received', 'queued', 'extracting', 'pending_review', 'confirmed', 'exporting', 'exported', 'rejected', 'failed', 'duplicate']
const PROFILES = ['accounting', 'stock']

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const dateOr = (v: unknown) => {
  const t = s(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''
}
const numOr = (v: unknown): number | null => {
  const t = s(v).replace(/,/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** แปลง searchParams (object ของ string) → filter ที่ normalize แล้ว */
export function parseRepoFilters(p: Record<string, string | string[] | undefined>): RepoFilters {
  const one = (k: string) => { const v = p[k]; return Array.isArray(v) ? v[0] : v }
  const state = s(one('state'))
  const profile = s(one('profile'))
  let amountMin = numOr(one('amount_min'))
  let amountMax = numOr(one('amount_max'))
  // ถ้า min > max ให้สลับ (กัน user ใส่กลับ)
  if (amountMin != null && amountMax != null && amountMin > amountMax) {
    [amountMin, amountMax] = [amountMax, amountMin]
  }
  return {
    q: s(one('q')),
    state: STATES.includes(state) ? state : '',
    profile: PROFILES.includes(profile) ? profile : '',
    vendor: s(one('vendor')),
    dateFrom: dateOr(one('date_from')),
    dateTo: dateOr(one('date_to')),
    amountMin, amountMax,
    dupOnly: s(one('dup')) === '1',
    source: s(one('source')),
  }
}

/** มี filter ใดถูกใช้อยู่ไหม (ไว้โชว์ปุ่มล้าง) */
export function hasActiveFilters(f: RepoFilters): boolean {
  return !!(f.q || f.state || f.profile || f.vendor || f.dateFrom || f.dateTo ||
    f.amountMin != null || f.amountMax != null || f.dupOnly || f.source)
}

/** escape ค่าที่จะใส่ใน supabase .or()/.ilike() — กัน comma/ปีกกาทำ query พัง */
export function sanitizeLike(v: string): string {
  return v.replace(/[%,()*]/g, ' ').trim()
}
