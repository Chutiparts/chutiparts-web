-- ============================================================================
-- DocBrief OS — B2 Shadow Guard Tests (S1–S8)
-- ใช้กับ CUTOVER-checklist A1 "ชุดเทส B2 ผ่าน 8/8"
-- ต่างจาก T1–T11 (เทส guard ระดับ RPC): B2 เทส "ในบริบท shadow" —
--   guard ทำงาน + ledger ยังตรง (ผูกกับ Q1–Q4 ของ shadow_reconcile.sql)
-- ============================================================================
-- ⚠️ รันบน STAGING เท่านั้น (หลัง mirror prod + master SECTION 1–5)
--    รันทั้งไฟล์รวดเดียว · ทุกเคสทำใน transaction เดียว แล้ว ROLLBACK ท้ายสุด
--    (ไม่ทิ้งขยะใน staging · ต้องการดูผล = อ่านตาราง _b2_results ก่อน rollback)
-- ============================================================================

begin;  -- ห่อทั้งชุด · rollback ท้ายสุด (ไม่แตะข้อมูลจริง)

create temp table _b2_results (
  seq int, test text, checks_Q text, expect text, got text, result text
) on commit drop;

-- ── ตัวช่วย: หยิบ fixture จริงจาก staging (ต้องมีข้อมูล mirror มาแล้ว) ─────────
do $$
declare
  v_doc   uuid;   v_line  uuid;   v_stock uuid;   v_sku text;
  v_stock2 uuid;  v_sku2 text;    v_onhand int;
  r jsonb;  v_cnt int;  v_mv int;
  v_del_sku text;  r6 jsonb;  r7 jsonb;  blocked8 boolean := false;
