// lib/docbrief-vendors.ts — รายชื่อผู้ขายสำหรับ autocomplete ตอนตรวจเอกสาร
// สเปก: docbrief-final-spec-v1.md §4.1 (Copilot → อ่านจาก core · READ-ONLY เท่านั้น)
//
// ⚠️ อ่านอย่างเดียว — ไม่ INSERT/UPDATE/DELETE ตารางของ core เด็ดขาด
//
// รวม 2 แหล่ง:
//   1. core `stock_records.source` (แหล่งซื้อ) — ตอนนี้ยังว่าง แต่พร้อมใช้เมื่อ owner เริ่มกรอก
//   2. ประวัติของ docbrief เอง (`doc_documents.vendor_name` ที่ยืนยันแล้ว) — ใช้ได้ทันที
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getVendorSuggestions(db: SupabaseClient): Promise<string[]> {
  const names = new Set<string>()

  // --- 1) จาก core (read-only) ---
  try {
    const { data } = await db.from('stock_records').select('source').not('source', 'is', null).limit(2000)
    for (const r of data ?? []) {
      const v = String(r.source ?? '').trim()
      if (v) names.add(v)
    }
  } catch {
    // core เปลี่ยน schema หรือไม่มีสิทธิ์ → ข้าม ไม่ทำให้หน้าพัง
  }

  // --- 2) จากประวัติ docbrief เอง ---
  try {
    const { data } = await db.from('doc_documents')
      .select('vendor_name')
      .not('vendor_name', 'is', null)
      .in('state', ['confirmed', 'exported', 'pending_review'])
      .limit(2000)
    for (const r of data ?? []) {
      const v = String(r.vendor_name ?? '').trim()
      if (v) names.add(v)
    }
  } catch {
    /* เงียบไว้ */
  }

  return [...names].sort((a, b) => a.localeCompare(b, 'th'))
}
