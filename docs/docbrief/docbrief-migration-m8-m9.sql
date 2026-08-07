-- docbrief — Migration M8–M9  (Profile A: Stock intake จากใบส่งของ)
-- ─────────────────────────────────────────────────────────────────────
-- เพิ่มเข้าไปเฉย ๆ · ไม่แตะตารางเดิม · ไม่แตะ core (stock_records/sales_records)
-- Owner รันเองใน Supabase SQL Editor (เหมือน M1–M7)
--
-- ทำไมต้องมี:
--   doc_documents เดิมเก็บ "ยอดรวมทั้งใบ" (1 แถว/เอกสาร) — Profile B บัญชี
--   ใบส่งของมี "หลายบรรทัด/ใบ" → ต้องมีตารางเก็บรายการทีละบรรทัด
-- ═════════════════════════════════════════════════════════════════════

-- ===== M8. แยกประเภทเอกสาร: บัญชี (เดิม) vs สต็อก (ใหม่) ==============
-- แถวเดิมทั้งหมดเป็น 'accounting' โดยอัตโนมัติ (default) → ไม่กระทบของเดิม
alter table doc_documents
  add column if not exists profile text not null default 'accounting';

alter table doc_documents
  drop constraint if exists doc_documents_profile_chk;
alter table doc_documents
  add constraint doc_documents_profile_chk
  check (profile in ('accounting', 'stock'));

-- ===== M9. doc_line_items (รายการทีละบรรทัดในใบส่งของ) ================
create table if not exists doc_line_items (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references doc_documents(id) on delete cascade,
  line_no         integer not null,             -- ลำดับบรรทัดในใบ (1,2,3,...)

  -- ── จากใบส่งของ (AI อ่าน) ──
  qty             numeric(14,2),                -- จำนวน
  part_name       text,                         -- ชื่ออะไหล่ (แก้ได้ตอนตรวจ)
  unit_price      numeric(14,2),                -- ต้นทุน/ชิ้น (หน่วยละ)
  amount          numeric(14,2),                -- จำนวนเงินรวมบรรทัด
  car_model       text,                         -- รุ่น (ถ้าอ่านเจอ เช่น W140)

  -- ── owner เติมเองตอนตรวจ (ใบผู้ขายไม่มี) ──
  sku             text,                         -- รหัสภายใน
  set_price       numeric(14,2),                -- ราคาตั้งขาย
  location        text,                         -- ตำแหน่งเก็บ
  category        text,                         -- หมวดหมู่ (เช่น LGT-03 ไฟท้าย)
  oem             text,                         -- OEM number
  condition       text,                         -- สภาพ (มือสอง-A/B)
  note            text,

  -- ── meta / ตรวจสอบ ──
  arithmetic_ok   boolean,                      -- qty × unit_price = amount ?
  confidence      numeric,                      -- ความมั่นใจของโมเดล (0..1)
  review_flags    text[] not null default '{}', -- name_uncertain, arithmetic_mismatch, ...
  stock_record_id uuid,                         -- ผูกหลัง commit (ไม่ FK ข้ามไป core โดยตั้งใจ)

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (document_id, line_no)
);

create index if not exists doc_line_items_document_idx
  on doc_line_items (document_id);

-- RLS: เปิดโดยไม่สร้าง policy = ปิดตายจาก anon/authenticated
-- (service role ที่เว็บใช้ bypass RLS — เหมือน doc_documents ใน M7)
alter table doc_line_items enable row level security;


-- ═════════════════════════════════════════════════════════════════════
-- ROLLBACK (ถ้าต้องถอย — รันเฉพาะบล็อกนี้)
-- ─────────────────────────────────────────────────────────────────────
-- drop table if exists doc_line_items;
-- alter table doc_documents drop constraint if exists doc_documents_profile_chk;
-- alter table doc_documents drop column if exists profile;
-- ═════════════════════════════════════════════════════════════════════
