-- ============================================================================
-- DocBrief OS — Shadow-mode Reconcile (checklist ข้อ A: เก็บตัวเลขไปเคาะ A/B)
-- รันบน staging ระหว่าง shadow mode (บันทึก movement แต่ยังใช้ logic เดิมคุมยอด)
-- อ่านอย่างเดียว ไม่แก้ข้อมูล · รันซ้ำได้ทุกวัน
-- ============================================================================


-- ── Q1. ตรวจความซื่อสัตย์ของ ledger (สำคัญสุด) ──────────────────────────────
-- สำหรับเอกสารที่ยืนยันแล้ว: qty ที่ลง ledger ต้อง = qty ในบรรทัดบิลเป๊ะ
-- ถ้ามีแถวโผล่ = ledger โพสต์ไม่ครบ/ไม่ตรง → ต้องหาสาเหตุก่อนสลับ source of truth
select d.id                               as document_id,
       d.doc_no,
       li.id                              as line_item_id,
       li.part_name,
       round(li.qty)::int                 as line_qty,
       coalesce(sum(m.qty_change), 0)     as ledger_qty,
       round(li.qty)::int - coalesce(sum(m.qty_change), 0) as diff
from doc_documents d
join doc_line_items li on li.document_id = d.id
left join stock_movements m
       on m.line_item_id = li.id and m.movement_type = 'received'
where d.state = 'confirmed'
  and li.stock_record_id is not null
group by d.id, d.doc_no, li.id, li.part_name, li.qty
having round(li.qty)::int <> coalesce(sum(m.qty_change), 0)
order by d.doc_no;


-- ── Q2. กันนับเบิ้ล: ต้องไม่มีบรรทัดที่ลง ledger เกิน 1 ครั้ง ────────────────
-- (unique index กันไว้แล้ว — query นี้คือ "ยืนยันด้วยตา" ว่าไม่มีจริง)
select line_item_id, count(*) as movement_count
from stock_movements
where line_item_id is not null
group by line_item_id
having count(*) > 1;


-- ── Q3. สรุประดับ SKU: ยอดที่ระบบโชว์ vs ยอดจาก ledger ─────────────────────
-- ใช้เทียบว่า ledger สะท้อนความจริงแค่ไหน → ตัวเลขนี้ช่วยเคาะ A/B
--   received = รับเข้าจากบิล · issued = ขายออก (จะเป็น 0 จนกว่าจะทำข้อ C)
--   ⚠️ ถ้ายังไม่ต่อฝั่งขายเข้า ledger (ข้อ C) computed_onhand จะสูงกว่าจริง
--      เพราะยังไม่หักการขาย — เป็นเรื่องปกติของ shadow ช่วงแรก
select s.sku,
       s.part_name,
       s.qty                                                   as system_qty,
       coalesce(sum(m.qty_change) filter (where m.movement_type='received'), 0) as ledger_received,
       coalesce(sum(m.qty_change) filter (where m.movement_type='issued'),   0) as ledger_issued,
       s.qty + coalesce(sum(m.qty_change), 0)                  as computed_onhand
from stock_records s
left join stock_movements m on m.stock_record_id = s.id
group by s.id, s.sku, s.part_name, s.qty
order by ledger_received desc nulls last
limit 200;


-- ── Q4. เอกสารที่ค้าง partial (มีบรรทัดยังไม่จับคู่ SKU) ─────────────────────
-- ตาม RPC ใหม่ ใบพวกนี้จะคง pending_review ไว้ให้มาโพสต์ต่อ — เอาไว้ตามงานค้าง
select d.id, d.doc_no, d.state,
       count(*) filter (where li.stock_record_id is null) as unmatched_lines,
       count(*)                                           as total_lines
from doc_documents d
join doc_line_items li on li.document_id = d.id
where d.state = 'pending_review'
group by d.id, d.doc_no, d.state
having count(*) filter (where li.stock_record_id is null) > 0
order by unmatched_lines desc;
