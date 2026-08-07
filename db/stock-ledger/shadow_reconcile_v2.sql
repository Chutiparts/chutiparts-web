-- ═══════════════════════════════════════════════════════════════════════
-- shadow_reconcile_v2.sql — Reconcile (Q1 กรองยุค ledger แล้ว)  ·  STAGING เท่านั้น
-- ─────────────────────────────────────────────────────────────────────
-- ต่างจาก v1: Q1 เพิ่ม filter `li.posted_at is not null`
--   → นับเฉพาะ line ที่ "โพสต์ผ่าน confirm_stock_document (RPC ใหม่)" เท่านั้น
--   → doc เก่าที่ confirm ก่อนมี ledger (posted_at = null) ถูกตัดออก = ไม่ปน noise
--   ∴ Q1 = 0 แถว → "ทุก line ยุค ledger ตรงบิลจริง" (ไม่ใช่ผ่านเพราะ vacuous)
-- เหตุผลใช้ posted_at (ไม่ใช่ confirmed_at): doc_documents ไม่มีคอลัมน์ confirmed_at
--   · posted_at ตั้งโดย RPC เท่านั้น = สัญญาณ "ยุค ledger" ที่แม่นระดับ line
-- 🔒 อ่านอย่างเดียว · owner รันบน staging · รันซ้ำได้
-- ═══════════════════════════════════════════════════════════════════════


-- ── Q1. ledger honesty (กรองยุค ledger) — ต้องได้ 0 แถว ─────────────────────
-- สำหรับ line ที่โพสต์ผ่าน ledger: qty ที่ลง ledger ต้อง = qty บิลเป๊ะ
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
  and li.posted_at is not null          -- ← เฉพาะยุค ledger (RPC ใหม่)
group by d.id, d.doc_no, li.id, li.part_name, li.qty
having round(li.qty)::int <> coalesce(sum(m.qty_change), 0)
order by d.doc_no;
-- ✅ 0 แถว = ผ่าน · มีแถว = ledger โพสต์ไม่ตรง (หาสาเหตุก่อน cutover)


-- ── Q1-proof. โชว์ line ยุค ledger + diff (เห็นด้วยตาว่า diff=0 จริง) ─────────
-- (Q1 ข้างบนโชว์เฉพาะ "ที่ผิด" · อันนี้โชว์ "ที่ถูก" ให้เห็นว่าเทสจริง ไม่ว่าง)
select d.doc_no, li.part_name,
       round(li.qty)::int             as line_qty,
       coalesce(sum(m.qty_change), 0) as ledger_qty,
       round(li.qty)::int - coalesce(sum(m.qty_change), 0) as diff
from doc_documents d
join doc_line_items li on li.document_id = d.id
left join stock_movements m
       on m.line_item_id = li.id and m.movement_type = 'received'
where d.state = 'confirmed'
  and li.stock_record_id is not null
  and li.posted_at is not null
group by d.doc_no, li.part_name, li.qty
order by d.doc_no;
-- คาดหวัง: diff = 0 ทุกแถว (ยุค ledger ตรงหมด)


-- ── Q2. กันนับเบิ้ล — ต้องได้ 0 แถว (ตัวชี้วัดจริง) ──────────────────────────
select line_item_id, count(*) as movement_count
from stock_movements
where line_item_id is not null
group by line_item_id
having count(*) > 1;
-- ✅ 0 แถว = ไม่มี line ไหนลง ledger เกิน 1 ครั้ง


-- ── Q3. สรุป SKU: system_qty vs ledger (received/issued) ─────────────────────
select s.sku,
       s.part_name,
       s.qty                                                   as system_qty,
       coalesce(sum(m.qty_change) filter (where m.movement_type='received'), 0) as ledger_received,
       coalesce(sum(m.qty_change) filter (where m.movement_type='issued'),   0) as ledger_issued,
       s.qty + coalesce(sum(m.qty_change), 0)                  as computed_onhand
from stock_records s
left join stock_movements m on m.stock_record_id = s.id
group by s.id, s.sku, s.part_name, s.qty
having coalesce(sum(m.qty_change), 0) <> 0        -- โชว์เฉพาะ SKU ที่มี movement (อ่านง่าย)
order by ledger_received desc nulls last
limit 200;
-- อ่านด้วยตา: received ตรงบิล · issued เป็นลบ · computed_onhand สมเหตุผล


-- ── Q4. เอกสารค้าง partial (line ยังไม่จับคู่ SKU) ───────────────────────────
select d.id, d.doc_no, d.state,
       count(*) filter (where li.stock_record_id is null) as unmatched_lines,
       count(*)                                           as total_lines
from doc_documents d
join doc_line_items li on li.document_id = d.id
where d.state = 'pending_review'
group by d.id, d.doc_no, d.state
having count(*) filter (where li.stock_record_id is null) > 0
order by unmatched_lines desc;
-- อ่านด้วยตา: จำนวนใบค้างไม่ผิดปกติ

-- ═══════════════════════════════════════════════════════════════════════
-- เกณฑ์ผ่าน P1-2:  Q1 = 0 แถว · Q1-proof diff=0 ทุกแถว · Q2 = 0 แถว
--                  Q3 received ตรง/issued ลบ สมเหตุผล · Q4 ไม่ผิดปกติ
-- ═══════════════════════════════════════════════════════════════════════
