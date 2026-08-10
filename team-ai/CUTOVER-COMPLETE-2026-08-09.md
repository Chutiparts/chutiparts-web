# CUTOVER COMPLETE — ChutiBenz Stock Ledger · 2026-08-09
สถานะ: ✅ **สำเร็จเต็มรอบบน prod** (`qaqawfvbaqyznuuecfp`) · executed by Owner · guided by Builder
ผลลัพธ์: stock_records.qty เปลี่ยนจาก "gross ต้องพึ่ง Path B หักขาย" → **live on-hand คุมด้วย trigger**

## สิ่งที่ทำ (ตามลำดับจริง)
1. **Gate G2** — ยืนยันชีต `Mr_Chuti_Stock_v11` แท็บ "รับเข้า" คอลัมน์จำนวน = **gross** (รับเข้าต่อครั้ง) → สูตร snapshot `qty − Σsales` ถูกต้อง
2. **Gate F1 (security)** — anon exposure sweep เจอ **15 object รั่ว** (anon อ่าน/เขียนได้ทั้งที่ไม่ใช่ public): v_stock_active(+cost), stock_records, quotes_inbox, vin_check/lookup_requests(PII), cases, events, reviews, pilot_×5, vin_fitment/provenance → **revoke all from anon ครบ · re-sweep = 0 violation** · เก็บเป็น migration `db/security/20260809_anon_lockdown.sql`
3. **rebase** `pathb-cutover-display` onto main สด (diff = 9 ไฟล์ Path B + audit doc เท่านั้น)
4. **backup** — ใช้ daily auto-backup (floor 2026-08-08 16:23 UTC) · ไม่กด manual (snapshot ถอยเองได้ + Vercel rollback)
5. **freeze intake** (ไม่มีของเข้าใหม่ → ข้าม last-sync)
6. **precheck** — dup-SKU = 0 · provable-wrong = 0 · dry-run ไม่มี after ติดลบ (min=1)
7. **SNAPSHOT** — `qty := qty − Σsales` · verified ด้วย updated_at (touched 3 SKU ที่มีขาย @ 11:51) + health-check (neg=0, min=1, max=29, total=86) = **รันครั้งเดียว ถูกต้อง**
8. **TRIGGER** — เปิด `trg_apply_stock_movement` on stock_movements (verified 1 row)
9. **DEPLOY** — `git merge --ff-only` → push main `7bb2c75..6cdafd6` → Vercel Ready (Path B display หาย)
10. **SMOKE TEST** — ทุกจุด on-hand ตรง · **roundtrip: ขาย 140-004 → 5→4 · reversal → 4→5** (trigger 2 ทาง) · sync-stock = 🔒 ล็อก · idempotent การันตีด้วย ux_movement_per_sale
11. **cleanup** — ลบ test sale (id 423675e9…) · revenue สะอาด · stock คืน 5

## สถานะระบบหลัง cutover
- `stock_records.qty` = **live on-hand** · คุมด้วย trigger (ขาย=−, รับ=+)
- **Path B display ถูกถอด** (6 จุด) · เว็บอ่าน qty ตรงจาก DB
- **sync-stock ล็อก** (gate `ALLOW_STOCK_SYNC_OVERWRITE`) กัน double-count · preview/diff ยังดูได้
- **anon exposure = 0** (F1 ปิดครบ)
- รับสต็อกใหม่ = ผ่าน document/intake flow (received movement → trigger) · ไม่ใช่ sync

## Follow-up ค้าง (ไม่บล็อก)
- [ ] **rotate รหัส prod DB** ที่เคยหลุด (urgent)
- [ ] **RLS SECTION 8** — ผูก login flow (ทำตอนเปิด auth)
- [ ] **Voice → ChutiBenz** — ปลดบล็อกแล้ว (scaffold ขึ้น main + migration + orchestrator)
- [ ] **security migration** cherry-pick เข้า main (ตอนนี้อยู่ tenant/base) + รัน sweep บน new store ก่อนขาย Tenant B
- [ ] **stale comment** `sync-stock/page.tsx` บรรทัดแรก (เขียน "net" ผิด จริงเป็น gross) — ลบตอนแก้รอบหน้า
- [x] ~~**receiving flow**~~ — ✅ ปิดแล้ว 2026-08-10 (ดู addendum ล่าง) · badges (งาน B) ยังค้าง

## Artifacts
- `db/stock-ledger/docbrief_os_stock_ledger_MASTER.sql` (SECTION 6/7/8)
- `db/security/20260809_anon_lockdown.sql` + `anon-exposure-sweep.sql`
- branch `pathb-cutover-display` merged → main @ `6cdafd6`

---

# ADDENDUM 2026-08-10 — Receiving gap → ปิดแล้ว ✅
พบหลัง cutover: **บรรทัด "รับสต็อกใหม่ผ่าน document/intake" ข้างบนเป็นสมมติฐานที่ผิด** — เช็กโค้ดจริงแล้ว flow รับเข้ายังไม่ครบ

## ปัญหาที่เจอ (หลัง sync-stock ถูกล็อก)
- `add-part` / edit สต็อก **ไม่มีฟิลด์ qty** → เพิ่ม/เติมจำนวนไม่ได้
- `confirmStockDocument` (ปุ่มยืนยันเข้าสต็อก) เดิม **บล็อก SKU ที่มีอยู่** ("SKU ซ้ำ") + เขียน qty ตรง ไม่ผ่าน movement
- ผล = **รับสต็อกเข้าผ่านเว็บไม่ได้เลย** (sync ล็อก + ไม่มีทางอื่น)

## แก้ (branch `feat/receiving-restock` → main `bafd858`)
- **งาน A** `confirmStockDocument` — ทุกบรรทัดเข้าสต็อกผ่าน **received movement** (line_item_id) → trigger บวก qty:
  - SKU ใหม่ → insert row (qty=0) + received movement · SKU เดิม → movement เข้า row เดิม
  - idempotent: `ux_stock_movements_line` (23505) + delete-orphan · ambiguous preflight · qty>0 guard · same-bill dup dedup
- **งาน A2** — ปุ่ม **"➕ รับเข้าเพิ่ม (ไม่มีบิล)"** ต่อแถวใน Ledger → received movement (owner-gated) · ปุ่ม disable busy + guard

## Verify (adversarial review 2 รอบ + prod)
- โค้ด: ไล่ crash/concurrency path ครบ · tsc/lint สะอาด
- prod: `ux_stock_movements_line` + `ux_movement_per_sale` มีจริง · ไม่มี global unique(sku) (แค่ pkey)
- staging: 23505 idempotency ✅ · **prod A2 test: 140-004 รับเข้า +3 → 5→8 ✅** (reverse −3 คืน 5)

## รับสต็อกยังไง (ตั้งแต่ 2026-08-10)
- **มีบิล** → หน้า "รับเข้าสต็อก" (stock-intake) → ยืนยัน
- **ไม่มีบิล / เติมด่วน** → Ledger → คลิกแถวสต็อก → "➕ รับเข้าเพิ่ม +N"
- **ห้ามใช้ sync-stock** (ล็อก · จะทำ qty กลับเป็น gross)

## ค้างต่อ
- acceptance บิลจริง #1–3 (SKU ใหม่ / restock ผ่านบิล / re-confirm) — ทำตอนของเข้าล็อตหน้า
- งาน B (notification badges) — brief เขียนไว้แล้ว ยังไม่ทำ
