-- ═══════════════════════════════════════════════════════════════════════
-- อู่เบนซ์ทั่วไทย — Migration G2  [RLS · เปิดให้เว็บอ่าน published ผ่าน anon]
-- ─────────────────────────────────────────────────────────────────────
-- ทำไม: หน้าเว็บ directory อ่าน Supabase ด้วย anon key (เหมือนหน้า businesses เดิม)
--   ตอนนี้ RLS บล็อก anon → หน้าเว็บเห็น 0 อู่ ทั้งที่ข้อมูลเข้า DB แล้ว
--   G2 เปิด policy ให้ anon อ่าน "เฉพาะแถว status='published'" เท่านั้น
--   (raw/cleaned/reviewed/rejected + snapshots = ซ่อนจาก public · เห็นเฉพาะ service-role ฝั่ง server)
--
-- ⚙️  Owner รันใน Supabase SQL Editor (หลัง G1 + seed) · idempotent · ปลอดภัย
--     write ทั้งหมด (importer/admin) ใช้ service-role → bypass RLS อยู่แล้ว ไม่กระทบ
-- ═══════════════════════════════════════════════════════════════════════

-- เปิด RLS (idempotent — ถ้าเปิดอยู่แล้วไม่ error)
alter table garages             enable row level security;
alter table garage_services     enable row level security;
alter table garage_reviews_meta enable row level security;
alter table garage_snapshots    enable row level security;   -- ไม่ใส่ policy = anon อ่านไม่ได้ (audit data ส่วนตัว)

-- อู่: anon อ่านได้เฉพาะที่ published
drop policy if exists garages_public_read on garages;
create policy garages_public_read on garages
  for select to anon, authenticated
  using (status = 'published');

-- บริการ: อ่านได้เฉพาะของอู่ที่ published
drop policy if exists garage_services_public_read on garage_services;
create policy garage_services_public_read on garage_services
  for select to anon, authenticated
  using (exists (
    select 1 from garages g
    where g.id = garage_services.garage_id and g.status = 'published'
  ));

-- reviews_meta: อ่านได้เฉพาะของอู่ที่ published
drop policy if exists garage_reviews_meta_public_read on garage_reviews_meta;
create policy garage_reviews_meta_public_read on garage_reviews_meta
  for select to anon, authenticated
  using (exists (
    select 1 from garages g
    where g.id = garage_reviews_meta.garage_id and g.status = 'published'
  ));

-- ═══════════════════════════════════════════════════════════════════════
-- ตรวจผล (ควรเห็น 6 แถว): เปิดหน้าเว็บ /benz-garages-thailand refresh
-- ROLLBACK (ถ้าต้องถอน policy):
--   drop policy if exists garages_public_read on garages;
--   drop policy if exists garage_services_public_read on garage_services;
--   drop policy if exists garage_reviews_meta_public_read on garage_reviews_meta;
-- ═══════════════════════════════════════════════════════════════════════
