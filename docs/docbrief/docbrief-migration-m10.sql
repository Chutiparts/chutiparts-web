-- docbrief — Migration M10  (Soft delete / Trash — blueprint §11)
-- ─────────────────────────────────────────────────────────────────────
-- ทิ้งเอกสาร = ตั้ง deleted_at (ไม่ลบจริง) · กู้คืน = ล้างเป็น null
-- ไฟล์ต้นฉบับ · audit · export trace ยังอยู่ครบ (§11 ห้ามลบถาวร §18)
-- Owner รันเองใน Supabase SQL Editor · เพิ่มเข้าไปเฉย ๆ ไม่แตะของเดิม
-- ═════════════════════════════════════════════════════════════════════

alter table doc_documents
  add column if not exists deleted_at timestamptz;   -- null = ใช้งานอยู่ · มีค่า = อยู่ในถังทิ้ง

-- index เฉพาะที่ถูกทิ้ง (ถังทิ้งมักน้อย · query เร็ว)
create index if not exists doc_documents_deleted_idx
  on doc_documents (deleted_at) where deleted_at is not null;

-- ═════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- alter table doc_documents drop column if exists deleted_at;
-- ═════════════════════════════════════════════════════════════════════
