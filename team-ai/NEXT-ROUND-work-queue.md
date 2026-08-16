# NEXT-ROUND — Prioritized Work Queue · ChutiBenz / DocBrief
เขียน 2026-08-10 · เรียงตาม (ด่วน × คุ้ม × ความพร้อม) · หยิบจากบนลงล่าง
วิธีอ่าน: **⚡ = deploy ได้เลย (git/SQL ไม่มีโค้ดใหม่)** · **🤖 = ต้อง Claude Code เขียน + Builder รีวิวก่อน** · **👤 = Owner ทำใน dashboard เอง** · **⛔ = รอเงื่อนไข**

---

## TIER 1 — ทำก่อน (เร็ว + ปลอดภัย + deploy ง่าย)

### 1.1 ⚡ Cherry-pick security migration → main
**ทำไม:** main ยังไม่มี `db/security/` (อยู่แค่ tenant/base) → ChutiBenz repo history ไม่มี record + branch ที่แตกจาก main อนาคตจะไม่มี lockdown ติดไป (เสี่ยง Tenant/feature ใหม่รูเปิดซ้ำ)
**พร้อมรัน:**
```
cd ~/Desktop/CODE/chutiparts-web
git checkout main
git cherry-pick 1ffb782
git push origin main
```
→ ได้ `db/security/20260809_anon_lockdown.sql` + `anon-exposure-sweep.sql` เข้า main (2 ไฟล์ · new file ไม่มี conflict) · **ไม่กระทบ prod** (แค่ไฟล์ในกิต · prod DB แก้ไปแล้ว)

### 1.2 ⚡ แก้ stale comment (sync-stock/page.tsx บรรทัด 1)
**ทำไม:** คอมเมนต์เขียน `stock_records.qty (จำนวนคงเหลือ)` = net → **ผิด** จริงเป็น gross (รับเข้ารวม) · ทำให้คนอ่านเข้าใจผิดตอน maintain
**แก้:** บรรทัด 1 ของ `app/ops-x7k2m9/sync-stock/page.tsx`
```
// เดิม:
// app/ops-x7k2m9/sync-stock/page.tsx — Sheet(Stock tab) → stock_records.qty (จำนวนคงเหลือ)
// แก้เป็น:
// app/ops-x7k2m9/sync-stock/page.tsx — Sheet(รับเข้า tab) → stock_records.qty (gross รับเข้ารวม · ล็อกหลัง cutover)
```
bundle commit กับ 1.1 ได้เลย (trivial · zero risk)

### 1.3 👤 Security key hygiene (rotate — เชิงป้องกัน)
**ทำไม:** ระหว่างเซสชันมีการโชว์หน้า Supabase/prod ref บนจอหลายครั้ง · **anon key ไม่ต้อง rotate** (public by design + revoke แล้ว) แต่ถ้า **service-role key / DB password เคยถูกโชว์/commit/แชร์** ควร rotate เชิงป้องกัน
**Checklist (Supabase → Project Settings):**
- [ ] API → **Reset service_role key** (ถ้าเคยหลุด) → อัปเดตใน **Vercel → Environment Variables** (`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`) → redeploy
- [ ] Database → **Reset database password** (ถ้าเคยหลุด)
- [ ] rotate `ANTHROPIC_API_KEY` (หนี้เก่าจาก production-readiness note)
- [ ] `history -c` + ลบ entry รหัสใน `~/.zsh_history`
*(ถ้าไม่แน่ใจว่าหลุดจริงไหม → ทำ service-role + ANTHROPIC ไว้ก่อนก็คุ้ม · DB password ถ้าไม่เคยพิมพ์บนจอ ข้ามได้)*

---

## TIER 2 — Quick win (โค้ด · ต้องรีวิวก่อน deploy)

### 2.1 🤖 Notification badges (งาน B)
**ทำไม:** UX polish · daily value (Tasks ค้าง / low-stock ⚠️ ดึงสายตา) · low risk (read-only count + UI)
**พร้อม:** brief เขียนไว้แล้วใน `BRIEF-receiving-fix-badges.md` §งาน B (ส่งไปแล้ว) — ส่งให้ Claude Code ได้เลย
**สาระย่อ:** เพิ่ม `badge?: number` ใน `type Item` (OpsShell) · layout.tsx (server) fetch count-only 2 ตัว (ops_tasks open · stock qty<=1) ส่งเข้า OpsShell · render pill แดง/ส้ม · query fail → 0 (เมนูห้ามพัง)
**flow:** Claude Code เขียน → วางให้ Builder รีวิว → deploy (เหมือนรอบ receiving)

