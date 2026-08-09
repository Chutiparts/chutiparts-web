-- ═══════════════════════════════════════════════════════════════════════
-- ANON EXPOSURE SWEEP v2 — default-deny · one result set · column-grant aware
-- ─────────────────────────────────────────────────────────────────────
-- ปรัชญา: allowlist เฉพาะ "public ชัด ๆ" · ที่เหลือ ถ้า anon อ่านได้ = VIOLATION
--   → completeness by construction (ไม่ต้องไล่ list sensitive ให้ครบ = ไม่พลาด)
--   → allowlist ต้อง "อนุรักษ์นิยม" — borderline ไม่ใส่ (ปล่อยให้ flag ยืนยันเอง ปลอดภัยกว่า)
--
-- เกณฑ์ผ่าน (เป๊ะ): ผลลัพธ์ **ไม่มีแถว 🔴 และไม่มีแถว 🟠** (ทุกแถว = ✅)
--   🔴 = ตารางที่ไม่ใช่ public แต่ anon อ่านได้ → รั่ว
--   🟠 = ตาราง public แต่ anon อ่านไม่ได้ → storefront พัง
-- รัน: prod (qaqawfvbaqyznyuuecfp) และ new store (qsdxelkcjynpkogntvdp) แล้วเทียบให้ตรง
-- ครอบคลุม: table + partitioned + view + matview · table-grant + column-grant · RLS + policy(permissive) + security_invoker
-- ขอบเขต: เช็ก role 'anon' (public/unauthenticated) — ไม่รวม authenticated (ถ้าต้องการ เช็กแยก)
-- อ่านอย่างเดียว · ปลอดภัย
-- ═══════════════════════════════════════════════════════════════════════

with pub_allow(relname) as (values
  -- ✅ public ชัดเจนเท่านั้น (storefront/directory/reference) · borderline อย่าใส่
  ('products'),('garages'),('garage_services'),('garage_reviews_meta'),('businesses'),
  ('content'),('vin_vehicles'),('vin_option_master'),('vin_option_items'),
  ('vin_powertrains'),('vin_colors_trim'),('vehicles'),('search_aliases'),('site_settings')
  -- หมายเหตุ: reviews / vin_provenance / vin_fitment_profiles = ไม่ใส่ (ถ้า anon อ่านได้จะ flag ให้ยืนยันว่า public จริง)
),
obj as (
  select
    c.oid, c.relname, c.relkind, c.relrowsecurity as rls,
    -- grant: has_any_column_privilege = ครอบทั้ง table-level และ column-level (ปิดช่อง false-pass)
    has_any_column_privilege('anon', c.oid, 'SELECT') as anon_grant,
    -- มี permissive SELECT/ALL policy ที่ให้ anon/public ไหม
    exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
        and p.cmd in ('SELECT','ALL') and p.permissive = 'PERMISSIVE'
        and p.roles && array['anon','public']::name[]      -- cast กัน type mismatch
    ) as anon_policy,
    exists (
      select 1 from unnest(coalesce(c.reloptions,'{}'::text[])) o
      where o in ('security_invoker=on','security_invoker=true')
    ) as sec_invoker,
    (c.relname in (select relname from pub_allow)) as is_public
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p','v','m')       -- table, partitioned, view, matview
    and coalesce(c.relispartition,false) = false   -- ไม่เอา partition ลูก (ซ้ำ)
),
evald as (
  select o.*,
    case
      when o.relkind in ('r','p') then o.anon_grant and (not o.rls or o.anon_policy)  -- table: grant + (RLS off หรือ มี anon policy)
      when o.relkind = 'v'        then o.anon_grant and not o.sec_invoker              -- view: grant + ไม่ invoker = bypass RLS
      when o.relkind = 'm'        then o.anon_grant                                    -- matview: ไม่เคารพ RLS เลย → grant = อ่านได้หมด
    end as anon_reads
  from obj o
)
select
  case relkind when 'r' then 'table' when 'p' then 'table'
               when 'v' then 'view'  when 'm' then 'matview' end as kind,
  relname, is_public, anon_grant, rls, anon_policy, sec_invoker, anon_reads,
  case
    when is_public and relkind in ('r','p') and not anon_reads
         then '🟠 BROKEN — public อ่านไม่ได้ (storefront พัง) → เพิ่ม grant/policy'
    when (not is_public) and anon_reads
         then '🔴 VIOLATION — anon อ่านได้ทั้งที่ไม่ใช่ public → revoke / enable RLS / security_invoker'
    else '✅ ok'
  end as verdict
from evald
order by
  case when (not is_public) and anon_reads then 0                                  -- 🔴 บนสุด
       when is_public and relkind in ('r','p') and not anon_reads then 1           -- 🟠
       else 9 end,
  relname;

-- ═══════════════════════════════════════════════════════════════════════
-- อ่านผล:
--   • ไม่มี 🔴 และ 🟠  = PASS (anon อ่านได้เฉพาะ public · sensitive ปิดหมด)
--   • 🔴 ทุกแถว = ช่องรั่วจริง ต้องปิดก่อน live (แม้ new store — เพราะ grant ติดจาก prod dump)
--   • 🟠 = public โดน RLS/grant บล็อกเกินไป (จะทำ storefront/directory พัง)
--   • ตารางที่คาดว่า public แต่ถูก flag 🔴 (เช่น reviews) = ยืนยันว่า public จริงไหม
--        ถ้า public → เพิ่มชื่อใน pub_allow แล้วรันซ้ำ · ถ้าไม่ → ปิด (นี่คือ leak)
-- ═══════════════════════════════════════════════════════════════════════
