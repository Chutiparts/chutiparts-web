-- 20260822_tuner_sku_scheme.sql
-- ย้าย "อะไหล่แต่ง" มาใช้สคีม SKU ของตัวเอง: {แบรนด์3ตัว}-{ลำดับ3หลัก}
--   AMG-001 · BRB-001 (Brabus) · LOR-001 (Lorinser) · VIC-001 (Victor)
-- ของแต่งมักใส่ได้หลายรุ่น จึงไม่ผูกรุ่นรถไว้ใน SKU (ต่างจากอะไหล่ปกติ เช่น 140-004)
--
-- 🔴 รันบน **โปรดักชัน** เท่านั้น: project ref = qaqawfvbaqyznyuuecfp
--    (คีย์ service_role ที่อยู่ใน chutiparts-web/.env.local ชี้ไป staging gccytd — คนละตัว)
--    วิธีรัน: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
--
-- ⚠️ ทำไมต้องแตะหลายตาราง: `products.part_number` คือกุญแจ join กับ `stock_records.sku`
--    (เห็นได้ที่ db/agent/agent_lookup_fn.sql:101 · app/products/[slug]/page.tsx:34 ·
--     app/search/page.tsx:156 · app/feed/facebook/route.ts) ถ้าเปลี่ยนข้างเดียว
--    ของจะกลายเป็น "ของหมด" ทั้งบนเว็บ ในฟีด FB และ **เอเจนต์จะบอกลูกค้าทางโทรศัพท์ว่าของหมด**
--    โดยไม่มี error ให้เห็นเลย → migration นี้จึงเปลี่ยนพร้อมกันในทรานแซกชันเดียว
--
-- ไม่แตะ `stock_link_audit` โดยตั้งใจ — เป็น audit log ต้องคงสิ่งที่บันทึกไว้ ณ ตอนนั้น
-- ถ้าไล่ log เก่าเจอ SKU เดิม ให้เทียบกับตารางแม็ปด้านล่าง

begin;

-- ตารางแม็ป: เก่า → ใหม่ (+ เลข OEM ที่ถูกกรอกผิดช่อง)
create temporary table _sku_map (old_sku text, new_sku text, oem text) on commit drop;
insert into _sku_map (old_sku, new_sku, oem) values
  -- เลข "124 440 51 47" ไม่ใช่ SKU ร้าน แต่เป็นเลข OEM ของเบนซ์ที่ถูกกรอกลงช่อง part_number
  -- (ช่อง oem_number ว่างอยู่) → ย้ายไปช่องที่ถูก แล้วมันจะไปโผล่เป็น <g:mpn> ในฟีด
  -- ❗ถ้าบนตัวเรือนไมล์จริงปั๊มว่า "A 124 440 51 47" ให้แก้บรรทัดนี้เป็น 'A1244405147'
  ('124 440 51 47', 'AMG-001', '1244405147'),   -- เรือนไมล์ W124 AMG แท้ (VDO) — อยู่ในฟีด FB
  ('124-AMGV3',     'AMG-002', null),           -- ชุดแต่ง AMG V.3 W124 (call for price)
  ('SW-AMG01',      'AMG-003', null),           -- พวงมาลัย AMG ลายไม้ W140 (call for price)
  ('VIC-DB3',       'VIC-001', null);           -- พวงมาลัย Victor DB-3 (call for price)

-- กันพลาด: ถ้า SKU ใหม่ไปชนของที่มีอยู่แล้ว ให้ล้มทั้งชุด อย่าเขียนทับ
do $$
declare n int;
begin
  select count(*) into n
    from products p join _sku_map m on btrim(p.part_number) = m.new_sku;
  if n > 0 then
    raise exception 'SKU ใหม่ชนกับสินค้าที่มีอยู่แล้ว % รายการ — หยุดก่อน', n;
  end if;
end $$;

-- กันพลาด: ต้องเจอครบ 4 ตัว ถ้าเจอไม่ครบแปลว่ามีคนแก้ไปแล้วหรือรันผิด DB
do $$
declare n int;
begin
  select count(*) into n
    from products p join _sku_map m on btrim(p.part_number) = m.old_sku;
  if n <> 4 then
    raise exception 'หา SKU เดิมเจอ % ตัว (ต้องได้ 4) — ตรวจว่ารันถูก project หรือยัง', n;
  end if;
end $$;

