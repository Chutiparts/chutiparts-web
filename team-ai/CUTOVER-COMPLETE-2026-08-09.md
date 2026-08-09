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

## Artifacts
- `db/stock-ledger/docbrief_os_stock_ledger_MASTER.sql` (SECTION 6/7/8)
- `db/security/20260809_anon_lockdown.sql` + `anon-exposure-sweep.sql`
- branch `pathb-cutover-display` merged → main @ `6cdafd6`