---

## TIER 3 — Tenant B readiness (เมื่อจะเริ่มขยายลูกค้า)

### 3.1 👤 รัน anon-sweep + lockdown บน new store
**ทำไม:** ก่อนขาย Tenant B ต้องปิดรู anon แบบเดียวกับ prod (grants ติดจาก dump แน่นอน)
**Checklist (Supabase project ของ new store · ref `qsdxelkcjynpkogntvdp`):**
- [ ] รัน `db/security/anon-exposure-sweep.sql` → ดูมี 🔴 กี่ตัว (คาด: หลายตัวเหมือน prod ก่อนแก้)
- [ ] ถ้ามี 🔴 → รัน `db/security/20260809_anon_lockdown.sql` (แนะนำใช้ **OPTION B: default-deny + allowlist** ในไฟล์ · robust กว่า) — **ตรวจ allowlist ให้ตรง store นั้นก่อน**
- [ ] re-sweep → ต้องได้ 0 🔴 / 0 🟠

### 3.2 🟡 Strategic decision: Voice หรือ Tenant B ก่อน
**ยังไม่ใช่ "โค้ดพร้อม deploy"** — ต้องตัดสินใจ + มี external prereq:
- **Voice (SabAI F1):** ต้องได้ iApp key + ใบอนุญาต กสทช./เรต carrier + เลือก orchestrator (LiveKit vs Pipecat) · scaffold อยู่ tenant/base ยังไม่ขึ้น main · งานใหญ่หลายสัปดาห์
- **Tenant B:** สร้าง silo (Supabase+Vercel ใหม่) + onboarding flow · ROI ตรง (ขายได้เพิ่ม) · ต่อยอด production-readiness
- **คำแนะนำ Builder:** ถ้าเป้าคือรายได้ → **Tenant B ก่อน** (voice = enhancement ของร้านเดียว · Tenant B = ลูกค้าใหม่) · แต่เป็น call ของ Owner
- เตรียมไว้แล้ว: `KICKOFF-SabAI-Voice-F1-prep.md` · `KICKOFF-DocBrief-Production-Readiness.md` (production/Tenant B)

---

## TIER 4 — รอเงื่อนไข (blocked · ยังไม่ต้องแตะ)

### 4.1 ⛔ RLS SECTION 8
blocked on **login/auth flow** (ยังไม่มี auth จริง · ops ใช้ cookie+service role) · เปิด RLS ตอนนี้ = ไม่มี policy = แอปอ่านไม่ได้ · **ทำตอนเปิด Supabase Auth** · SQL อยู่ใน master SECTION 8 แล้ว

### 4.2 ⛔ Receiving bill acceptance #1–3
blocked on **ของเข้าจริง (บิลจริง)** · A2 (ปุ่มรับเข้าเพิ่ม) verify prod แล้ว · เหลือเทส flow บิลเต็ม (SKU ใหม่ / restock ผ่านบิล / re-confirm) ตอนรับล็อตหน้า

---

## Housekeeping (optional · เมื่อว่าง)
ลบ branch ที่ merge แล้ว กัน clutter:
```
git branch -d pathb-cutover-display feat/receiving-restock
git push origin --delete pathb-cutover-display feat/receiving-restock   # ถ้าอยากลบบน remote ด้วย
```
(เก็บ tenant/base, sabai-f1-voice-scaffold ไว้ · ยังใช้)

---

## สรุป runway ที่แนะนำ
1. **กลับมาครั้งหน้า:** deploy TIER 1.1 + 1.2 (git · 2 นาที) → ทำ 1.3 rotate (dashboard) → เสร็จ security หนี้ทั้งหมด
2. **มีเวลาโค้ด:** ส่ง badges brief (2.1) ให้ Claude Code → รีวิว → deploy
3. **จะขยาย:** ตัดสินใจ Voice/Tenant B (3.2) → ถ้า Tenant B ทำ 3.1 ก่อน go-live
