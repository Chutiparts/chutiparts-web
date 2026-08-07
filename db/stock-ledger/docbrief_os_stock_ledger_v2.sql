-- ============================================================================
-- DocBrief OS — Stock Ledger v2  (แก้ตามรีวิว WIRE 29 ก.ค. 2026)
-- เวอร์ชัน "ผอม" ตาม Proof Mode: ตัด doc_corrections ออก
--   (ข้อมูล auto-SKU กู้จาก raw_extraction + doc_line_items.stock_record_id ได้อยู่แล้ว)
--
-- แก้จากรีวิว:
--   item 1 — FK stock_record_id = ON DELETE RESTRICT (ตั้งใจ) + แนะนำ soft-delete
--   item 3 — RPC ปิดเอกสารเฉพาะเมื่อไม่มีบรรทัดค้าง → partial confirm แล้วมาต่อได้
--   item 4 — RPC เช็ค role owner/reviewer ในตัว (defense in depth) + revoke จาก anon
--   จุดเล็ก — audit metadata ใส่จำนวนบรรทัด/ค้าง เผื่อสอบย้อน
--
-- รันบน staging · ลำดับ: section 1–4 ก่อน (ยังไม่แตะ qty) → เคาะ A/B → section 5
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) STOCK_MOVEMENTS — ledger append-only (ขารับ + รองรับขาออกผ่าน sale_id)
-- ----------------------------------------------------------------------------
create table if not exists stock_movements (
  id              uuid primary key default gen_random_uuid(),

  -- item 1: RESTRICT แบบตั้งใจ → ลบ stock ที่มีประวัติ movement ไม่ได้ (เป็น safety net)
  --         แนะนำเปลี่ยน "ปุ่มลบสต็อก" ให้เป็น soft-delete (ใช้ stock_records.status)
  --         แทน hard delete จะได้ไม่ชน FK และคงประวัติไว้
  stock_record_id uuid not null references stock_records(id) on delete restrict,

  qty_change      integer not null,                 -- +รับเข้า / -เบิกออก
  movement_type   text not null default 'received'
                  check (movement_type in ('received','issued','adjust','reversal')),
  unit_cost       numeric,

  document_id     uuid references doc_documents(id),
  line_item_id    uuid references doc_line_items(id),
  sale_id         text,                             -- ฝั่งขาย (ล้อกับ stock_link_audit)

  actor           text,
  note            text,
  created_at      timestamptz not null default now()
);

-- 🔒 กันนับเบิ้ล: 1 บรรทัดบิล → ลง ledger ได้ครั้งเดียว
create unique index if not exists ux_stock_movements_line
  on stock_movements (line_item_id) where line_item_id is not null;

create index if not exists ix_stock_movements_stock on stock_movements (stock_record_id);
create index if not exists ix_stock_movements_doc   on stock_movements (document_id);


-- ----------------------------------------------------------------------------
-- 2) doc_line_items — flag ว่าบรรทัดนี้ลงสต็อกแล้วหรือยัง
-- ----------------------------------------------------------------------------
alter table doc_line_items add column if not exists posted    boolean not null default false;
alter table doc_line_items add column if not exists posted_at timestamptz;


