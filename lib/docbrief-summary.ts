// lib/docbrief-summary.ts — สรุปสถานะเอกสารให้ Daily Brief ดึงไปโชว์
// สเปก: docbrief-final-spec-v1.md §4.2 (core → อ่านสรุปจาก Copilot · read-only)
//
// อ่านอย่างเดียว · ไม่เขียนอะไรทั้งสิ้น · ถ้าตาราง doc_* ยังไม่มีก็คืนค่าว่างแทนที่จะพัง
// (Daily Brief ต้องไม่ล่มเพราะ docbrief)
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DocSummary {
  enabled: boolean
  queued: number // รออ่าน
  pending_review: number // รอตรวจ (สิ่งที่ owner ต้องทำ)
  confirmed: number // ยืนยันแล้ว รอส่งออก
  failed: number // ต้องแก้
  exported_today: number
  oldest_pending_days: number | null // ค้างนานสุดกี่วัน
}

export const EMPTY_SUMMARY: DocSummary = {
  enabled: false, queued: 0, pending_review: 0, confirmed: 0,
  failed: 0, exported_today: 0, oldest_pending_days: null,
}

export async function getDocSummary(db: SupabaseClient): Promise<DocSummary> {
  try {
    const { data, error } = await db
      .from('doc_documents')
      .select('state, created_at, updated_at')
      .in('state', ['queued', 'pending_review', 'confirmed', 'failed', 'exported'])

    if (error) return EMPTY_SUMMARY // ตารางยังไม่มี / ไม่มีสิทธิ์ → เงียบ ไม่ทำ Daily Brief พัง

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    let queued = 0, pending = 0, confirmed = 0, failed = 0, exportedToday = 0
    let oldestPending: number | null = null

    for (const d of data ?? []) {
      switch (d.state) {
        case 'queued': queued++; break
        case 'confirmed': confirmed++; break
        case 'failed': failed++; break
        case 'exported':
          if (d.updated_at && new Date(d.updated_at) >= startOfDay) exportedToday++
          break
        case 'pending_review': {
          pending++
          const days = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86_400_000)
          if (oldestPending === null || days > oldestPending) oldestPending = days
          break
        }
      }
    }

    return {
      enabled: true,
      queued, pending_review: pending, confirmed, failed,
      exported_today: exportedToday,
      oldest_pending_days: oldestPending,
    }
  } catch {
    return EMPTY_SUMMARY
  }
}

/** ประโยคเดียวสำหรับโชว์ใน Daily Brief — คืน null ถ้าไม่มีอะไรต้องทำ */
export function summaryHeadline(s: DocSummary): string | null {
  if (!s.enabled) return null
  const parts: string[] = []
  if (s.pending_review) parts.push(`รอตรวจ ${s.pending_review} ใบ`)
  if (s.queued) parts.push(`รออ่าน ${s.queued} ใบ`)
  if (s.confirmed) parts.push(`รอส่งเข้า Sheet ${s.confirmed} ใบ`)
  if (s.failed) parts.push(`ไม่ผ่าน ${s.failed} ใบ`)
  if (!parts.length) return s.exported_today ? `ส่งออกวันนี้ ${s.exported_today} ใบ · ไม่มีงานค้าง` : null
  return parts.join(' · ')
}
