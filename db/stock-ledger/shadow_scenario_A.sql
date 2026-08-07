-- ═══════════════════════════════════════════════════════════════════════
-- shadow_scenario_A.sql  (v3) — Committed Shadow Proof · STAGING เท่านั้น
-- ─────────────────────────────────────────────────────────────────────
-- v3: รวมทุกเช็กลงตารางเดียว `_recon` (แบบ B2) → รันครั้งเดียวเห็นครบ + verdict
--     (v2 กระจายเป็นหลาย SELECT → Supabase โชว์แค่ query สุดท้าย)
-- v2: เติมคอลัมน์ NOT NULL ครบ (verify กับ DDL m1-m7 + m8-m9)
--
-- 🟢 begin…rollback = เห็นข้อมูลใน tx แล้ว rollback = ไม่เหลือขยะ · รันซ้ำได้
-- 🔒 STAGING เท่านั้น (chutiparts-staging / gccytdbydtmsqzvoibcz) · ห้าม prod
-- ═══════════════════════════════════════════════════════════════════════

begin;  -- ⛔ จบด้วย rollback

create temp table _recon (
  seq int, check_name text, expect text, got text, result text
) on commit drop;

do $$
declare
  v_stock  uuid;  v_sku text;  v_name text;  v_model text;  v_price numeric;
  v_doc    uuid;  v_line uuid;  r jsonb;
  v_recv   int;   v_iss int;    v_cnt int;    v_dup int;
begin
  -- 1) stock จริง 1 แถว (มีของ · ไม่ถูกลบ)
  select id, sku, coalesce(part_name, sku), car_model, coalesce(set_price, 100)
    into v_stock, v_sku, v_name, v_model, v_price
  from stock_records
  where deleted_at is null and coalesce(qty, 0) > 0
  order by qty desc
  limit 1;
  if v_stock is null then raise exception 'ไม่พบ stock ที่มีของบน staging'; end if;

  -- 2) doc สังเคราะห์ (pending_review) — คอลัมน์ครบตาม DDL
  insert into doc_documents
    (state, file_hash, original_filename, mime_type, file_size, page_count, storage_path, profile)
  values
    ('pending_review', 'qa-recon-' || gen_random_uuid()::text,
     'QA-RECON.pdf', 'application/pdf', 1024, 1, 'qa-recon/none', 'stock')
  returning id into v_doc;

  -- 3) line ผูก stock จริง · qty=3
  insert into doc_line_items
    (document_id, line_no, stock_record_id, part_name, car_model,
     qty, unit_price, amount, confidence, arithmetic_ok, review_flags)
  values
    (v_doc, 1, v_stock, v_name, v_model, 3, v_price, 3 * v_price, 1, true, '{}'::text[])
  returning id into v_line;

  -- 4) รับเข้าผ่าน RPC ใหม่ → received=3 + posted_at + state→confirmed
  r := confirm_stock_document(v_doc, 'qa-recon');
  raise notice 'confirm: %', r;

  -- 5) ขายออกผ่าน RPC ใหม่ → issued=-2
  r := record_stock_issue(v_stock, 2, 'QA-RECON-ISSUE', 'qa-recon', v_price);
  raise notice 'issue: %', r;

  -- ══════ เก็บผลเช็กลง _recon ══════

  -- CHK1 · Q1 ledger honesty: received ที่ลง ledger ของ line = qty บิล (3)
  select coalesce(sum(qty_change),0) into v_recv
    from stock_movements where line_item_id = v_line and movement_type='received';
  insert into _recon values
    (1, 'Q1: ledger received = qty บิล (3)', '3', v_recv::text,
     case when v_recv = 3 then 'PASS' else 'FAIL' end);

  -- CHK2 · Q1-mismatch (line ยุค ledger diff<>0) — ทั้งระบบ ต้อง 0
  select count(*) into v_cnt from (
    select li.id
    from doc_documents d
    join doc_line_items li on li.document_id = d.id
    left join stock_movements m on m.line_item_id = li.id and m.movement_type='received'
    where d.state='confirmed' and li.stock_record_id is not null and li.posted_at is not null
    group by li.id, li.qty
    having round(li.qty)::int <> coalesce(sum(m.qty_change),0)
  ) x;
  insert into _recon values
    (2, 'Q1-mismatch: line ยุค ledger ไม่ตรงบิล', '0', v_cnt::text,
     case when v_cnt = 0 then 'PASS' else 'FAIL' end);

  -- CHK3 · Q2 double-count: line ไหนลง received เกิน 1 ครั้ง (ทั้งระบบ) — ต้อง 0
  select count(*) into v_dup from (
    select line_item_id from stock_movements
    where line_item_id is not null group by line_item_id having count(*) > 1
  ) y;
  insert into _recon values
    (3, 'Q2: นับเบิ้ล (line movement > 1)', '0', v_dup::text,
     case when v_dup = 0 then 'PASS' else 'FAIL' end);

  -- CHK4 · issued = -2
  select coalesce(sum(qty_change),0) into v_iss
    from stock_movements where sale_id='QA-RECON-ISSUE' and movement_type='issued';
  insert into _recon values
    (4, 'issued = -2 (record_stock_issue)', '-2', v_iss::text,
     case when v_iss = -2 then 'PASS' else 'FAIL' end);

  -- CHK5 · idempotent: ยิง issue ซ้ำ sale_id เดิม → movement ยังเป็น 1 (unique กัน)
  perform record_stock_issue(v_stock, 2, 'QA-RECON-ISSUE', 'qa-recon', v_price);
  select count(*) into v_cnt
    from stock_movements where sale_id='QA-RECON-ISSUE' and movement_type='issued';
  insert into _recon values
    (5, 'idempotent: issue ซ้ำ = 1 movement', '1', v_cnt::text,
     case when v_cnt = 1 then 'PASS' else 'FAIL' end);
end $$;

-- ══════ ผลรวม (query เดียว เห็นครบ) ══════
select seq            as "#",
       check_name     as "เช็ก",
       expect         as "คาด",
       got            as "ได้จริง",
       result         as "ผล",
       (select case when count(*) filter (where result='FAIL')=0
                    then '✅ P1-2 ผ่าน (0 FAIL)'
                    else '❌ มี ' || count(*) filter (where result='FAIL') || ' FAIL' end
        from _recon)  as "สรุป"
from _recon order by seq;

rollback;  -- ⛔ ไม่ commit · staging กลับสภาพเดิม 100%
-- ═══════════════════════════════════════════════════════════════════════
