-- ═══════════════════════════════════════════════════════════════════════
-- check_drift.sql — ถ่าย "ลายนิ้วมือ" ของทุกฟังก์ชันใน schema public
-- ─────────────────────────────────────────────────────────────────────
-- วิธีใช้: วางทั้งไฟล์ลง Supabase SQL Editor ของโปรดักชัน แล้ว Run
--          เอาผลลัพธ์ไปเทียบกับ db/drift_baseline.tsv (commit ไว้ใน repo)
--          ต่างเมื่อไหร่ = มีคนแก้ฟังก์ชันบน DB โดยไม่ผ่าน repo
--
-- 🔴 ข้อควรระวังที่สำคัญที่สุด — `prosrc` คือ **body เท่านั้น**
--    คือข้อความระหว่าง $$ ... $$ ไม่รวมหัวฟังก์ชัน ⇒ md5(prosrc) **มองไม่เห็น**
--    การเปลี่ยนแปลงเหล่านี้:
--      · ชื่อ/ชนิด/ค่า default ของ argument      · returns ...
--      · security definer ↔ invoker             · set search_path
--      · volatility (immutable/stable/volatile)  · owner / grant
--    ทั้งหมดนี้เปลี่ยนพฤติกรรมและความปลอดภัยได้โดย md5(prosrc) เท่าเดิม
--    → คอลัมน์ `full_md5` (จาก pg_get_functiondef) ครอบทั้งหมดนั้น **ให้ยึดตัวนี้เป็นหลัก**
--
-- ⚠️ `full_md5` เทียบกับไฟล์ .sql ในเครื่องตรง ๆ ไม่ได้ เพราะ pg_get_functiondef
--    จัดรูปแบบใหม่ตามที่ Postgres เก็บ (เว้นวรรค/ตัวพิมพ์ไม่เหมือนที่เราพิมพ์)
--    มันเป็น **baseline manifest** — เทียบ "DB วันนี้" กับ "DB วันที่ถือว่าถูก"
--    ถ้าอยากเทียบ DB กับไฟล์จริง ให้ใช้ body_md5 คู่กับ db/drift_manifest.py
-- ═══════════════════════════════════════════════════════════════════════

select
  p.proname                                              as name,
  pg_get_function_identity_arguments(p.oid)              as args,
  md5(p.prosrc)                                          as body_md5,
  length(p.prosrc)                                       as body_len,
  md5(pg_get_functiondef(p.oid))                         as full_md5,
  p.prosecdef                                            as security_definer,
  p.provolatile                                          as volatility,   -- i=immutable s=stable v=volatile
  coalesce(array_to_string(p.proconfig, ','), '')        as config,       -- เช่น search_path=public
  pg_get_userbyid(p.proowner)                            as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  -- ตัดฟังก์ชันที่มาจาก extension ออก (ไม่ใช่ของเรา ไม่ต้องเฝ้า)
  and not exists (
    select 1 from pg_depend d
     where d.objid = p.oid and d.deptype = 'e'
  )
order by p.proname, args;