-- ----------------------------------------------------------------------------
-- 3) RPC ยืนยันเข้าสต็อก — atomic + กันนับเบิ้ล + partial-safe + role guard
--    คืน jsonb บอกผล: โพสต์กี่บรรทัด / เหลือค้างกี่บรรทัด / state สุดท้าย
--    เรียก: supabase.rpc('confirm_stock_document', { p_document_id, p_actor })
-- ----------------------------------------------------------------------------
create or replace function confirm_stock_document(
  p_document_id uuid,
  p_actor       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state       doc_state;
  v_posted      int;
  v_remaining   int;
  v_final_state doc_state;
begin
  -- 🔐 item 4: role guard ในตัวฟังก์ชัน (security definer = bypass RLS)
  --   ผู้ใช้ที่ login ต้องเป็น owner/reviewer · backend service_role (auth.uid()=null) ผ่านได้
  --   ⚠️ ปรับค่า role ('owner','reviewer') ให้ตรงกับที่ใช้จริงใน profiles
  if auth.uid() is not null
     and not exists (
       select 1 from profiles p
       where p.id = auth.uid() and p.role in ('owner','reviewer')
     ) then
    raise exception 'สิทธิ์ไม่พอ: ต้องเป็น owner หรือ reviewer';
  end if;

  -- ล็อกแถวกันแย่งกันยืนยัน
  select state into v_state from doc_documents where id = p_document_id for update;
  if v_state is null then
    raise exception 'ไม่พบเอกสาร %', p_document_id;
  end if;
  if v_state <> 'pending_review' then
    raise exception 'เอกสาร % ไม่ได้อยู่สถานะ pending_review (ปัจจุบัน: %)', p_document_id, v_state;
  end if;

  -- โพสต์เฉพาะบรรทัดที่จับคู่ SKU แล้ว + ยังไม่เคยโพสต์
  -- (บรรทัดที่โพสต์แล้วถูกข้ามด้วย posted=false → เรียกซ้ำปลอดภัย ไม่นับเบิ้ล)
  with ins as (
    insert into stock_movements
      (stock_record_id, qty_change, movement_type, unit_cost, document_id, line_item_id, actor)
    select li.stock_record_id, round(li.qty)::int, 'received', li.unit_price,
           li.document_id, li.id, p_actor
    from doc_line_items li
    where li.document_id = p_document_id
      and li.stock_record_id is not null
      and li.posted = false
    returning 1
  )
  select count(*) into v_posted from ins;

  update doc_line_items set posted = true, posted_at = now()
   where document_id = p_document_id and stock_record_id is not null and posted = false;

  -- นับบรรทัดที่ยัง "ไม่จับคู่ SKU" = ค้าง
  select count(*) into v_remaining
    from doc_line_items
   where document_id = p_document_id and stock_record_id is null;

  -- item 3: ปิดเอกสารเฉพาะเมื่อไม่มีบรรทัดค้าง — ไม่งั้นคง pending_review ให้มาต่อได้
  if v_remaining = 0 then
    v_final_state := 'confirmed';
    update doc_documents set state = 'confirmed', updated_at = now() where id = p_document_id;
    insert into doc_audit (document_id, actor, action, from_state, to_state, metadata)
    values (p_document_id, p_actor, 'confirm_stock',
            'pending_review'::doc_state, 'confirmed'::doc_state,
            jsonb_build_object('lines_posted', v_posted, 'remaining_unmatched', 0));
  else
    v_final_state := 'pending_review';
    insert into doc_audit (document_id, actor, action, from_state, to_state, metadata)
    values (p_document_id, p_actor, 'post_stock_partial',
            'pending_review'::doc_state, 'pending_review'::doc_state,
            jsonb_build_object('lines_posted', v_posted, 'remaining_unmatched', v_remaining));
  end if;

  return jsonb_build_object(
    'document_id',         p_document_id,
    'lines_posted',        v_posted,
    'remaining_unmatched', v_remaining,
    'state',               v_final_state
  );
end $$;

-- item 4 (ต่อ): กันเรียกตรงจาก client ที่ไม่ได้ login
revoke execute on function confirm_stock_document(uuid, text) from public, anon;
grant  execute on function confirm_stock_document(uuid, text) to authenticated;


-- ============================================================================
-- 4) ⚠️ เลือก 1 ทาง — เจ้าของ qty (dev เช็ค stock_sync_log ก่อน)
--    ‼️ สำคัญ: ทั้ง A และ B จะสะท้อน on-hand จริงได้ ก็ต่อเมื่อ "ฝั่งขาย" ลง
--       movement type='issued' ด้วย และปลด Path B sum 4 จุดออก
--       แนะนำรัน shadow mode ก่อน (บันทึก movement แต่ยังใช้ logic เดิมคุม qty)
--       เทียบยอด 2–3 วัน แล้วค่อยสลับ source of truth
-- ============================================================================

-- ── ทาง A: แอปเป็นเจ้าของ qty (แนะนำ + ต้องปรับ sync ไม่ให้ทับ qty) ─────────
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

-- ── ทาง B: Sheet เป็น baseline · view = baseline + ledger (รวมทั้งรับ+ขาย) ──
-- create or replace view v_stock_onhand as
-- select s.id, s.sku, s.part_name, s.car_model,
--        s.qty                                   as synced_qty,
--        coalesce(sum(m.qty_change), 0)          as ledger_delta,   -- + รับ / - ขาย
--        s.qty + coalesce(sum(m.qty_change), 0)  as computed_onhand
-- from stock_records s
-- left join stock_movements m on m.stock_record_id = s.id
-- group by s.id;


-- ============================================================================
-- 5) RLS (รันหลัง login flow ยืนยัน — ปรับ role ให้ตรง profiles จริง)
-- ============================================================================
-- alter table stock_movements enable row level security;
-- drop policy if exists p_move_sel on stock_movements;
-- drop policy if exists p_move_ins on stock_movements;
-- create policy p_move_sel on stock_movements for select to authenticated using (true);
-- create policy p_move_ins on stock_movements for insert to authenticated with check (true);
-- -- append-only: ไม่มี policy update/delete → แก้ยอดด้วย movement type='reversal'
