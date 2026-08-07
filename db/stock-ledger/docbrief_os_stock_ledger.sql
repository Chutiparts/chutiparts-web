-- ============================================================================
-- DocBrief OS — Migration เสริม: Stock Ledger + ด่านกันนับเบิ้ล + Correction Log
-- ต่อจากตารางเดิม (doc_documents / doc_line_items / stock_records / profiles)
-- "ไม่สร้างตารางซ้ำของเดิม" — เพิ่มเฉพาะ 3 ช่องที่ยังขาด
--
-- รันใน: Supabase → SQL Editor  (แนะนำรันบน dev/staging ก่อน)
-- อ้างอิง enum จริง: doc_state = received,queued,extracting,pending_review,
--                    confirmed,exporting,exported,rejected,duplicate,failed
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) STOCK_MOVEMENTS — Ledger append-only ฝั่ง "ขารับ" (bill → stock)
--    ตามรอยได้ว่าบิลไหนทำ qty ขยับ + เป็นด่านกันนับเบิ้ลตัวจริง
--    (actor เก็บเป็น text ให้ตรงกับ convention เดิมของ doc_audit / stock_link_audit)
-- ----------------------------------------------------------------------------
create table if not exists stock_movements (
  id              uuid primary key default gen_random_uuid(),
  stock_record_id uuid not null references stock_records(id),
  qty_change      integer not null,                 -- +รับเข้า / -เบิกออก
  movement_type   text not null default 'received'
                  check (movement_type in ('received','issued','adjust','reversal')),
  unit_cost       numeric,

  -- อ้างอิงต้นทาง (เลือกได้ว่าเป็นบิลรับเข้า หรือรายการขาย)
  document_id     uuid references doc_documents(id),
  line_item_id    uuid references doc_line_items(id),
  sale_id         text,                             -- เผื่อฝั่งขาย (ให้ล้อกับ stock_link_audit)

  actor           text,
  note            text,
  created_at      timestamptz not null default now()
);

-- 🔒 กันนับเบิ้ล: 1 บรรทัดบิล → ลง ledger ได้ครั้งเดียว
--    กดยืนยันซ้ำ / สองคนกดพร้อมกัน → insert ที่สอง error แล้ว rollback ทั้งก้อน
create unique index if not exists ux_stock_movements_line
  on stock_movements (line_item_id) where line_item_id is not null;

create index if not exists ix_stock_movements_stock on stock_movements (stock_record_id);
create index if not exists ix_stock_movements_doc   on stock_movements (document_id);


-- ----------------------------------------------------------------------------
-- 2) doc_line_items — เพิ่ม flag ว่าบรรทัดนี้ลงสต็อกแล้วหรือยัง
-- ----------------------------------------------------------------------------
alter table doc_line_items add column if not exists posted    boolean not null default false;
alter table doc_line_items add column if not exists posted_at timestamptz;


-- ----------------------------------------------------------------------------
-- 3) doc_corrections — เก็บ "ชื่อดิบ → คนเลือก SKU/แก้ค่าอะไร" ระดับช่อง
--    (ของเดิม doc_metrics เก็บแค่ตัวนับ fields_corrected → ตัวนี้เก็บรายละเอียด
--     สำหรับทำ Mapping Dictionary / auto-SKU ในเฟส scale-up)
-- ----------------------------------------------------------------------------
create table if not exists doc_corrections (
  id                     uuid primary key default gen_random_uuid(),
  document_id            uuid references doc_documents(id) on delete set null,
  line_item_id           uuid references doc_line_items(id) on delete set null,

  field                  text,          -- 'sku','unit_price','vat','car_model','doc_date' ...
  ai_value               text,          -- ค่าที่ Claude อ่านได้
  human_value            text,          -- ค่าที่คนแก้เป็น

  raw_part_name          text,          -- ชื่อดิบในบิล (คีย์หลักของ mapping dictionary)
  car_model              text,
  chosen_stock_record_id uuid references stock_records(id),

  actor                  text,
  created_at             timestamptz not null default now()
);
create index if not exists ix_doc_corrections_raw on doc_corrections (raw_part_name);


