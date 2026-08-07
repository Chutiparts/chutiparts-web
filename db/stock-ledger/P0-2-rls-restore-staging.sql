-- ═══════════════════════════════════════════════════════════════════════
-- P0-2 — เปิด RLS คืนบน STAGING + ยืนยัน policy  (DEV-TASK รอบ 2, ข้อ 1)
-- ─────────────────────────────────────────────────────────────────────
-- บริบท: 30 ก.ค. restore staging ด้วย `drop schema public; create schema public`
--        + ปิด RLS ทุกตารางตอนเทส (ให้ anon อ่าน stock ได้)
--        → ต้องเปิด RLS คืน + ยืนยัน grant/policy ให้ app ยังทำงานได้
--
-- 🔒 STAGING เท่านั้น · ห้ามแตะ prod (prod หลัง 4 ส.ค. + SECTION 8 ตอน cutover)
-- 👤 Owner รันเองใน Supabase SQL Editor · idempotent (รันซ้ำได้)
-- ⚠️ รัน PART A ก่อน → ส่งผลกลับมารีวิว → ค่อยรัน PART B (กันเปิด RLS แล้ว app พัง)
-- ═══════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ PART A — DISCOVERY (อ่านอย่างเดียว · รันก่อน · ส่งผล 3 ตารางกลับมา) ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- A1. ตารางไหน RLS ปิดอยู่บ้าง  (rls_on = false คือที่ต้องเปิดคืน)
select relname as table_name, relrowsecurity as rls_on, relforcerowsecurity as force_rls
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relrowsecurity asc, relname;

-- A2. policy ที่ยังเหลืออยู่ (ดูว่า dump พก policy มาไหม หรือหายตอน drop schema)
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- A3. grant ระดับ schema (drop schema ลบ grant เดิม → ถ้าหายต้องคืนใน PART B)
select r.rolname,
       has_schema_privilege(r.rolname, 'public', 'USAGE')  as usage,
       has_schema_privilege(r.rolname, 'public', 'CREATE') as create
from pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role');

-- 👉 ส่งผล A1/A2/A3 กลับมา แล้วเราจะยืนยัน PART B ให้ตรงสภาพจริง
--    (โดยเฉพาะถ้า A1 มีตารางที่ anon ต้องอ่าน — products/content/garages/… — แต่ A2 ไม่มี policy
--     ห้ามเปิด RLS ตารางนั้นจนกว่าจะมี SELECT policy คืน ไม่งั้นหน้าเว็บเห็น 0 แถว)


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ PART B — RE-ENABLE + FIX (รันหลังรีวิว PART A ร่วมกันแล้วเท่านั้น)  ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- B0. คืน grant ระดับ schema (เผื่อ drop schema ลบไป — idempotent ปลอดภัย)
grant usage on schema public to anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────
-- B1. products — anon อ่านได้เฉพาะ is_published = true  (หน้าเว็บ/แคตตาล็อกใช้)
--     write ทั้งหมด (sync/admin) ผ่าน service_role → bypass RLS ไม่กระทบ
-- ───────────────────────────────────────────────────────────────────
alter table products enable row level security;
drop policy if exists products_public_read on products;
create policy products_public_read on products
  for select to anon, authenticated
  using (is_published = true);

-- ───────────────────────────────────────────────────────────────────
-- B2. contact_leads — anon INSERT ได้อย่างเดียว · ห้าม SELECT
--     (server อ่านผ่าน svc()/service_role → bypass · ปุ่มฟอร์มลูกค้า = INSERT)
--     ไม่สร้าง SELECT policy = anon อ่านไม่ได้ = ตามเกณฑ์
-- ───────────────────────────────────────────────────────────────────
alter table contact_leads enable row level security;
drop policy if exists contact_leads_anon_insert on contact_leads;
create policy contact_leads_anon_insert on contact_leads
  for insert to anon, authenticated
  with check (true);
-- (ยืนยัน: ไม่มี policy select/update/delete ให้ anon → CRUD อื่นถูกบล็อก)

-- ───────────────────────────────────────────────────────────────────
-- B3. finance_entries — ไม่มี policy ให้ anon/authenticated เลย
--     RLS on + ไม่มี policy = ทุก role ถูกบล็อก ยกเว้น service_role (bypass)
-- ───────────────────────────────────────────────────────────────────
alter table finance_entries enable row level security;
drop policy if exists finance_entries_anon_read   on finance_entries;  -- เผื่อมีตกค้าง
drop policy if exists finance_entries_public_read  on finance_entries;
-- ตั้งใจไม่ create policy ใด ๆ

-- ───────────────────────────────────────────────────────────────────
-- B4. stock_movements — append-only (ตรง SECTION 8 ของ master SQL)
--     SELECT + INSERT ให้ authenticated · ไม่มี update/delete = แก้ยอดด้วย reversal
-- ───────────────────────────────────────────────────────────────────
alter table stock_movements enable row level security;
drop policy if exists p_move_sel on stock_movements;
drop policy if exists p_move_ins on stock_movements;
create policy p_move_sel on stock_movements for select to authenticated using (true);
create policy p_move_ins on stock_movements for insert to authenticated with check (true);
-- append-only: ไม่มี policy update/delete โดยตั้งใจ


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ PART C — VERIFY (รันหลัง PART B · เทียบเกณฑ์ + smoke test)         ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- C1. RLS เปิดครบ 4 ตารางวิกฤต
select relname, relrowsecurity as rls_on
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('products','contact_leads','finance_entries','stock_movements')
order by relname;
-- คาดหวัง: rls_on = true ทั้ง 4

-- C2. policy ตรงเกณฑ์
select tablename, policyname, cmd, roles, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('products','contact_leads','finance_entries','stock_movements')
order by tablename, policyname;
-- คาดหวัง:
--   products         → products_public_read (SELECT, {anon,authenticated})
--   contact_leads    → contact_leads_anon_insert (INSERT, {anon,authenticated})
--   finance_entries  → (ไม่มีแถว = ไม่มี policy = ถูกต้อง)
--   stock_movements  → p_move_sel (SELECT) + p_move_ins (INSERT), authenticated

-- C3. smoke test ฝั่ง app (ทำใน browser ชี้ staging):
--   [ ] หน้าเว็บ/แคตตาล็อก → เห็น products published ปกติ (anon อ่านได้)
--   [ ] ส่งฟอร์มติดต่อ/ลูกค้า → INSERT contact_leads สำเร็จ
--   [ ] หน้า ops (parts-desk/brief) → อ่าน leads/finance ได้ (ผ่าน service_role)
--   [ ] finance ฝั่ง public/anon → เข้าไม่ถึง (ถูกบล็อก)

-- ═══════════════════════════════════════════════════════════════════════
-- หมายเหตุ:
-- • ถ้า PART A (A1) พบตารางอื่นที่ RLS ปิดและ anon ต้องอ่าน (เช่น content, garages,
--   garage_services) → ต้องเปิด RLS + คืน SELECT policy ของตารางนั้นด้วย
--   (garages/garage_services มีสคริปต์อยู่แล้วที่ docs/garage-directory/garage-migration-g2-rls.sql)
--   เราจะเติม B5+ ให้หลังเห็นผล A1
-- • prod: ยังไม่แตะ — SECTION 8 (stock_movements) + RLS อื่น ๆ ทำตอน cutover หลัง 4 ส.ค.
-- ═══════════════════════════════════════════════════════════════════════
