-- ═══════════════════════════════════════════════════════════════════════
-- อู่เบนซ์ทั่วไทย (Benz Garage Directory) — Migration G1  [schema 4 ตาราง]
-- ─────────────────────────────────────────────────────────────────────
-- ที่มา: chutibenz-benz-garage-directory-spec §โครงสร้างฐานข้อมูล
-- หลักการ: lean · audit-first (raw แยกจาก published) · human-reviewed · SEO-ready
--
-- ⚙️  Owner รันเองใน Supabase SQL Editor · ADDITIVE ล้วน — ไม่แตะตารางเดิมของ ChutiBenz
--     (ตารางขึ้นต้น garage_* เป็น namespace ใหม่ ไม่ชนกับ doc_* / core)
--     รันได้ซ้ำ (idempotent: ทุก statement มี IF NOT EXISTS / OR REPLACE)
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1) garages — ตารางหลัก (ข้อมูลอู่ที่จัดรูปแบบแล้ว) ──────────────────
create table if not exists garages (
  id                      uuid primary key default gen_random_uuid(),
  -- ข้อมูลแสดงผล
  name_th                 text not null,                 -- ชื่ออู่ (ไทย)
  name_en                 text,                          -- ชื่อ (อังกฤษ) ถ้ามี
  slug                    text,                          -- ใช้สร้าง URL หน้ารายอู่ (unique — ดู index)
  normalized_name         text,                          -- ชื่อ normalize แล้ว (ใช้ dedupe)
  province                text,                          -- จังหวัด
  district                text,                          -- อำเภอ/เขต
  address_raw             text,                          -- ที่อยู่เต็ม
  phone                   text,
  website                 text,
  rating                  numeric(2,1),                  -- คะแนนรีวิว (0.0–5.0)
  review_count            integer,
  lat                     numeric(10,7),                 -- ละติจูด
  lng                     numeric(10,7),                 -- ลองจิจูด
  maps_url                text,                          -- ลิงก์ Google Maps
  place_id                text,                          -- external key สำหรับ dedupe (unique — ดู index)
  -- lifecycle
  status                  text not null default 'raw'
                            check (status in ('raw','cleaned','reviewed','published','rejected')),
  reject_reason           text
                            check (reject_reason is null or reject_reason in
                              ('duplicate','not_benz_specialist','missing_contact','unclear_name','other')),
  -- Claude enrichment (Phase 3 — ใส่คอลัมน์ไว้ก่อน จะได้ไม่ต้อง migrate ซ้ำ)
  classification          text
                            check (classification is null or classification in
                              ('benz_specialist','european_specialist','general_garage','unclear')),
  description             text,                          -- คำอธิบายสั้นที่ Claude สรุป (ตรวจกลับได้)
  needs_manual_review     boolean not null default false,
  -- แหล่งที่มา + เวลา
  source                  text,                          -- เช่น 'apify-google-maps'
  last_seen_at            timestamptz,                   -- พบข้อมูลล่าสุดจาก scrape เมื่อไร
  source_last_checked_at  timestamptz,                   -- sync/ตรวจแหล่งล่าสุด
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- dedupe: place_id ต้องไม่ซ้ำ (เฉพาะที่มีค่า — raw บางแถวยังไม่มี)
create unique index if not exists garages_place_id_uidx
  on garages (place_id) where place_id is not null;
-- URL: slug ต้องไม่ซ้ำ (เฉพาะที่มีค่า)
create unique index if not exists garages_slug_uidx
  on garages (slug) where slug is not null;
-- หน้าเว็บ/แอดมิน query บ่อย
create index if not exists garages_province_idx      on garages (province);
create index if not exists garages_status_idx        on garages (status);
create index if not exists garages_province_status_idx on garages (province, status);
-- หน้า published เรียงตามคะแนน/รีวิว
create index if not exists garages_published_rank_idx
  on garages (province, rating desc nulls last, review_count desc nulls last)
  where status = 'published';
-- dedupe fallback (ชื่อ+เบอร์)
create index if not exists garages_name_phone_idx
  on garages (normalized_name, phone);


-- ── 2) garage_services — บริการ/แท็กของอู่ ────────────────────────────
create table if not exists garage_services (
  id             uuid primary key default gen_random_uuid(),
  garage_id      uuid not null references garages(id) on delete cascade,
  service_key    text not null,                          -- key ภายใน เช่น engine, gearbox, brake
  service_label  text,                                   -- ชื่อที่แสดงบนเว็บ
  confidence     numeric(3,2),                           -- 0.00–1.00 ความมั่นใจจากการจัดหมวด
  created_at     timestamptz not null default now()
);
-- กันแท็กซ้ำในอู่เดียว
create unique index if not exists garage_services_uidx
  on garage_services (garage_id, service_key);
