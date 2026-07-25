-- docbrief — Migration M11  (Possible duplicate — blueprint §9/§14)
-- ─────────────────────────────────────────────────────────────────────
-- เก็บ "หลักฐานความซ้ำ" ของแต่ละใบ (รายการที่จับคู่ได้ + คะแนน + เหตุผล)
-- flag ยังใช้ review_flags เดิม (text[]) เพิ่มคำว่า 'possible_duplicate'
-- ส่วน evidence เก็บที่คอลัมน์ใหม่นี้ (§9: flags = query, metadata = evidence)
-- Owner รันเองใน Supabase SQL Editor · เพิ่มเข้าไปเฉย ๆ ไม่แตะของเดิม
-- ═════════════════════════════════════════════════════════════════════

alter table doc_documents
  add column if not exists review_metadata jsonb;   -- { possible_duplicate_matches: [{document_id, score, reasons}] }

-- ═════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- alter table doc_documents drop column if exists review_metadata;
-- ═════════════════════════════════════════════════════════════════════
