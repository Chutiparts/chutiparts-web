-- ═══════════════════════════════════════════════════════════════════════
-- อู่เบนซ์ทั่วไทย — SEED ตัวอย่าง (สำหรับทดสอบหน้าเว็บ Phase 2)
-- ─────────────────────────────────────────────────────────────────────
-- ⚠️  ข้อมูลตัวอย่างล้วน (ชื่อมี "(ตัวอย่าง)") — ใช้เทสหน้าเว็บก่อนมีข้อมูลจริงจาก Apify
--     ทุกแถว source='manual-seed-sample' · ลบออกทีหลังได้ด้วยบรรทัด DELETE ด้านล่าง
--     รันซ้ำได้ (idempotent): ลบของเดิม source เดียวกันก่อน แล้ว insert ใหม่
--     Owner รันใน Supabase SQL Editor (หลังรัน garage-migration-g1.sql แล้ว)
-- ═══════════════════════════════════════════════════════════════════════

-- ลบ seed เก่า (cascade ลบ services + reviews_meta อัตโนมัติ)
delete from garages where source = 'manual-seed-sample';

insert into garages
  (name_th, name_en, slug, normalized_name, province, district, address_raw, phone, website,
   rating, review_count, lat, lng, maps_url, status, classification, description, source, last_seen_at, source_last_checked_at)
values
  ('อู่เบนซ์ทองหล่อ (ตัวอย่าง)', 'Thonglor Benz Garage (sample)', 'thonglor-benz-sample', 'อูเบนซทองหลอ',
   'กรุงเทพมหานคร', 'วัฒนา', 'ซอยทองหล่อ เขตวัฒนา กรุงเทพฯ (ที่อยู่ตัวอย่าง)', '02-000-0001', null,
   4.8, 126, 13.7360, 100.5820, 'https://maps.google.com/?q=13.7360,100.5820', 'published', 'benz_specialist',
   'อู่ตัวอย่างสำหรับทดสอบระบบ directory — เชี่ยวชาญงานเครื่องยนต์และเกียร์ Mercedes-Benz', 'manual-seed-sample', now(), now()),

  ('เบนซ์เซอร์วิส รามอินทรา (ตัวอย่าง)', null, 'benz-service-ramindra-sample', 'เบนซเซอรวสรามอนทรา',
   'กรุงเทพมหานคร', 'บางเขน', 'ถนนรามอินทรา เขตบางเขน กรุงเทพฯ (ที่อยู่ตัวอย่าง)', '02-000-0002', null,
   4.5, 58, 13.8760, 100.6510, 'https://maps.google.com/?q=13.8760,100.6510', 'published', 'benz_specialist',
   'อู่ตัวอย่าง — งานช่วงล่าง เบรก และระบบแอร์', 'manual-seed-sample', now(), now()),

  ('ยูโรการาจ ลาดพร้าว (ตัวอย่าง)', 'Euro Garage (sample)', 'euro-garage-ladprao-sample', 'ยูโรการาจลาดพราว',
   'กรุงเทพมหานคร', 'จตุจักร', 'ถนนลาดพร้าว เขตจตุจักร กรุงเทพฯ (ที่อยู่ตัวอย่าง)', '02-000-0003', null,
   4.2, 34, null, null, null, 'published', 'european_specialist',
   'อู่ตัวอย่าง — รับซ่อมรถยุโรปรวมถึง Mercedes-Benz', 'manual-seed-sample', now(), now()),

  ('เชียงใหม่เบนซ์เทค (ตัวอย่าง)', 'Chiang Mai Benz Tech (sample)', 'chiangmai-benz-tech-sample', 'เชยงใหมเบนซเทค',
   'เชียงใหม่', 'เมืองเชียงใหม่', 'ถนนซุปเปอร์ไฮเวย์ อ.เมือง จ.เชียงใหม่ (ที่อยู่ตัวอย่าง)', '053-000-004', null,
   4.7, 89, 18.7900, 98.9850, 'https://maps.google.com/?q=18.7900,98.9850', 'published', 'benz_specialist',
   'อู่ตัวอย่าง — ศูนย์ซ่อมเบนซ์นอกศูนย์ในเชียงใหม่', 'manual-seed-sample', now(), now()),

  ('ภูเก็ตยูโรคาร์ (ตัวอย่าง)', 'Phuket Euro Car (sample)', 'phuket-euro-car-sample', 'ภเกตยโรคาร',
   'ภูเก็ต', 'เมืองภูเก็ต', 'ถนนเจ้าฟ้า อ.เมือง จ.ภูเก็ต (ที่อยู่ตัวอย่าง)', '076-000-005', null,
   4.4, 41, 7.8850, 98.3880, 'https://maps.google.com/?q=7.8850,98.3880', 'published', 'european_specialist',
   'อู่ตัวอย่าง — งานซ่อมรถยุโรปและเบนซ์', 'manual-seed-sample', now(), now()),

  ('ชลบุรีเบนซ์การาจ (ตัวอย่าง)', null, 'chonburi-benz-garage-sample', 'ชลบรเบนซการาจ',
   'ชลบุรี', 'ศรีราชา', 'อ.ศรีราชา จ.ชลบุรี (ที่อยู่ตัวอย่าง)', '038-000-006', null,
   4.1, 22, null, null, null, 'published', 'general_garage',
   'อู่ตัวอย่าง — งานทั่วไปและเบนซ์', 'manual-seed-sample', now(), now());

-- บริการ (service tags)
insert into garage_services (garage_id, service_key, service_label, confidence)
select id, x.k, x.l, 0.9 from garages, (values
  ('engine','เครื่องยนต์'),('gearbox','เกียร์'),('brake','เบรก'),('suspension','ช่วงล่าง'),('air','แอร์')
) as x(k,l)
where garages.source = 'manual-seed-sample'
  and (
    (garages.slug = 'thonglor-benz-sample'          and x.k in ('engine','gearbox','air')) or
    (garages.slug = 'benz-service-ramindra-sample'   and x.k in ('suspension','brake','air')) or
    (garages.slug = 'euro-garage-ladprao-sample'     and x.k in ('engine','suspension')) or
    (garages.slug = 'chiangmai-benz-tech-sample'     and x.k in ('engine','gearbox','brake')) or
    (garages.slug = 'phuket-euro-car-sample'         and x.k in ('engine','air')) or
    (garages.slug = 'chonburi-benz-garage-sample'    and x.k in ('brake','suspension'))
  );

-- reviews_meta (เวลาทำการตัวอย่าง — ใส่ให้ 2 อู่)
insert into garage_reviews_meta (garage_id, rating, review_count, opening_hours_json)
select id, rating, review_count,
  '{"จันทร์-เสาร์":"08:30-18:00","อาทิตย์":"ปิด"}'::jsonb
from garages where source = 'manual-seed-sample'
  and slug in ('thonglor-benz-sample','chiangmai-benz-tech-sample');

-- ═══════════════════════════════════════════════════════════════════════
-- ตรวจผล:  select name_th, province, slug, status from garages where source='manual-seed-sample';
-- ลบ seed:  delete from garages where source='manual-seed-sample';   (cascade ลบ services/meta)
-- ═══════════════════════════════════════════════════════════════════════
