-- ============================================================================
-- DocBrief OS — Stock Soft-delete (checklist ข้อ B)
-- แทน hard delete → กัน FK restrict ชน + คงประวัติ movement ไว้
-- ใช้ convention เดียวกับ doc_documents (deleted_at) เพื่อความสม่ำเสมอทั้งระบบ
-- รันบน staging · หลัง section 1–3 ของ ledger v2
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) เพิ่มคอลัมน์ soft-delete (mirror doc_documents.deleted_at)
--    เก็บ "ใครลบ" ด้วย เพื่อ audit ตาม Phase 4 (ลบได้เฉพาะ owner)
-- ----------------------------------------------------------------------------
alter table stock_records add column if not exists deleted_at timestamptz;
alter table stock_records add column if not exists deleted_by text;

-- index ช่วย query เฉพาะของที่ยัง active
create index if not exists ix_stock_records_active
  on stock_records (deleted_at) where deleted_at is null;


-- ----------------------------------------------------------------------------
-- 2) VIEW ของที่ยังใช้งานได้ — ชี้ read ของหน้า stock มาที่ view นี้
--    (แทนที่จะไปแก้ where ทีละจุดทั่วโค้ด)
-- ----------------------------------------------------------------------------
create or replace view v_stock_active as
  select * from stock_records where deleted_at is null;


-- ----------------------------------------------------------------------------
-- 3) RPC soft-delete — owner เท่านั้น (destructive intent → เข้มกว่า reviewer)
--    เรียก: supabase.rpc('soft_delete_stock_record', { p_id, p_actor })
-- ----------------------------------------------------------------------------
create or replace function soft_delete_stock_record(
  p_id    uuid,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty     integer;
  v_deleted timestamptz;
  v_sku     text;
begin
  -- 🔐 owner only (service_role/backend auth.uid()=null ผ่านได้)
  if auth.uid() is not null
     and not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner') then
    raise exception 'สิทธิ์ไม่พอ: ลบสต็อกได้เฉพาะ owner';
  end if;

  select qty, deleted_at, sku into v_qty, v_deleted, v_sku
    from stock_records where id = p_id for update;
  if not found then
    raise exception 'ไม่พบรายการสต็อก %', p_id;
  end if;
  if v_deleted is not null then
    return jsonb_build_object('id', p_id, 'already_deleted', true);
  end if;

  -- (ตัวเลือก) กันลบของที่ยังมีคงเหลือ — เปิดใช้ถ้าต้องการกฎนี้
  -- if coalesce(v_qty, 0) <> 0 then
  --   raise exception 'ลบไม่ได้: ยังมีคงเหลือ % ชิ้น (เคลียร์ก่อน)', v_qty;
  -- end if;

  update stock_records
     set deleted_at = now(), deleted_by = p_actor, updated_at = now()
   where id = p_id;

  return jsonb_build_object('id', p_id, 'sku', v_sku, 'deleted_at', now());
end $$;


-- ----------------------------------------------------------------------------
-- 4) RPC restore — กู้คืน (owner เท่านั้น) — รองรับ Phase 4 "กู้คืนเอกสาร"
-- ----------------------------------------------------------------------------
create or replace function restore_stock_record(
  p_id    uuid,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner') then
    raise exception 'สิทธิ์ไม่พอ: กู้คืนได้เฉพาะ owner';
  end if;

  update stock_records
     set deleted_at = null, deleted_by = null, updated_at = now()
   where id = p_id;

  return jsonb_build_object('id', p_id, 'restored', true);
end $$;


-- ----------------------------------------------------------------------------
-- 5) สิทธิ์เรียก
-- ----------------------------------------------------------------------------
revoke execute on function soft_delete_stock_record(uuid, text) from public, anon;
revoke execute on function restore_stock_record(uuid, text)     from public, anon;
grant  execute on function soft_delete_stock_record(uuid, text) to authenticated;
grant  execute on function restore_stock_record(uuid, text)     to authenticated;


-- ============================================================================
-- ⚠️ ต้องทำต่อฝั่งแอป/sync ให้ครบ (ไม่งั้น soft-delete ไม่เห็นผล):
--   1) หน้า list สต็อกทุกจุด → อ่านจาก v_stock_active (หรือเติม `and deleted_at is null`)
--   2) ตัว Sheet sync (stock_sync_log) → ถ้า upsert by sku ต้อง "ไม่ปลุก" แถวที่ถูกลบ
--      คือข้าม sku ที่ deleted_at is not null (ไม่งั้น sync จะกู้ของที่ลบกลับมา)
--   3) ปุ่มลบเดิม (26 ก.ค.) → เรียก RPC soft_delete_stock_record แทน hard delete
-- ============================================================================