-- ยืนยันแล้วบนโปรดักชัน 2026-08-22: alt_part_numbers เป็น text[] จริง (ไม่ใช่ jsonb)
-- 1) products: SKU ใหม่ + ย้ายเลข OEM ไปช่องที่ถูก + เก็บ SKU เดิมไว้ใน alt_part_numbers
--    (เก็บของเดิมไว้เพื่อให้ค้นด้วยรหัสเก่ายังเจอ — พนักงานและบิลเก่ายังใช้รหัสนั้นอยู่)
update products p
   set part_number    = m.new_sku,
       oem_number     = coalesce(m.oem, p.oem_number),
       alt_part_numbers = (
         select array_agg(distinct x)
           from unnest(coalesce(p.alt_part_numbers, array[]::text[]) || array[m.old_sku]) as x
          where x is not null and btrim(x) <> ''
       )
  from _sku_map m
 where btrim(p.part_number) = m.old_sku;

-- 2) คอลัมน์ *_norm: ถ้าเป็น generated column ฐานข้อมูลอัปเดตเองแล้ว ไม่ต้องแตะ
--    ถ้าเป็นคอลัมน์ธรรมดา ต้องเขียนเอง ไม่งั้น "ค้นหา" บนเว็บจะหาไม่เจอแบบเงียบ ๆ
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'products'
       and column_name = 'part_number_norm' and is_generated = 'NEVER'
  ) then
    update products
       set part_number_norm = regexp_replace(coalesce(part_number, ''), '[^a-zA-Z0-9]', '', 'g')
     where part_number in (select new_sku from _sku_map);
    raise notice 'อัปเดต part_number_norm เอง (เป็นคอลัมน์ธรรมดา)';
  else
    raise notice 'ข้าม part_number_norm (generated หรือไม่มีคอลัมน์นี้)';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'products'
       and column_name = 'oem_number_norm' and is_generated = 'NEVER'
  ) then
    update products
       set oem_number_norm = regexp_replace(coalesce(oem_number, ''), '[^a-zA-Z0-9]', '', 'g')
     where part_number in (select new_sku from _sku_map);
    raise notice 'อัปเดต oem_number_norm เอง (เป็นคอลัมน์ธรรมดา)';
  else
    raise notice 'ข้าม oem_number_norm (generated หรือไม่มีคอลัมน์นี้)';
  end if;
end $$;

-- 3) ทุกตารางที่ผูกด้วย sku ต้องย้ายตามในทรานแซกชันเดียวกัน
--    (ทำแบบเช็กก่อนว่ามีตาราง/คอลัมน์จริง — สคีมาบางส่วนต่างกันระหว่าง prod/staging)
do $$
declare
  t text;
  n int;
begin
  foreach t in array array['stock_records', 'sales_records', 'stock_movements'] loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'sku'
    ) then
      execute format(
        'update %I s set sku = m.new_sku from _sku_map m where btrim(s.sku) = m.old_sku', t
      );
      get diagnostics n = row_count;
      raise notice '% : ย้าย sku % แถว', t, n;
    else
      raise notice '% : ไม่มีตาราง/คอลัมน์ sku — ข้าม', t;
    end if;
  end loop;
end $$;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- ตรวจหลังรัน (รันแยกได้ ไม่แก้อะไร)
--
-- 3.1 SKU ใหม่ + OEM + qty คงเหลือ — qty ต้องไม่กลายเป็น 0 เพราะการเปลี่ยนชื่อ
-- select p.part_number, p.name, p.oem_number, p.alt_part_numbers,
--        coalesce((select sum(sr.qty)::int from stock_records sr
--                   where sr.sku = p.part_number and sr.deleted_at is null), 0) as live_qty
--   from products p
--  where p.part_number like 'AMG-%' or p.part_number like 'VIC-%'
--  order by p.part_number;
--
-- 3.2 ต้องไม่เหลือ SKU เดิมค้างอยู่ที่ไหนอีก (ยกเว้น alt_part_numbers กับ stock_link_audit)
-- select 'stock_records' src, sku from stock_records
--  where btrim(sku) in ('124 440 51 47','124-AMGV3','SW-AMG01','VIC-DB3')
-- union all
-- select 'sales_records', sku from sales_records
--  where btrim(sku) in ('124 440 51 47','124-AMGV3','SW-AMG01','VIC-DB3');
--
-- 3.3 ต้องไม่มี part_number ที่มีช่องว่างเหลืออยู่เลย (ต้นเหตุของบั๊กรอบนี้)
-- select part_number, name from products where part_number ~ '\s';
