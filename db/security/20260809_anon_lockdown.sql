-- ═══════════════════════════════════════════════════════════════════════
-- SECURITY MIGRATION — anon exposure lockdown
-- วันที่: 2026-08-09 · applied to prod (qaqawfvbaqyznuuecfp) แล้ว · verified clean
-- ─────────────────────────────────────────────────────────────────────
-- เหตุการณ์: anon exposure sweep เจอ 15 object ที่ role `anon` (คีย์ public
--   ฝังในหน้าเว็บ) อ่านได้ทั้งที่ไม่ใช่ข้อมูล public — รวมต้นทุนสินค้า,
--   ใบเสนอราคาลูกค้า (quotes_inbox), และ PII คนเช็ค VIN
--   สาเหตุ: Supabase grant anon เต็มโดย default + (view ไม่มี security_invoker
--   → ข้าม RLS) หรือ (table มี permissive policy ให้ anon)
--
-- กลไกแก้: revoke สิทธิ์ทั้งหมดของ anon บน object เหล่านี้
--   → PostgREST เห็นว่า anon ไม่มี SELECT → ตอบ permission denied ก่อนถึง RLS
--   แอปไม่กระทบ: ทุก path อ่าน/เขียนผ่าน service role ฝั่ง server (anon client = 0)
--
-- ‼️ ต้องรันบนทุก tenant ใหม่ (Tenant B / new store) หลัง clone จาก dump prod
--    เพราะ grant anon ติดมากับ dump → รูกลับมาเหมือนเดิม
--
-- idempotent: REVOKE บนสิทธิ์ที่ถูก revoke แล้ว = no-op (รันซ้ำได้ปลอดภัย)
-- verify หลังรัน: รัน db/security/anon-exposure-sweep.sql → ต้องได้ 0 🔴 และ 0 🟠
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── Stock ledger (แก้รอบแรก 2026-08-09) ──────────────────────────────
-- v_stock_active = view ไม่มี security_invoker → เคยข้าม RLS โชว์ต้นทุน 86 แถว
revoke all on public.v_stock_active   from anon;
revoke all on public.stock_records    from anon;

-- ── Internal ops / audit ─────────────────────────────────────────────
revoke all on public.cases            from anon;   -- เคสงาน/support (status, notes)
revoke all on public.events           from anon;   -- event / audit log

-- ── Pilot data (ตารางเก่า ไม่ถูกใช้ในโค้ดแล้ว แต่ยังโล่ง) ──────────────
revoke all on public.pilot_briefs       from anon;
revoke all on public.pilot_brief_items  from anon;
revoke all on public.pilot_events       from anon;
revoke all on public.pilot_feedback     from anon;
revoke all on public.pilot_intake_items from anon;

-- ── Customer / quote data ────────────────────────────────────────────
-- quotes_inbox = view ข้าม RLS (เหมือน v_stock_active) → โชว์ใบเสนอราคาลูกค้า
revoke all on public.quotes_inbox     from anon;
revoke all on public.reviews          from anon;   -- ถ้าจะทำ public review widget (client-side) ค่อย grant select คืน

-- ── VIN user-submitted requests (PII: ใครเช็ค VIN อะไร) ───────────────
revoke all on public.vin_check_requests   from anon;
revoke all on public.vin_lookup_requests  from anon;
revoke all on public.vin_fitment_profiles from anon;   -- ไม่ถูกใช้ในโค้ด
revoke all on public.vin_provenance       from anon;   -- ไม่ถูกใช้ในโค้ด

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- OPTION B (แนะนำสำหรับ tenant ใหม่ · robust กว่า · ครอบ table อนาคตด้วย)
-- ─────────────────────────────────────────────────────────────────────
-- แทนที่จะไล่ revoke ทีละตัว (พลาดได้ถ้ามีตารางใหม่) → default-deny แล้ว
-- allowlist grant คืนเฉพาะตาราง public จริง · ตรงปรัชญา sweep
-- ⚠️ ตรวจ allowlist ให้ตรงกับ tenant นั้นก่อน uncomment (แต่ละร้านอาจต่างกัน)
-- ⚠️ รัน sweep ยืนยันหลังรัน — public ต้องไม่มี 🟠 (storefront ต้องไม่พัง)
--
-- begin;
--   -- 1) default-deny: ตัด anon ออกจากทุก table/view ใน public
--   revoke all privileges on all tables in schema public from anon;
--
--   -- 2) allowlist: grant SELECT คืนเฉพาะ public (storefront/directory/reference)
--   grant select on
--     public.products, public.garages, public.garage_services,
--     public.garage_reviews_meta, public.businesses, public.content,
--     public.vin_vehicles, public.vin_option_master, public.vin_option_items,
--     public.vin_powertrains, public.vin_colors_trim, public.vehicles,
--     public.search_aliases, public.site_settings
--   to anon;
--
--   -- 3) กัน table อนาคต auto-grant anon (default privilege)
--   alter default privileges in schema public revoke all on tables from anon;
-- commit;
-- ═══════════════════════════════════════════════════════════════════════
