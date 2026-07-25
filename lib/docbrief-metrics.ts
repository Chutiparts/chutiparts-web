// lib/docbrief-metrics.ts — คำนวณตัวชี้วัด dashboard (blueprint §6) — pure · ทดสอบได้
// แยกจากหน้า page เพื่อทดสอบ logic การนับ/คำนวณได้โดยไม่ต้องมี next/supabase

export const BKK_OFFSET_MS = 7 * 3600 * 1000 // เวลาไทย UTC+7

/** timestamp UTC → วันที่ไทย YYYY-MM-DD */
export function bkkDay(iso: string, nowShiftEpoch?: number): string {
  void nowShiftEpoch
  return new Date(new Date(iso).getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10)
}

export interface MetricRow { cost_thb: number | null; latency_ms: number | null; created_at: string }

export interface Agg { n: number; cost: number; avg: number; latency: number }

/** รวมยอดของชุด metric */
export function agg(rows: MetricRow[]): Agg {
  const cost = rows.reduce((s, r) => s + (Number(r.cost_thb) || 0), 0)
  const latency = rows.reduce((s, r) => s + (Number(r.latency_ms) || 0), 0)
  return {
    n: rows.length,
    cost: Number(cost.toFixed(2)),
    avg: rows.length ? Number((cost / rows.length).toFixed(2)) : 0,
    latency: rows.length ? Math.round(latency / rows.length) : 0,
  }
}

/** เริ่มต้นวันนี้ (ไทย) เป็น epoch ในสเปซที่ +7h แล้ว */
export function dayStartShift(nowMs: number): number {
  const nowShift = nowMs + BKK_OFFSET_MS
  const todayStr = new Date(nowShift).toISOString().slice(0, 10)
  return new Date(todayStr + 'T00:00:00.000Z').getTime()
}

/** row อยู่ใน N วันล่าสุด (นับวันนี้เป็นวันที่ 1) ตามเวลาไทย */
export function withinLastDays(iso: string, days: number, nowMs: number): boolean {
  const start = dayStartShift(nowMs)
  return new Date(iso).getTime() + BKK_OFFSET_MS >= start - (days - 1) * 86400000
}

/**
 * เวลาที่ประหยัด (นาที) — ประมาณจากจำนวนใบ × นาทีที่เคยคีย์มือต่อใบ
 * default 3 นาที/ใบ (คีย์ header บัญชี หรือ แตกบรรทัดสต็อก) ปรับได้
 */
export function timeSavedMinutes(docCount: number, minutesPerDoc = 3): number {
  return docCount * minutesPerDoc
}

/** แปลงนาที → ข้อความอ่านง่าย เช่น "2 ชม. 30 นาที" */
export function humanizeMinutes(mins: number): string {
  if (mins < 60) return `${mins} นาที`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} ชม. ${m} นาที` : `${h} ชม.`
}

/** review rate = สัดส่วนใบที่มีธงเตือน (ต้องดูเป็นพิเศษ) จากใบที่อ่านสำเร็จ */
export function reviewRate(flaggedCount: number, extractedCount: number): number {
  if (!extractedCount) return 0
  return Math.round((flaggedCount / extractedCount) * 100)
}

/** export success rate = ส่งออกสำเร็จ / (สำเร็จ + ส่งไม่สำเร็จ) */
export function exportSuccessRate(exported: number, exportFailed: number): number {
  const total = exported + exportFailed
  if (!total) return 100 // ยังไม่มีการส่งออก = ถือว่ายังไม่มีปัญหา
  return Math.round((exported / total) * 100)
}