-- ----------------------------------------------------------------------------
-- 4) RPC ยืนยันเข้าสต็อก — atomic + กันนับเบิ้ล + บันทึก audit เดิม
--    ตรวจ state = 'pending_review' เท่านั้น (ตาม enum doc_state จริง)
--    เรียกได้จากทุก client:  supabase.rpc('confirm_stock_document', { p_document_id, p_actor })
-- ----------------------------------------------------------------------------
create or replace function confirm_stock_document(
  p_document_id uuid,
  p_actor       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state doc_state;
begin
  -- ล็อกแถวเอกสารกันแย่งกันยืนยัน
  select state into v_state from doc_documents where id = p_document_id for update;

  if v_state is null then
    raise exception 'ไม่พบเอกสาร %', p_document_id;
  end if;
  if v_state <> 'pending_review' then
    raise exception 'เอกสาร % ไม่ได้อยู่สถานะ pending_review (ปัจจุบัน: %)', p_document_id, v_state;
  end if;

  -- ลง ledger เฉพาะบรรทัดที่จับคู่ SKU แล้ว (ที่ยังไม่จับคู่ = พักไว้ ไม่บล็อกทั้งใบ)
  -- ถ้าเคยโพสต์แล้ว unique index ux_stock_movements_line จะเด้ง error → rollback
  insert into stock_movements
    (stock_record_id, qty_change, movement_type, unit_cost, document_id, line_item_id, actor)
  select li.stock_record_id,
         round(li.qty)::int,
         'received',
         li.unit_price,
         li.document_id,
         li.id,
         p_actor
  from doc_line_items li
  where li.document_id = p_document_id
    and li.stock_record_id is not null
    and li.posted = false;

  update doc_line_items
     set posted = true, posted_at = now()
   where document_id = p_document_id and stock_record_id is not null;

  update doc_documents
     set state = 'confirmed', updated_at = now()
   where id = p_document_id;

  -- บันทึกลง audit เดิมของระบบ (doc_audit ใช้ from_state/to_state เป็น doc_state)
  insert into doc_audit (document_id, actor, action, from_state, to_state, metadata)
  values (p_document_id, p_actor, 'confirm_stock',
          'pending_review'::doc_state, 'confirmed'::doc_state, '{}'::jsonb);
end $$;


-- ============================================================================
-- 5) ⚠️ ต้องเลือก 1 ทาง — "จำนวนคงเหลือ" ให้ใครเป็นเจ้าของ?
--    เพราะ stock_sync_log บอกว่า stock_records ถูก upsert จาก source ภายนอก
--    (น่าจะ Google Sheet) ถ้าเขียน qty ตรงๆ อาจโดน sync ทับ
--    → dev เลือกตามพฤติกรรม sync จริง แล้วเปิดใช้แค่ "หนึ่ง" ทางเท่านั้น
-- ============================================================================

-- ── ทาง A: แอปเป็นเจ้าของ qty ──────────────────────────────────────────────
-- ใช้เมื่อ: sync ไม่ทับ qty (sync แตะแค่ชื่อ/ราคา) หรือหยุด sync ฝั่ง qty แล้ว
-- ผล: ทุก movement บวก/ลบ stock_records.qty ทันที
--
-- create or replace function apply_stock_movement()
-- returns trigger language plpgsql as $$
-- begin
--   update stock_records
--      set qty = coalesce(qty,0) + new.qty_change, updated_at = now()
--    where id = new.stock_record_id;
--   return new;
-- end $$;
-- drop trigger if exists trg_apply_stock_movement on stock_movements;
-- create trigger trg_apply_stock_movement after insert on stock_movements
--   for each row execute function apply_stock_movement();

-- ── ทาง B: Sheet เป็นเจ้าของ qty (baseline) ────────────────────────────────
-- ใช้เมื่อ: sync ทับ qty ทุกรอบ → ห้ามเขียน qty ตรงๆ
-- ผล: ไม่แตะ stock_records.qty เลย, on-hand จริง = baseline + ผลรวม ledger
--     ที่ยังไม่ถูก sync กลับ (ใช้ view คำนวณ, แล้วค่อย push ยอดรับกลับขึ้น Sheet)
--
-- create or replace view v_stock_onhand as
-- select s.id, s.sku, s.part_name, s.car_model,
--        s.qty                                   as synced_qty,
--        coalesce(sum(m.qty_change), 0)          as ledger_delta,
--        s.qty + coalesce(sum(m.qty_change), 0)  as computed_onhand
-- from stock_records s
-- left join stock_movements m on m.stock_record_id = s.id
-- group by s.id;


-- ============================================================================
-- 6) RLS (รันหลังยืนยัน login flow แล้ว — ใช้ profiles.role เดิม)
--    ⚠️ ปรับ 'owner' ให้ตรงกับค่า role จริงในตาราง profiles ของคุณ
-- ============================================================================
-- create or replace function is_owner()
-- returns boolean language sql stable as $$
--   select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner');
-- $$;
--
-- -- stock_movements = APPEND-ONLY: อ่าน+เพิ่มได้ ห้ามแก้/ลบ (แก้ยอดด้วย type='reversal')
-- alter table stock_movements enable row level security;
-- drop policy if exists p_move_sel on stock_movements;
-- drop policy if exists p_move_ins on stock_movements;
-- create policy p_move_sel on stock_movements for select to authenticated using (true);
-- create policy p_move_ins on stock_movements for insert to authenticated with check (true);
--
-- alter table doc_corrections enable row level security;
-- drop policy if exists p_corr_sel on doc_corrections;
-- drop policy if exists p_corr_ins on doc_corrections;
-- create policy p_corr_sel on doc_corrections for select to authenticated using (true);
-- create policy p_corr_ins on doc_corrections for insert to authenticated with check (true);
