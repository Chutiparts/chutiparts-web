-- ============================================================================
-- DocBrief OS — Stock Ledger MASTER (รวมทุก section · เรียงตามลำดับรัน)
-- อัปเดต 29 ก.ค. 2026 · รวม refinement ที่เคาะแล้ว (overload by_sku, qty default 0)
--
-- ⛔ รันบน STAGING เท่านั้น · prod หลัง 4 ส.ค. (Proof Mode)
-- ⛔ SECTION 6 (trigger ทาง A) + SECTION 7 (cutover) = รัน "หลัง shadow ผ่าน Q1/Q2=0"
--    ที่เหลือ (1–5) รันได้เลยตอนตั้ง staging
--
-- ลำดับ:
--   SECTION 1  ledger table + index กันนับเบิ้ล (received)
--   SECTION 2  doc_line_items.posted + RPC confirm_stock_document
--   SECTION 3  stock_records: qty default 0 + backfill null
--   SECTION 4  soft-delete (deleted_at/deleted_by + view + RPC + restore)
--   SECTION 5  issue functions: record_stock_issue (by id) + _by_sku (overload)
--   SECTION 6  [รอ shadow] trigger ทาง A
--   SECTION 7  [รอ shadow] cutover snapshot + แพตเทิร์นปลด Path B
--   SECTION 8  [รอ login flow] RLS
-- ============================================================================


-- ############################################################################
-- SECTION 1 — STOCK_MOVEMENTS (ledger append-only)
-- ############################################################################
create table if not exists stock_movements (
  id              uuid primary key default gen_random_uuid(),
  stock_record_id uuid not null references stock_records(id) on delete restrict,
  qty_change      integer not null,                 -- +รับเข้า / -เบิกออก
  movement_type   text not null default 'received'
                  check (movement_type in ('received','issued','adjust','reversal')),
  unit_cost       numeric,
  document_id     uuid references doc_documents(id),
  line_item_id    uuid references doc_line_items(id),
  sale_id         text,
  actor           text,
  note            text,
  created_at      timestamptz not null default now()
);

-- กันนับเบิ้ลฝั่งรับ: 1 บรรทัดบิล → received ได้ครั้งเดียว
create unique index if not exists ux_stock_movements_line
  on stock_movements (line_item_id) where line_item_id is not null;

-- กันนับเบิ้ลฝั่งขาย: 1 แถว sales_records (id เป็น sale_id) → issued ได้ครั้งเดียว
create unique index if not exists ux_movement_per_sale
  on stock_movements (sale_id)
  where sale_id is not null and movement_type = 'issued';

create index if not exists ix_stock_movements_stock on stock_movements (stock_record_id);
create index if not exists ix_stock_movements_doc   on stock_movements (document_id);


-- ############################################################################
-- SECTION 2 — doc_line_items.posted + RPC ยืนยันเข้าสต็อก (received)
-- ############################################################################
alter table doc_line_items add column if not exists posted    boolean not null default false;
alter table doc_line_items add column if not exists posted_at timestamptz;

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
  -- role guard · profiles.role จริง = 'admin_super' (owner) · เผื่อ owner/reviewer อนาคต
  if auth.uid() is not null
     and not exists (select 1 from profiles p where p.id = auth.uid()
                     and p.role in ('admin_super','owner','reviewer')) then
    raise exception 'สิทธิ์ไม่พอ: ต้องเป็น admin_super/owner/reviewer';
  end if;

  select state into v_state from doc_documents where id = p_document_id for update;
  if v_state is null then
    raise exception 'ไม่พบเอกสาร %', p_document_id;
  end if;
  if v_state <> 'pending_review' then
    raise exception 'เอกสาร % ไม่ได้อยู่สถานะ pending_review (ปัจจุบัน: %)', p_document_id, v_state;
  end if;

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

  select count(*) into v_remaining
    from doc_line_items
   where document_id = p_document_id and stock_record_id is null;

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
    'document_id', p_document_id, 'lines_posted', v_posted,
    'remaining_unmatched', v_remaining, 'state', v_final_state);
end $$;

revoke execute on function confirm_stock_document(uuid, text) from public, anon;
grant  execute on function confirm_stock_document(uuid, text) to authenticated;


-- ############################################################################
-- SECTION 3 — stock_records.qty: default 0 + backfill null
--   (จำเป็นเพราะ sync ทาง A เลิกเขียน qty → insert sku ใหม่ต้องได้ 0 ไม่ใช่ null)
-- ############################################################################
alter table stock_records alter column qty set default 0;
update stock_records set qty = 0 where qty is null;


-- ############################################################################
-- SECTION 4 — Soft-delete (deleted_at/deleted_by + view + RPC + restore)
-- ############################################################################
alter table stock_records add column if not exists deleted_at timestamptz;
alter table stock_records add column if not exists deleted_by text;

create index if not exists ix_stock_records_active
  on stock_records (deleted_at) where deleted_at is null;

create or replace view v_stock_active as
  select * from stock_records where deleted_at is null;

