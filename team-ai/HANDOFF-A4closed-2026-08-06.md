สรุปสถานะ — A4 ปิด + Pro + Path B audit (ก๊อปไปแชตใหม่) · 6 ส.ค. 2026
โปรเจกต์: DocBrief OS / chutiparts-web (ChutiBenz Mini ERP, ร้านอะไหล่ Benz มือสอง)
ทีม: Owner=Mr.Chuti (ถือ prod/creds) · Builder=Claude · Reviewer=verify/WIRE · Claude Code=dev autonomous
prod: Supabase `chutiparts-prod` ref `qaqawfvbaqyznuuecfp` — **Pro แล้ว** · staging ref `gccytdbydtmsqzvoibcz` · repo `/Users/easy/Desktop/CODE/chutiparts-web`

═══ เสร็จวันนี้ (6 ส.ค.) ═══
1. **PR#3 (Stock ledger sell / SELL-N4) merged** → prod deploy `a2df6d5` LIVE (sell 2 ไฟล์ additive revert-safe)
2. **A4 sell-shadow ปิด** ✅ smoke 5/5 + sell-side reconcile (A: S1-S4=0 · B: 4 บิล diff=0 rows=1)
3. **Supabase Pro** ($25) = daily backup 7 วัน + ไม่ pause
4. **void 4 บิล test เสร็จ** (customer 'test', ฿22,800) — stock_movements กลับเป็น 0 (clean slate)
5. **Path B audit ทั้ง repo เสร็จ** (ดูด้านล่าง — แผนเดิม 4 จุดตกไป 3 อย่าง)

═══ 🔑 ข้อเท็จจริง schema (ใช้เขียน SQL/โค้ดรอบหน้า) ═══
- `stock_movements` คอลัมน์จำนวน = **`qty_change`** (signed, issued=ลบ) ไม่ใช่ `qty` · `sale_id` เป็น **text** · `line_item_id` (receive), `stock_record_id`, `note`, `created_at`
- `sales_records.id` = **uuid** → join `s.id::text = m.sale_id`
- Path B (left) = `stock_records.qty − Σ sales_records.qty` (ต่อ SKU)
- ⚠️ **`v_stock_active` = `SELECT * FROM stock_records WHERE deleted_at IS NULL` เฉยๆ** (qty passthrough ไม่ใช่ ledger!) → `v_stock_active.qty` ≡ `s.qty` · "แก้ oversell → v_stock_active" = **no-op ยกเลิกไป**
- ⚠️ `shadow_reconcile_v2.sql` = ฝั่ง receive (documents/line_item_id/'received') **ใช้กับ sell ไม่ได้** (0/0 vacuous = false pass) · ใช้ sell-side reconcile แทน

═══ 💡 oversell — เข้าใจใหม่ (ไม่ต้องแก้ logic) ═══
- oversell ใช้ `s.qty` → พอเปิด trigger เฟส 2, qty จะ live → `qty > s.qty` ถูกต้องอัตโนมัติ **ไม่ต้องแตะโค้ด oversell**
- สิ่งที่ต้องแก้จริง = **จอ display `left`** ที่ยังเป็น Path B (ถ้าไม่ปลด = double-count กับ trigger)

═══ 📊 Path B AUDIT (แผนเดิม "4 จุด" ตกไป 3 อย่าง) ═══
**qty-Path-B ทั้งหมด 6 จุด** (soldBySku + qty−sold · double-count หลัง trigger):
✅1 daily-brief API `api/ai/v1/daily-brief/route.ts` (แผนคุม)
✅2 data-health `api/ai/v1/data-health/route.ts` (แผนคุม)
✅3 parts-search `api/ai/v1/parts/search/route.ts` (แผนคุม)
✅4 StockSuggestion `ledger/StockSuggestion.tsx` (แผนคุม)
❌5 **sell page** `sell/page.tsx:143` `left = qty − sold` — ตกหล่น (แก้เป็น `left = qty`)
❌6 **DailyBrief client** `daily-brief/DailyBriefClient.tsx:228` `sheetStock qty = received − sold` — ตกหล่น (คนละบล็อกกับ API route)

🔴 **+1 จุด WRITE อันตราย (แผนไม่พูดถึง):**
- **ops sync-stock** `sync-stock/page.tsx` + `StockSyncClient.tsx` เขียน `stock_records.qty = gross(รับเข้า)` จากชีต → **รันหลัง cutover = ทับ qty live พัง** ต้อง disable/แก้ก่อน go-live

🟡 **เคลียร์แล้ว (ไม่ใช่ concern cutover):**
- CartDrawer/หน้าร้าน อ่าน `products.stock` = sync จาก Google Sheet "Web Catalog" (`api/sync-stock/route.ts`) **คนละระบบกับ stock_records** — trigger ไม่กระทบ · *(หมายเหตุ: storefront `products` vs ops `stock_records` แยกระบบ ไม่ผูกกัน — pre-existing นอก scope)*
- stock-source `buildDemand` + DailyBrief `reorderSignals` = นับ**จำนวนแถว**ตาม part_name+model ไม่ใช่ qty → ไม่ double-count (แต่คนละความจริงกับ ledger)
- stock-link/route.ts + StockLinkDraft.tsx = กลไกผูก sku (input Path B) บทบาทเปลี่ยนเมื่อมี ledger

═══ 🚦 Go/No-Go เฟส 2 (Owner คุม · แตะ qty จริง · ต้อง backup สดก่อน) ═══
- A4 sell shadow = ✅ · Backup Pro = ✅ (take สดก่อนเปิด trigger) · void test = ✅
- ⬜ **สร้าง trigger** (`fn_trigger` ยังไม่มีบน prod — รัน SECTION 6)
- ⬜ **snapshot qty** (SECTION 7 — rebase qty เป็น on-hand จริงก่อน trigger)
- ⬜ **ปลด Path B display ให้ครบ 6 จุด** (ไม่ใช่ 4): +sell page +DailyBriefClient → `left = qty` · merge = 1 deploy
- ⬜ **จัดการ ops sync-stock** (disable/แก้ ไม่ให้ทับ qty live) ← ห้ามลืม
- ⬜ oversell = **ไม่ต้องแก้** (ถูกเองเมื่อ qty live)
- ⬜ canary → QA → **RLS restore (SECTION 8) ตัวสุดท้าย**
- ⬜ ลบโฟลเดอร์ `_to_delete/` ใน repo (งานมือ Finder)

⚠️ **แผนเฟส 2 ตัวเต็ม (master SQL / SECTION 6-8) อยู่ใน Claude Code workspace** — เอา Path B list นี้ไปเทียบให้ชนกันก่อนลงมือ (บางจุดอาจครอบในแผนแล้วแต่ Builder เข้าไม่ถึง)

═══ งานรอ (เดิม) ═══ SEO (4 ไฟล์ uploads) · 48 ตาราง RLS staging (หลัง cutover) · rotate ANTHROPIC_KEY

═══ หมายเหตุ ═══
- เช็ก project ref (prod `qaqawfvbaqyznuuecfp`) ก่อนรันทุก SQL (Owner เคยกดผิด project)
- แนบไฟล์ในแชตส่งเนื้อว่าง → paste เป็นข้อความ
- browser automation บน Brave ไม่เสถียร → ไกด์+Owner กดเอง เวิร์กกว่า
- merge prod / จ่ายเงิน / ลบข้อมูล = Owner กดเอง (Claude ไม่แตะ)
