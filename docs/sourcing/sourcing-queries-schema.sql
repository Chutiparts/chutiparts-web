-- docs/sourcing/sourcing-queries-schema.sql
-- ร่าง schema "persist ประวัติการหาของ" (P0 หน้า Sourcing Helper) + ฐานของ Demand Radar (3 ลิสต์)
-- 2026-08-16 · ยังไม่รัน — เตรียมไว้ลงมือหลังเปิดเว็บ (อัพรูป 66 ชิ้นก่อน)
--
-- หลักการ (ตาม Owner):
--   • นี่คือ "ตารางเดียว" ที่เพิ่ม (data layer) — เก็บของที่ตอนนี้ทิ้งทุกวันผ่าน localStorage
--   • Demand Radar = VIEW อ่านล้วนบนตารางนี้ + contact_leads · ไม่มีตารางของตัวเอง
--   • เก็บ fx_rate ตอน insert เสมอ (ย้อนแก้ไม่ได้) → เทียบราคาข้ามเวลาได้
--   • outcome (found/not_found) = ข้อมูลมีค่าที่สุด → บอกว่าอะไรหายาก/ควรสต็อกจริง
--   • internal-only: RLS ล็อก anon (กันคู่แข่งอ่านประวัติ = คูเมือง)

create table if not exists public.sourcing_queries (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- การค้นหา (จากช่อง ①)
  query_text        text not null,          -- ชื่ออะไหล่ที่หา (TH/EN)
  query_norm        text,                   -- normalize สำหรับ group นับซ้ำ
  car_model         text,                   -- รุ่น เช่น W140
  part_number       text,                   -- PN ถ้ารู้
  outcome           text not null default 'pending'
                      check (outcome in ('pending','found','not_found')), -- ปุ่ม เจอ/ไม่เจอ
  actor             text,                   -- ใครหา
  lead_id           uuid references public.contact_leads(id) on delete set null, -- ผูกลูกค้าที่ถาม

  -- ผลที่เจอ (จากช่อง ② เฉพาะ outcome='found')
  source            text,                   -- แหล่งที่เจอ (eBay UK / Yahoo JP / เชียงกง ...)
  supplier          text,                   -- ผู้ขาย
  currency          text,                   -- สกุลเงินดิบ (GBP/JPY/USD/THB)
  amount            numeric,                -- ยอดดิบในสกุลนั้น
  fx_rate           numeric,                -- ★ อัตราแลก→THB ตอนนั้น (สำคัญสุด · ย้อนแก้ไม่ได้)
  price_thb         numeric,                -- ราคาของ (บาท) = amount * fx_rate
  shipping_tax_thb  numeric,                -- ค่าส่ง+ภาษี ประเมิน (บาท)
  landed_thb        numeric,                -- ราคาถึงมือ (บาท) = price_thb + shipping_tax_thb
  condition         text,                   -- สภาพ used ดี / NOS
  link              text,                   -- ลิงก์ประกาศ
  note              text
);

create index if not exists ix_srcq_created  on public.sourcing_queries (created_at desc);
create index if not exists ix_srcq_norm     on public.sourcing_queries (query_norm);
create index if not exists ix_srcq_outcome  on public.sourcing_queries (outcome);
create index if not exists ix_srcq_lead     on public.sourcing_queries (lead_id);

-- RLS: internal-only (service_role bypass · anon อ่านไม่ได้)
alter table public.sourcing_queries enable row level security;
-- ไม่สร้าง policy ให้ anon/authenticated = ปิดตายจาก client · ops ใช้ service_role (ข้าม RLS)

-- ═══════════════════════════════════════════════════════════════
-- Demand Radar = 3 query อ่านล้วน (ไม่ materialize · ไม่มีตารางเพิ่ม)
-- ═══════════════════════════════════════════════════════════════

-- ① ถูกถามซ้ำ แต่หาไม่เจอ  ← ลิสต์ทำเงินที่สุด (ควรสต็อกจริง)
--   select coalesce(nullif(query_norm,''), query_text) as part, car_model,
--          count(*) as asked, max(created_at) as last_asked
--   from public.sourcing_queries where outcome = 'not_found'
--   group by part, car_model order by asked desc, last_asked desc;

-- ② ถูกถามบ่อย และหาเจอ  ← ลิสต์ปิดดีลเร็ว (มี PN + ซัพประจำ + ราคาพร้อมเสนอ)
--   select coalesce(nullif(query_norm,''), query_text) as part, car_model, count(*) as times,
--          (array_agg(part_number order by created_at desc) filter (where part_number is not null))[1] as pn,
--          (array_agg(supplier order by created_at desc) filter (where supplier is not null))[1] as last_supplier,
--          min(landed_thb) as best_landed, max(landed_thb) as worst_landed
--   from public.sourcing_queries where outcome = 'found'
--   group by part, car_model order by times desc;

-- ③ หาเจอแล้ว แต่ลูกค้าเงียบ  ← ลิสต์เจ็บแต่ต้องดู (รู้ว่าเสียดีลเพราะแพง/ช้า)
--   select s.query_text, s.car_model, s.landed_thb, s.source, s.created_at, l.status as lead_status
--   from public.sourcing_queries s join public.contact_leads l on l.id = s.lead_id
--   where s.outcome = 'found' and l.status <> 'won' order by s.created_at desc;

-- ยังไม่ทำรอบนี้ (รอประวัติ 60–90 วัน): กราฟเทรนด์ / คะแนนถ่วงน้ำหนัก / แจ้งเตือน