create or replace function soft_delete_stock_record(p_id uuid, p_actor text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_deleted timestamptz; v_sku text;
begin
  if auth.uid() is not null
     and not exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin_super','owner')) then
    raise exception 'สิทธิ์ไม่พอ: ลบสต็อกได้เฉพาะ owner';
  end if;

  select deleted_at, sku into v_deleted, v_sku from stock_records where id = p_id for update;
  if not found then raise exception 'ไม่พบรายการสต็อก %', p_id; end if;
  if v_deleted is not null then
    return jsonb_build_object('id', p_id, 'already_deleted', true);
  end if;

  update stock_records set deleted_at = now(), deleted_by = p_actor, updated_at = now()
   where id = p_id;
  return jsonb_build_object('id', p_id, 'sku', v_sku, 'deleted_at', now());
end $$;

create or replace function restore_stock_record(p_id uuid, p_actor text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin_super','owner')) then
    raise exception 'สิทธิ์ไม่พอ: กู้คืนได้เฉพาะ owner';
  end if;
  update stock_records set deleted_at = null, deleted_by = null, updated_at = now() where id = p_id;
  return jsonb_build_object('id', p_id, 'restored', true);
end $$;

revoke execute on function soft_delete_stock_record(uuid, text) from public, anon;
revoke execute on function restore_stock_record(uuid, text)     from public, anon;
grant  execute on function soft_delete_stock_record(uuid, text) to authenticated;
grant  execute on function restore_stock_record(uuid, text)     to authenticated;


-- ############################################################################
-- SECTION 5 — Issue functions (ตัดสต็อกฝั่งขาย)
--   5a: record_stock_issue        — by stock_record_id (uuid ตรง)
--   5b: record_stock_issue_by_sku — overload · sell เรียกด้วย sku ตรง ๆ
--       · resolve sku (upper/trim) → active row · qty มากสุด เมื่อซ้ำ
--       · คืน matched_count · exists-check กันนับเบิ้ล · report facts (ไม่ตัดสิน policy)
-- ############################################################################

-- 5a — by id (core)
create or replace function record_stock_issue(
  p_stock_record_id uuid,
  p_qty             integer,
  p_sale_id         text    default null,
  p_actor           text    default null,
  p_unit_cost       numeric default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนที่เบิกต้อง > 0 (ได้รับ %)', p_qty;
  end if;
  if not exists (select 1 from stock_records where id = p_stock_record_id) then
    raise exception 'ไม่พบสต็อก %', p_stock_record_id;
  end if;

  -- กันนับเบิ้ล: ถ้า sale_id นี้เคยลง issued แล้ว → เงียบ (idempotent)
  if p_sale_id is not null and exists (
       select 1 from stock_movements
       where sale_id = p_sale_id and movement_type = 'issued'
     ) then
    return jsonb_build_object('already_issued', true, 'stock_record_id', p_stock_record_id);
  end if;

  insert into stock_movements
    (stock_record_id, qty_change, movement_type, unit_cost, sale_id, actor)
  values (p_stock_record_id, -p_qty, 'issued', p_unit_cost, p_sale_id, p_actor);

  return jsonb_build_object(
    'already_issued', false, 'stock_record_id', p_stock_record_id, 'qty_change', -p_qty);
exception
  -- concurrent double-submit: exists-check ผ่านทั้งคู่ แต่ unique index กันด่านสุดท้าย
  when unique_violation then
    return jsonb_build_object('already_issued', true, 'stock_record_id', p_stock_record_id);
end $$;

-- 5b — by sku (overload) · contract: { found, reason, matched_count, already_issued,
--                                       stock_record_id, qty_change }
--   reason: 'ok' | 'sku_not_found' | 'sku_deleted' | 'ambiguous'
create or replace function record_stock_issue_by_sku(
  p_sku     text,
  p_qty     integer,
  p_sale_id text    default null,
  p_actor   text    default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key         text := upper(trim(p_sku));
  v_active_cnt  int;
  v_any_cnt     int;
  v_id          uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนที่เบิกต้อง > 0 (ได้รับ %)', p_qty;
  end if;

  -- idempotent: sale_id นี้ตัดไปแล้ว → เงียบ (กันกดซ้ำ)
  if p_sale_id is not null and exists (
       select 1 from stock_movements where sale_id = p_sale_id and movement_type = 'issued'
     ) then
    return jsonb_build_object('found', true, 'reason', 'ok', 'already_issued', true);
  end if;

  -- นับแถวที่ตรง sku (active vs รวม deleted) เพื่อแยกเคส not_found / deleted / ambiguous
  select count(*) filter (where deleted_at is null),
         count(*)
    into v_active_cnt, v_any_cnt
  from stock_records
  where upper(trim(sku)) = v_key;

  if v_active_cnt = 0 then
    -- ไม่มี active: ถ้ามีแต่แบบ deleted → sku_deleted, ไม่งั้น not_found
    return jsonb_build_object(
      'found', false, 'already_issued', false,
      'matched_count', 0,
      'reason', case when v_any_cnt > 0 then 'sku_deleted' else 'sku_not_found' end);
  end if;

  if v_active_cnt > 1 then
    -- กำกวม: sell ต้องหยุด+ยืนยัน (ไม่ auto-post กันตัดผิดแถว)
    return jsonb_build_object(
      'found', true, 'already_issued', false,
      'matched_count', v_active_cnt, 'reason', 'ambiguous');
  end if;

  -- ตรง 1 แถว active → ตัดได้
  select id into v_id
  from stock_records
  where upper(trim(sku)) = v_key and deleted_at is null
  order by qty desc nulls last, created_at desc
  limit 1;

  insert into stock_movements
    (stock_record_id, qty_change, movement_type, sale_id, actor)
  values (v_id, -p_qty, 'issued', p_sale_id, p_actor);

  return jsonb_build_object(
    'found', true, 'reason', 'ok', 'already_issued', false,
    'matched_count', 1, 'stock_record_id', v_id, 'qty_change', -p_qty);
exception
  when unique_violation then
    return jsonb_build_object('found', true, 'reason', 'ok', 'already_issued', true,
                             'matched_count', 1, 'stock_record_id', v_id);
end $$;

revoke execute on function record_stock_issue(uuid,integer,text,text,numeric) from public, anon;
revoke execute on function record_stock_issue_by_sku(text,integer,text,text)  from public, anon;
grant  execute on function record_stock_issue(uuid,integer,text,text,numeric) to authenticated;
grant  execute on function record_stock_issue_by_sku(text,integer,text,text)  to authenticated;


-- ############################################################################
-- SECTION 6 — [รอ shadow ผ่าน Q1/Q2=0] trigger ทาง A
--   ⛔ อย่ารันจนกว่าจะทำ snapshot (SECTION 7 ขั้น 1) เสร็จ — ไม่งั้นยอดเบิ้ล
-- ############################################################################
create or replace function apply_stock_movement()
returns trigger language plpgsql as $$
begin
  update stock_records
     set qty = coalesce(qty,0) + new.qty_change, updated_at = now()
   where id = new.stock_record_id;
  return new;
end $$;

-- ⛔ uncomment หลัง snapshot เท่านั้น:
-- drop trigger if exists trg_apply_stock_movement on stock_movements;
-- create trigger trg_apply_stock_movement after insert on stock_movements
--   for each row execute function apply_stock_movement();


-- ############################################################################
-- SECTION 7 — [รอ shadow] CUTOVER (ทำครั้งเดียว · ห้ามสลับลำดับ)
-- ############################################################################
-- ⚠️ ก่อน cutover: งดรับสต็อกเข้าใหม่ระหว่าง shadow (ไม่งั้น snapshot ตกหล่นของรับเข้า)
--
-- ขั้น 1 — snapshot: qty := qty(baseline) − Σ sales_records.qty (by upper(trim(sku)))
--   with sold as (
--     select upper(trim(sku)) as k, sum(coalesce(qty,1)) as q
--     from sales_records group by upper(trim(sku))
--   )
--   update stock_records s
--      set qty = coalesce(s.qty,0) - coalesce(so.q,0), updated_at = now()
--     from sold so
--    where upper(trim(s.sku)) = so.k;
--
-- ขั้น 2 — เปิด trigger (uncomment SECTION 6)
-- ขั้น 3 — ปลด Path B sum 4 จุด → อ่าน qty จาก v_stock_active ตรง ๆ
--            (data-health · daily-brief · parts-search · StockSuggestion + sell:91)
--   ❌ เดิม: select sku, Σ(received) − Σ(qty||1) ...
--   ✅ ใหม่: select sku, qty as onhand from v_stock_active where ...
-- ขั้น 4 — ต่อการตัดสต็อกเข้า addTeamSale (sell/page.tsx)
--   ‼️ กฎเหล็ก: "block ก่อน insert เสมอ" — resolve sku → active row ก่อน
--      ถ้า deleted/not_found/ambiguous → return block (อย่า insert sale) กัน drift เงียบ
--   ✅ ใช้ 5a record_stock_issue (by id) เพราะ line 51 resolve stock row อยู่แล้ว
--      → block เคสเสียก่อน → insert sale → เรียก 5a ด้วย stock_record_id + sale.id
--   (5b by_sku เก็บไว้ให้ caller อื่นที่มีแค่ sku · ห้ามใช้แบบ block-after-insert)
-- ขั้น 5 — QA: ขาย 1 → qty ลด · รับบิล → qty เพิ่ม · กดซ้ำ → ไม่เบิ้ล


-- ############################################################################
-- SECTION 8 — [รอ login flow] RLS (ปรับ role ให้ตรง profiles จริง)
-- ############################################################################
-- alter table stock_movements enable row level security;
-- drop policy if exists p_move_sel on stock_movements;
-- drop policy if exists p_move_ins on stock_movements;
-- create policy p_move_sel on stock_movements for select to authenticated using (true);
-- create policy p_move_ins on stock_movements for insert to authenticated with check (true);
-- -- append-only: ไม่มี policy update/delete → แก้ยอดด้วย movement type='reversal'
