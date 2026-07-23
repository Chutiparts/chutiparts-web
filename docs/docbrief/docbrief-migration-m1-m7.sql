-- ============================================================
-- docbrief — Migration M1–M7  (AI Backoffice Copilot V1)
-- Target: Supabase project qaqawfvbaqyznyuuecfp
--
-- กฎเหล็ก:
--   * ADDITIVE ONLY — ไม่มี ALTER / DROP บนของเดิมแม้แต่บรรทัดเดียว
--   * ทุก object ขึ้นต้นด้วย doc_  (ไม่ชนของ core)
--   * Rollback = รัน section ท้ายไฟล์ → core กลับสภาพเดิม 100%
--
-- วิธีรัน: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
-- ============================================================


-- ===== M1. Enums ============================================
-- state machine ตาม phase-0-decision-doc.md §2 (canonical)
do $$ begin
  create type doc_state as enum (
    'received',       -- สร้าง record + เก็บ original แล้ว
    'queued',         -- ผ่าน dedup ระดับไฟล์ รอ extract
    'extracting',     -- Claude vision กำลังทำงาน
    'pending_review', -- รอคนตรวจ (state เดียวของ review queue — ห้าม alias)
    'confirmed',      -- owner ยืนยันแล้ว
    'exporting',      -- กำลังเขียนลง staging Sheets
    'exported',       -- สำเร็จ (terminal)
    'rejected',       -- owner ปฏิเสธ (terminal)
    'duplicate',      -- ไฟล์ซ้ำระดับ hash (terminal)
    'failed'          -- error — ต้องมี error_category เสมอ
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type doc_error_category as enum (
    'intake_error', 'ocr_unreadable', 'parse_error',
    'validation_failed', 'export_failed', 'cost_limit'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type doc_source as enum ('upload', 'line', 'whatsapp');
exception when duplicate_object then null; end $$;


-- ===== M2. doc_documents (inbox) =============================
create table if not exists doc_documents (
  id              uuid primary key default gen_random_uuid(),
  state           doc_state not null default 'received',

  -- intake / storage
  file_hash       text not null,               -- sha256 hex (dedup §4.6)
  original_filename text not null,
  mime_type       text not null,
  file_size       integer not null,
  page_count      integer,
  storage_path    text,                        -- path ใน bucket 'doc-originals'
  source          doc_source not null default 'upload',
  duplicate_of    uuid references doc_documents(id),

  -- extracted fields (§3) — เติมตอน Phase extract
  vendor_name     text,
  vendor_tax_id   text,
  doc_no          text,
  doc_date        date,                        -- normalize เป็น ค.ศ. เสมอ (§4.3)
  subtotal        numeric(14,2),
  vat             numeric(14,2),
  grand_total     numeric(14,2),
  currency        text default 'THB',

  confidence      jsonb,                       -- { field: 0..1 } ราย field
  raw_extraction  jsonb,                       -- JSON ดิบจากโมเดล (debug §3)
  review_flags    text[] not null default '{}',-- low_confidence, vat_mismatch, ...

  -- error (§7)
  error_category  doc_error_category,
  error_message   text,
  retry_count     integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists doc_documents_file_hash_idx  on doc_documents (file_hash);
create index if not exists doc_documents_state_idx      on doc_documents (state);
create index if not exists doc_documents_created_at_idx on doc_documents (created_at desc);


-- ===== M3. doc_audit (append-only §9) ========================
create table if not exists doc_audit (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid,                     -- soft reference (ไม่ผูก FK ข้ามระบบ)
  actor       text not null default 'system',
  action      text not null,            -- document.received / state.transition / field.corrected ...
  from_state  doc_state,
  to_state    doc_state,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists doc_audit_document_id_idx on doc_audit (document_id);
create index if not exists doc_audit_created_at_idx  on doc_audit (created_at desc);

-- บังคับ append-only จริง (กันแม้แต่ service role แก้/ลบ)
create or replace function doc_audit_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'doc_audit is append-only (no % allowed)', tg_op;
end $$;

drop trigger if exists doc_audit_no_update on doc_audit;
create trigger doc_audit_no_update before update or delete on doc_audit
  for each row execute function doc_audit_append_only();


-- ===== M4. doc_exports (idempotency §5) ======================
create table if not exists doc_exports (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references doc_documents(id),

  -- sha256(tax_id|doc_no|grand_total|doc_date|currency) — คำนวณหลัง confirm
  export_key  text not null unique,          -- ← กัน export ซ้ำ

  target      text not null default 'staging_sheet',
  row_ref     text,                          -- sheet row / staging id
  status      text not null default 'pending', -- pending | success | failed
  error_message text,
  exported_by text,
  exported_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists doc_exports_document_id_idx on doc_exports (document_id);


-- ===== M5. doc_metrics (Phase 2 accuracy/cost §6) ============
-- เก็บต้นทุน/คุณภาพต่อเอกสาร เพื่อวัด metrics ตาม §6
-- (ตัวเลขสรุปสำหรับ /internal/documents/summary คำนวณสดจาก doc_documents ไม่เก็บซ้ำ)
create table if not exists doc_metrics (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references doc_documents(id),
  model           text,
  input_tokens    integer,
  output_tokens   integer,
  cost_thb        numeric(10,4),
  latency_ms      integer,
  fields_corrected integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists doc_metrics_document_id_idx on doc_metrics (document_id);


-- ===== M6. Storage bucket (private) ==========================
insert into storage.buckets (id, name, public)
values ('doc-originals', 'doc-originals', false)
on conflict (id) do nothing;


-- ===== M7. RLS — owner-only (deny by default) ================
-- หน้า ops ใช้ service-role client (svc()) ซึ่ง bypass RLS อยู่แล้ว
-- เปิด RLS โดยไม่สร้าง policy = ปิดตายจากฝั่ง anon/authenticated
alter table doc_documents enable row level security;
alter table doc_audit     enable row level security;
alter table doc_exports   enable row level security;
alter table doc_metrics   enable row level security;

-- bucket 'doc-originals' เป็น private อยู่แล้ว และไม่มี storage policy
-- → เข้าถึงได้เฉพาะ service role (owner zone) เท่านั้น


-- ============================================================
-- ROLLBACK (รันเฉพาะเมื่อต้องถอย — core ไม่ถูกแตะต้องเลย)
-- ============================================================
-- drop trigger if exists doc_audit_no_update on doc_audit;
-- drop function if exists doc_audit_append_only();
-- drop table if exists doc_metrics;
-- drop table if exists doc_exports;
-- drop table if exists doc_audit;
-- drop table if exists doc_documents;
-- drop type  if exists doc_source;
-- drop type  if exists doc_error_category;
-- drop type  if exists doc_state;
-- delete from storage.buckets where id = 'doc-originals';
