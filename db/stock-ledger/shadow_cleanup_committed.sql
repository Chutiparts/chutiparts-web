-- ═══════════════════════════════════════════════════════════════════════
-- shadow_cleanup_committed.sql — ลบ QA test data (เฉพาะกรณี commit จริง)
-- ─────────────────────────────────────────────────────────────────────
-- ⚠️ ปกติ "ไม่ต้องใช้" — shadow_scenario_A.sql ใช้ rollback อยู่แล้ว = ไม่เหลือขยะ
-- ไฟล์นี้ไว้ใช้เมื่อ: มีการ commit test data จริง (เช่น สร้าง intake ทดสอบผ่านแอป
--   ช่วง shadow หลายวัน) แล้วอยากลบทิ้งก่อน cutover
--
-- 🔒 STAGING เท่านั้น · ห้าม prod
-- 🎯 ลบเฉพาะที่ติด marker "QA-RECON" เท่านั้น — ไม่แตะข้อมูลจริงเด็ดขาด
--    (doc_no='QA-RECON' / file_hash เริ่ม 'qa-recon' / movement sale_id เริ่ม 'QA-RECON')
-- ═══════════════════════════════════════════════════════════════════════


-- ╔═══ PART A — DRY RUN (อ่านอย่างเดียว · รันดูก่อนว่าจะลบอะไรบ้าง) ═══╗

select 'doc_documents' as tbl, count(*) as will_delete
from doc_documents where doc_no = 'QA-RECON' or file_hash like 'qa-recon%'
union all
select 'doc_line_items', count(*)
from doc_line_items where document_id in
  (select id from doc_documents where doc_no='QA-RECON' or file_hash like 'qa-recon%')
union all
select 'stock_movements (received)', count(*)
from stock_movements where document_id in
  (select id from doc_documents where doc_no='QA-RECON' or file_hash like 'qa-recon%')
union all
select 'stock_movements (issued QA)', count(*)
from stock_movements where sale_id like 'QA-RECON%'
union all
select 'doc_audit', count(*)
from doc_audit where document_id in
  (select id from doc_documents where doc_no='QA-RECON' or file_hash like 'qa-recon%');
-- 👉 ตรวจว่าเลขสมเหตุผล (เฉพาะของเทส) ก่อนไป PART B


-- ╔═══ PART B — DELETE (รันหลังตรวจ DRY RUN แล้วเท่านั้น) ═══╗
-- ลำดับตาม FK: movement → audit → line → doc

begin;

-- 1) issued movements ของ QA (ตาม sale_id marker)
delete from stock_movements where sale_id like 'QA-RECON%';

-- 2) received movements ของ doc QA
delete from stock_movements where document_id in
  (select id from doc_documents where doc_no='QA-RECON' or file_hash like 'qa-recon%');

-- 3) audit ของ doc QA
delete from doc_audit where document_id in
  (select id from doc_documents where doc_no='QA-RECON' or file_hash like 'qa-recon%');

-- 4) line items ของ doc QA
delete from doc_line_items where document_id in
  (select id from doc_documents where doc_no='QA-RECON' or file_hash like 'qa-recon%');

-- 5) doc QA
delete from doc_documents where doc_no='QA-RECON' or file_hash like 'qa-recon%';

-- ตรวจว่าเหลือ 0 (ควรได้ 0 ทุกตัว)
select
  (select count(*) from doc_documents where doc_no='QA-RECON' or file_hash like 'qa-recon%') as docs_left,
  (select count(*) from stock_movements where sale_id like 'QA-RECON%')                       as issued_left;

-- ⛔ ตรวจเลขข้างบน = 0 แล้วค่อย uncomment commit:
-- commit;
rollback;   -- default: ปลอดภัย ไม่ลบจริงจนกว่าจะเปลี่ยนเป็น commit เอง

-- ═══════════════════════════════════════════════════════════════════════
-- หมายเหตุ: ถ้าเคยสร้าง "sales_records จริง" ผ่านหน้าขายตอนเทส (ไม่ใช่ scenario A
--   ซึ่งใช้ sale_id marker ล้วน) → ลบด้วย id ที่รู้เอง · ไฟล์นี้ไม่เดาลบ sales_records
--   (กันลบยอดขายจริงพลาด)
-- ═══════════════════════════════════════════════════════════════════════
