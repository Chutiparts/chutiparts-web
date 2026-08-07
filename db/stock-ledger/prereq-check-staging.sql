-- ═══════════════════════════════════════════════════════════════════════
-- PREREQ CHECK — ก่อนรัน B2 / shadow (P1-2)  ·  STAGING เท่านั้น
-- ─────────────────────────────────────────────────────────────────────
-- เช็กว่า staging พร้อมจริงไหม: master SECTION 1–5 รันแล้ว + mirror prod มา
-- อ่านอย่างเดียว · ไม่แก้ข้อมูล · owner รันใน Supabase SQL Editor แล้วส่งผลกลับ
-- 🔒 อย่ารันบน prod
-- ═══════════════════════════════════════════════════════════════════════

-- 1) 4 RPC ที่ B2 ต้องใช้ + ตัวประกอบ (คาดหวัง present = true ครบ)
select
  'confirm_stock_document'      as rpc, to_regprocedure('confirm_stock_document(uuid,text)')            is not null as present
union all select 'record_stock_issue',        to_regprocedure('record_stock_issue(uuid,integer,text,text,numeric)') is not null
union all select 'record_stock_issue_by_sku', to_regprocedure('record_stock_issue_by_sku(text,integer,text,text)')  is not null
union all select 'soft_delete_stock_record',  to_regprocedure('soft_delete_stock_record(uuid,text)')                is not null
order by rpc;
-- 👉 ถ้าตัวไหน present=false → SECTION นั้นยังไม่รัน (แก้ก่อนค่อย B2)
--    (signature อาจต่างเล็กน้อย — ถ้า false ทั้งที่คิดว่ามี ดู query 1b ด้านล่าง)

-- 1b) เผื่อ signature ไม่ตรง — list ทุก overload ตามชื่อ
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname in ('confirm_stock_document','record_stock_issue','record_stock_issue_by_sku',
                  'soft_delete_stock_record','restore_stock_record')
order by proname;

-- 2) ตาราง/คอลัมน์ ledger (SECTION 1 + 4)
select
  to_regclass('public.stock_movements') is not null as has_stock_movements,       -- SECTION 1
  to_regclass('public.v_stock_active')  is not null as has_v_stock_active,         -- SECTION 4 (view)
  exists (select 1 from information_schema.columns
          where table_name='stock_records' and column_name='deleted_at') as has_deleted_at; -- SECTION 4

-- 3) mirror prod มาจริงไหม (เทียบเลขกับที่รายงาน 30 ก.ค.: ~86 สต็อก / 9 ขาย / 17 เอกสาร)
select
  (select count(*) from stock_records)  as stock_records,
  (select count(*) from sales_records)  as sales_records,
  (select count(*) from doc_documents)  as doc_documents;

-- 4) มี doc pending_review ผูก stock + ยังไม่ posted ไหม (fixture ของ B2 S1/S2)
--    ถ้า 0 → S1/S2 จะ SKIP (ต้องยิงรับเข้าผ่านแอปแทน — ปกติ ไม่ใช่ error)
select count(*) as b2_s1s2_fixture_rows
from doc_documents d
join doc_line_items li on li.document_id = d.id
where d.state = 'pending_review'
  and li.stock_record_id is not null
  and coalesce(li.posted, false) = false;

-- ═══════════════════════════════════════════════════════════════════════
-- เกณฑ์พร้อมรัน B2:
--   • query 1: present = true ครบ 4 (หรือ 1b เห็น 4 ชื่อ)
--   • query 2: has_stock_movements = true, has_deleted_at = true
--   • query 3: เลข > 0 (mirror มาแล้ว)  → ถ้าเป็น 0 = staging ยังไม่ mirror / โดน reset
--   ครบ → ส่ง shadow_B2_tests.sql รันต่อได้เลย
--   ไม่ครบ → รายงานว่าขาดอะไร (SECTION ไหน / ต้อง mirror ใหม่)
-- ═══════════════════════════════════════════════════════════════════════