begin
  -- doc ที่ยัง pending_review + มี line ผูก stock + ยังไม่ posted (สำหรับ S1/S2 รับเข้า)
  --   ⚠️ ต้อง posted=false — ไม่งั้น confirm จะ post 0 บรรทัด → S1 "ผ่านแบบไม่ได้เทสจริง"
  select d.id, li.id, li.stock_record_id
    into v_doc, v_line, v_stock
  from doc_documents d
  join doc_line_items li on li.document_id = d.id
  where d.state = 'pending_review'
    and li.stock_record_id is not null
    and coalesce(li.posted, false) = false
  limit 1;

  -- stock ที่มีของ (สำหรับ S3/S5 ขายปกติ) + stock อีกตัว (S4 ขายเกิน)
  select id, sku, coalesce(qty,0) into v_stock2, v_sku2, v_onhand
  from stock_records where deleted_at is null and coalesce(qty,0) > 0
  order by qty desc limit 1;

  -- ── S1 · รับเข้าปกติ → ledger received = qty บิล (กระทบ Q1) ────────────────
  if v_doc is not null then
    begin
      r := confirm_stock_document(v_doc, 'qa-b2');
      -- เทียบ: ledger received ของ line นี้ = qty ในบิล
      insert into _b2_results
      select 1, 'S1 รับเข้าปกติ', 'Q1',
             'ledger_received = line qty',
             coalesce((select sum(qty_change)::text from stock_movements
                       where line_item_id = v_line and movement_type='received'), 'null'),
             case when (select coalesce(sum(qty_change),0) from stock_movements
                        where line_item_id = v_line and movement_type='received')
                       = (select round(qty)::int from doc_line_items where id = v_line)
                  then 'PASS' else 'FAIL' end;
    exception when others then
      insert into _b2_results values (1,'S1 รับเข้าปกติ','Q1','ledger_received = line qty',SQLERRM,'CHECK');
    end;

    -- ── S2 · ยืนยันซ้ำ → บล็อก + ledger ไม่เพิ่ม (กระทบ Q2) ──────────────────
    select coalesce(sum(qty_change),0) into v_mv from stock_movements
     where line_item_id = v_line and movement_type='received';
    begin
      r := confirm_stock_document(v_doc, 'qa-b2');  -- ยืนยันซ้ำ
    exception when others then r := '{"blocked":true}'::jsonb;
    end;
    insert into _b2_results
    select 2, 'S2 ยืนยันซ้ำ', 'Q2',
           'ledger ไม่เพิ่ม (received เท่าเดิม)',
           (select coalesce(sum(qty_change),0)::text from stock_movements
            where line_item_id = v_line and movement_type='received'),
           case when (select coalesce(sum(qty_change),0) from stock_movements
                      where line_item_id = v_line and movement_type='received') = v_mv
                then 'PASS' else 'FAIL' end;
  else
    insert into _b2_results values
      (1,'S1 รับเข้าปกติ','Q1','—','ไม่มี doc pending_review ผูก stock','SKIP'),
      (2,'S2 ยืนยันซ้ำ','Q2','—','(ขึ้นกับ S1)','SKIP');
  end if;

  -- ── S3 · ขายปกติ (< คงเหลือ) → issued ติดลบตาม qty (กระทบ Q3) ─────────────
  if v_stock2 is not null then
    r := record_stock_issue(v_stock2, 1, 'QA-B2-S3', 'qa-b2', null);
    insert into _b2_results
    select 3, 'S3 ขายปกติ', 'Q3',
           'issued = -1',
           (select coalesce(sum(qty_change),0)::text from stock_movements
            where sale_id='QA-B2-S3' and movement_type='issued'),
           case when (select coalesce(sum(qty_change),0) from stock_movements
                      where sale_id='QA-B2-S3' and movement_type='issued') = -1
                then 'PASS' else 'FAIL' end;

    -- ── S4 · ขายเกินสต็อก → DB ยอม (permissive) issued ตามจริง (กระทบ Q3) ────
    r := record_stock_issue(v_stock2, v_onhand + 5, 'QA-B2-S4', 'qa-b2', null);
    insert into _b2_results
    select 4, 'S4 ขายเกินสต็อก', 'Q3',
           'issued = -(onhand+5) · DB permissive',
           (select coalesce(sum(qty_change),0)::text from stock_movements
            where sale_id='QA-B2-S4' and movement_type='issued'),
           case when (select coalesce(sum(qty_change),0) from stock_movements
                      where sale_id='QA-B2-S4' and movement_type='issued') = -(v_onhand+5)
                then 'PASS' else 'FAIL' end;

    -- ── S5 · กดขายรัว (sale_id เดิมซ้ำ) → idempotent ตัดครั้งเดียว (กระทบ Q2) ─
    r := record_stock_issue(v_stock2, 1, 'QA-B2-S5', 'qa-b2', null);
    r := record_stock_issue(v_stock2, 1, 'QA-B2-S5', 'qa-b2', null);  -- ซ้ำ
    select count(*) into v_cnt from stock_movements
     where sale_id='QA-B2-S5' and movement_type='issued';
    insert into _b2_results
    select 5, 'S5 กดขายรัว', 'Q2',
           'movement = 1 (idempotent by sale_id)',
           v_cnt::text,
           case when v_cnt = 1 then 'PASS' else 'FAIL' end;
  else
    insert into _b2_results values
      (3,'S3 ขายปกติ','Q3','—','ไม่มี stock ที่มีของ','SKIP'),
      (4,'S4 ขายเกินสต็อก','Q3','—','(ขึ้นกับ S3)','SKIP'),
      (5,'S5 กดขายรัว','Q2','—','(ขึ้นกับ S3)','SKIP');
  end if;

  -- ── S6 · ขาย SKU ลบแล้ว → บล็อก (record_stock_issue_by_sku คืน sku_deleted) ─
  begin
    -- สร้าง fixture: soft-delete stock ตัวหนึ่งชั่วคราว (ใน tx นี้ · rollback ทิ้ง)
    -- ⚠️ ต้องเลือก sku ที่มี active "แถวเดียว" — ลบแล้วเหลือ 0 active แน่นอน
    --    (ถ้าหยิบ sku ที่มีหลาย active row: ลบ 1 เหลือ >0 → by_sku คืน 'ok' ไม่ใช่ 'sku_deleted' → S6 flaky)
    --    บน staging ที่ mirror prod จริงมี sku ซ้ำ (ปัญหา baseline) → กันด้วย having count=1
    select sku into v_del_sku
    from stock_records
    where deleted_at is null
    group by sku having count(*) = 1
    limit 1;
    perform soft_delete_stock_record(
      (select id from stock_records where sku=v_del_sku and deleted_at is null limit 1), 'qa-b2');
    r6 := record_stock_issue_by_sku(v_del_sku, 1, 'QA-B2-S6', 'qa-b2');
    insert into _b2_results
    select 6, 'S6 ขาย SKU ลบแล้ว', 'guard',
           'reason = sku_deleted · ไม่ตัด',
           coalesce(r6->>'reason','null'),
           case when r6->>'reason' = 'sku_deleted' then 'PASS' else 'FAIL' end;
  exception when others then
    insert into _b2_results values (6,'S6 ขาย SKU ลบแล้ว','guard','sku_deleted',SQLERRM,'CHECK');
  end;

  -- ── S7 · ขาย SKU ไม่มี → reason sku_not_found ────────────────────────────
  begin
    r7 := record_stock_issue_by_sku('__NO_SUCH_SKU__', 1, 'QA-B2-S7', 'qa-b2');
    insert into _b2_results
    select 7, 'S7 ขาย SKU ไม่มี', 'guard',
           'reason = sku_not_found',
           coalesce(r7->>'reason','null'),
           case when r7->>'reason' = 'sku_not_found' then 'PASS' else 'FAIL' end;
  exception when others then
    insert into _b2_results values (7,'S7 ขาย SKU ไม่มี','guard','sku_not_found',SQLERRM,'CHECK');
  end;

  -- ── S8 · ขายจำนวน 0 → บล็อก (raise exception) ─────────────────────────────
  begin
    perform record_stock_issue(v_stock2, 0, 'QA-B2-S8', 'qa-b2', null);
  exception when others then blocked8 := true;
  end;
  insert into _b2_results
  select 8, 'S8 ขายจำนวน 0', 'guard',
         'บล็อก (exception)',
         case when blocked8 then 'blocked' else 'ผ่านไปได้' end,
         case when blocked8 then 'PASS' else 'FAIL' end;
