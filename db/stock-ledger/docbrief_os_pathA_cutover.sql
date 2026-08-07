-- ============================================================================
-- DocBrief OS — Path A Cutover Kit (checklist C, ส่วนที่ไม่พึ่งโค้ด sync)
-- ‼️ รัน "ตอน shadow ผ่านเกณฑ์ Q1=0 + Q2=0 แล้วเท่านั้น" (run order ข้อ 4)
--    ไม่ใช่รันตอนนี้ — ตอนนี้ยังอยู่ช่วง shadow (trigger ต้องปิดไว้)
--
-- ทาง A = แอปเป็นเจ้าของ qty · ledger เป็น source of truth เดียว
--   received (+) : จาก confirm_stock_document (มีแล้ว)
--   issued   (−) : จาก record_stock_issue (ไฟล์นี้) ← ต้องต่อเข้าจุดขาย
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) ฟังก์ชันฝั่งขาย — ลง issued movement (เรียกทุกครั้งที่มีการขาย/เบิกออก)
--    idempotent ต่อ (sale_id, stock_record_id) กันเบิลตอน retry
-- ----------------------------------------------------------------------------
create or replace function record_stock_issue(
  p_stock_record_id uuid,
  p_qty             integer,          -- จำนวนที่ขาย/เบิก (ใส่เป็นบวก → บันทึกเป็น −qty)
  p_sale_id         text    default null,
  p_actor           text    default null,
  p_unit_cost       numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนที่เบิกต้อง > 0 (ได้รับ %)', p_qty;
  end if;
  if not exists (select 1 from stock_records where id = p_stock_record_id) then
    raise exception 'ไม่พบสต็อก %', p_stock_record_id;
  end if;

  insert into stock_movements
    (stock_record_id, qty_change, movement_type, unit_cost, sale_id, actor)
  values
    (p_stock_record_id, -p_qty, 'issued', p_unit_cost, p_sale_id, p_actor);

  return jsonb_build_object(
    'stock_record_id', p_stock_record_id,
    'qty_change',      -p_qty,
    'sale_id',         p_sale_id
  );
end $$;

-- 🔒 กันนับเบิ้ลฝั่งขาย: 1 แถว sales_records (ใช้ id เป็น p_sale_id) → issued ได้ครั้งเดียว
--    (WIRE flag: stock_movements เดิม unique แค่ line_item_id → เพิ่มตัวนี้ให้ฝั่งขาย)
create unique index if not exists ux_movement_per_sale
  on stock_movements (sale_id)
  where sale_id is not null and movement_type = 'issued';

revoke execute on function record_stock_issue(uuid,integer,text,text,numeric) from public, anon;
grant  execute on function record_stock_issue(uuid,integer,text,text,numeric) to authenticated;


-- ----------------------------------------------------------------------------
-- 2) เปิด trigger ทาง A — movement ทุกแถวปรับ stock_records.qty อัตโนมัติ
--    ⚠️ AFTER INSERT → "ไม่" ย้อนคำนวณ movement ที่บันทึกช่วง shadow (สำคัญ ดูข้อ 3)
-- ----------------------------------------------------------------------------
create or replace function apply_stock_movement()
returns trigger language plpgsql as $$
begin
  update stock_records
     set qty = coalesce(qty,0) + new.qty_change, updated_at = now()
   where id = new.stock_record_id;
  return new;
end $$;

-- ⛔ อย่าเพิ่งรันบรรทัดล่างจนกว่าจะทำ snapshot ในข้อ 3 เสร็จ (ไม่งั้นยอดเบิ้ล)
-- drop trigger if exists trg_apply_stock_movement on stock_movements;
-- create trigger trg_apply_stock_movement after insert on stock_movements
--   for each row execute function apply_stock_movement();


-- ============================================================================
-- 3) 🔑 ลำดับ CUTOVER (ทำครั้งเดียว · ห้ามสลับ) — จุดเสี่ยงสุดของทั้งงาน
--
-- ขั้น 1 — snapshot ยอด on-hand จริง "ปัจจุบัน" เข้า stock_records.qty
--   สูตรจริง (จาก WIRE): on-hand = qty(baseline จาก Sheet) − Σ sales_records.qty
--   จับคู่ด้วย upper(trim(sku)) ให้ตรงกับ Path B sum ที่ 4 จุดใช้อยู่เป๊ะ
--   *** materialize การลบนี้ครั้งเดียว → หลังจากนี้ qty = on-hand จริง ***
--
--   with sold as (
--     select upper(trim(sku)) as k, sum(coalesce(qty,1)) as q
--     from sales_records group by upper(trim(sku))
--   )
--   update stock_records s
--      set qty = coalesce(s.qty,0) - coalesce(so.q,0), updated_at = now()
--     from sold so
--    where upper(trim(s.sku)) = so.k;
--   -- (sku ที่ไม่เคยขาย: qty คงเดิม = baseline ถูกต้องอยู่แล้ว)
--
-- ขั้น 2 — เปิด trigger (uncomment ข้อ 2 ด้านบน)
--   จากนาทีนี้ movement ใหม่เท่านั้นที่ขยับ qty · ของเก่าไม่ย้อนคำนวณ
--   → snapshot ขั้น 1 จึง "ต้อง" เป็นยอดที่รวม shadow แล้ว (logic เดิมนับให้อยู่แล้ว)
--
-- ขั้น 3 — สลับ read ทั้ง 4 จุดให้อ่าน qty จาก v_stock_active (เลิกใช้ Path B sum)
--   data-health · daily-brief · parts-search · StockSuggestion
--
-- ขั้น 4 — ต่อ record_stock_issue() เข้าทุกจุดที่มีการขาย
--   ถ้าพลาดจุดใด qty จุดนั้นจะไม่ลด → ใช้ Q3 ของ shadow_reconcile จับส่วนต่าง
--
-- ขั้น 5 — QA: ขาย 1 รายการ → qty ลดตามจริง · รับบิล → qty เพิ่มตามจริง
-- ============================================================================


-- ============================================================================
-- 4) แพตเทิร์นแก้ 4 จุดอ่าน on-hand (ขั้น 3) — จาก Path B sum → อ่าน qty ตรง
--
--   ❌ เดิม (Path B sum กระจาย 4 ที่):
--      select sku, (received_sum - issued_sum) as onhand from ... group by ...
--
--   ✅ ใหม่ (ทาง A — qty คือ source of truth แล้ว):
--      select sku, qty as onhand from v_stock_active where ...
--
--   ผลลัพธ์: ลบ logic sum ที่กระจัดกระจาย → อ่านคอลัมน์เดียว เร็วกว่า ตรงกันทุกจุด
-- ============================================================================
