-- ═══════════════════════════════════════════════════════════════════════
-- SECURITY MIGRATION — anon lockdown รอบ 2: contact_leads + search_queries
-- วันที่: 2026-08-21 · ✅ APPLIED บนโปรดักชันแล้ว (ดู db/APPLIED.md)
--   หมายเหตุ: บรรทัดนี้เคยเขียนว่า "ยังไม่ได้ apply" ค้างไว้จนถึง 2026-08-22
--   วัดของจริงแล้วพบว่ารันไปแล้ว — contact_leads/search_queries ตอบ 401 ทั้งคู่
-- ─────────────────────────────────────────────────────────────────────
-- เหตุการณ์: ตรวจก่อนเปิด voice agent เก็บ lead ทางโทรศัพท์ พบว่า
--   lockdown รอบแรก (20260809_anon_lockdown.sql) ครอบ 15 object แต่
--   **ไม่ได้ครอบ 2 ตารางนี้** ซึ่งเก็บ PII ลูกค้าโดยตรง:
--
--     contact_leads   — ชื่อ/เบอร์/LINE/อีเมล/รายละเอียดที่ลูกค้าฝากไว้
--     search_queries  — คำค้นดิบของลูกค้า (channel='voice-agent' คือสิ่งที่
--                       ลูกค้าพูดกับ AI ทางโทรศัพท์ ผ่าน agent_lookup + /api/agent/lookup)
--
-- สถานะที่วัดได้จริง 2026-08-21 **ก่อนรัน** (ยิง PostgREST ด้วยคีย์ anon ที่ฝังในหน้าเว็บ):
--     contact_leads   → HTTP 200 []   (service role เห็น 8 แถว)
--     search_queries  → HTTP 200 []   (service role เห็น 15 แถว)
--     stock_records   → HTTP 401      ← รูปแบบที่ถูกต้อง (ปิดตั้งแต่รอบแรก)
--
-- สถานะที่วัดซ้ำ 2026-08-22 **หลังรัน** (วิธีเดียวกัน):
--     contact_leads   → HTTP 401 code 42501 ✅
--     search_queries  → HTTP 401 code 42501 ✅
--     stock_records   → HTTP 401 ✅
--     products        → HTTP 200 มีข้อมูล ✅ (ตั้งใจให้เปิด — storefront ใช้)
--
--   200 + [] แปลว่า **anon ยังถือสิทธิ์ SELECT อยู่** เพียงแต่ RLS กรองแถวออก
--   = ข้อมูลยังไม่รั่ววันนี้ แต่เหลือ RLS เป็นด่านเดียว ซึ่งคือสภาพเดียวกับ
--   ที่ทำให้รอบแรกรั่ว (view ไม่มี security_invoker / policy permissive หลุดมา
--   ตัวเดียว = เปิดทันที) ปรัชญาของ sweep คือ anon ต้องไม่มี SELECT ตั้งแต่แรก
--   PostgREST จะได้ตอบ permission denied ก่อนถึง RLS
--
-- แอปไม่กระทบ: ทุก path อ่าน/เขียน 2 ตารางนี้ผ่าน service role ฝั่ง server
--   (ตรวจแล้ว: /api/leads, /api/agent/lookup, /api/ai/v1/*, ops-x7k2m9/* ทั้งหมด
--    ใช้ SUPABASE_SECRET_KEY · ไม่มี client component ไหนอ่านด้วยคีย์ anon)
--
-- idempotent: REVOKE ซ้ำ = no-op
-- verify หลังรัน: db/security/anon-exposure-sweep.sql ต้องได้ 0 🔴 / 0 🟠
--   หรือยิงตรง: curl "$URL/rest/v1/contact_leads?select=id&limit=1" \
--                 -H "apikey: <anon>" → ต้องได้ 401 ไม่ใช่ 200
-- ═══════════════════════════════════════════════════════════════════════

begin;

revoke all on public.contact_leads  from anon;   -- PII ลูกค้า: ชื่อ/เบอร์/LINE/อีเมล
revoke all on public.search_queries from anon;   -- คำค้นดิบ รวมสิ่งที่ลูกค้าพูดกับ voice agent

commit;

-- ── กัน regression: ตารางใหม่ในอนาคตจะไม่ auto-grant ให้ anon อีก ──────────
-- (ทำครั้งเดียวพอ · เป็นข้อ 3 ของ OPTION B ในไฟล์รอบแรก แยกออกมาให้รันได้เดี่ยว ๆ
--  ปลอดภัยกว่า OPTION B เต็มรูป เพราะไม่ revoke ของเดิมที่ storefront ใช้อยู่)
-- alter default privileges in schema public revoke all on tables from anon;