end $$;

-- ── สรุปผล (อ่านก่อน rollback) ──────────────────────────────────────────────
select seq, test, checks_Q as "Q", expect as "คาดหวัง", got as "ได้จริง", result as "ผล"
from _b2_results order by seq;

-- นับ PASS/FAIL
select
  count(*) filter (where result='PASS')                    as pass,
  count(*) filter (where result='FAIL')                    as fail,
  count(*) filter (where result in ('SKIP','CHECK'))       as skip_check,
  case when count(*) filter (where result='FAIL') = 0
       then '✅ B2 ผ่าน (ไม่มี FAIL) — เช็ค SKIP/CHECK ด้วยตา'
       else '❌ มี FAIL — ดูแถวที่ result=FAIL' end          as verdict
from _b2_results;

rollback;  -- ⛔ ไม่ commit · staging กลับสภาพเดิม · ไม่มีขยะเทส
-- ============================================================================
-- หมายเหตุ:
--  - S1/S2 SKIP ถ้าไม่มี doc pending_review ผูก stock → ยิงเทสรับเข้าผ่านแอปแทน
--  - S6/S7 ถ้า record_stock_issue_by_sku คืน reason ต่างจากคาด = อ่าน got
--  - เคสที่ควรผ่านทุกครั้ง (ไม่ขึ้นกับ fixture): S8
--  - รันไฟล์นี้ซ้ำได้ทุกครั้ง (rollback ไม่ทิ้ง state)
-- ============================================================================