create index if not exists garage_services_garage_idx
  on garage_services (garage_id);


-- ── 3) garage_snapshots — raw/import history (audit + rollback) ────────
create table if not exists garage_snapshots (
  id                   uuid primary key default gen_random_uuid(),
  garage_id            uuid references garages(id) on delete set null,  -- nullable: ยังจับคู่ไม่ได้
  source_name          text not null,                     -- เช่น 'apify-run-2026-07-26'
  source_payload_json  jsonb not null,                    -- payload ดิบจากต้นทาง (เก็บครบเสมอ)
  query_label          text,                              -- query ที่ใช้ scrape เช่น 'อู่เบนซ์ + กรุงเทพ'
  fetched_at           timestamptz not null default now(),
  created_at           timestamptz not null default now()
);
create index if not exists garage_snapshots_garage_idx  on garage_snapshots (garage_id);
create index if not exists garage_snapshots_fetched_idx on garage_snapshots (fetched_at desc);
create index if not exists garage_snapshots_source_idx  on garage_snapshots (source_name);


-- ── 4) garage_reviews_meta — ข้อมูลแสดงผลเสริม (1 แถว/อู่) ─────────────
create table if not exists garage_reviews_meta (
  garage_id           uuid primary key references garages(id) on delete cascade,
  rating              numeric(2,1),
  review_count        integer,
  price_level         text,                               -- เช่น '$$'
  opening_hours_json  jsonb,                              -- เวลาทำการ
  photos_json         jsonb,                              -- รูป/reference
  updated_at          timestamptz not null default now()
);


-- ── updated_at auto-touch (ตั้งชื่อเฉพาะ module กันชนของเดิม) ──────────
create or replace function garage_touch_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_garages_updated on garages;
create trigger trg_garages_updated
  before update on garages
  for each row execute function garage_touch_updated_at();

drop trigger if exists trg_garage_reviews_updated on garage_reviews_meta;
create trigger trg_garage_reviews_updated
  before update on garage_reviews_meta
  for each row execute function garage_touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════
-- (ทางเลือก) เปิด RLS ตอนพร้อมเปิด public read เว็บผ่าน anon key
--   ตอนนี้ยังไม่เปิด — แอปอ่านผ่าน service-role ฝั่ง server เหมือน doc_* เดิม
--   ถ้าจะให้ frontend อ่านตรงด้วย anon ให้ owner เปิดทีหลัง เช่น:
--
--   alter table garages enable row level security;
--   create policy garages_public_read on garages
--     for select using (status = 'published');
-- ═══════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
-- (ทางเลือก) SEED ทดสอบ 1 แถว — uncomment เพื่อเช็กว่าตารางใช้งานได้
--   หลังรัน migration แล้ว ลอง SELECT * FROM garages; ควรเห็น ChutiBenz
--
-- insert into garages (name_th, name_en, slug, normalized_name, province, district,
--   address_raw, phone, website, rating, review_count, maps_url, place_id,
--   status, classification, source, last_seen_at)
-- values ('ชูติเบนซ์', 'ChutiBenz', 'chuti-benz-bangkok', 'chutibenz', 'กรุงเทพมหานคร', '-',
--   '(ที่อยู่ตัวอย่าง)', '-', 'https://chutibenz.com', 5.0, 1, null, null,
--   'published', 'benz_specialist', 'manual-seed', now())
-- on conflict do nothing;
-- ═══════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (ถ้าต้องถอน — ระวัง: ลบข้อมูลทั้งหมดในตารางเหล่านี้)
-- drop trigger if exists trg_garage_reviews_updated on garage_reviews_meta;
-- drop trigger if exists trg_garages_updated on garages;
-- drop function if exists garage_touch_updated_at();
-- drop table if exists garage_reviews_meta;
-- drop table if exists garage_snapshots;
-- drop table if exists garage_services;
-- drop table if exists garages;
-- ═══════════════════════════════════════════════════════════════════════
