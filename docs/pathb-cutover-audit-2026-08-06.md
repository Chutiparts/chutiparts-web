# Path B cutover — audit เทียบแผน + สิ่งที่แก้ (6 ส.ค. 2026)

Branch: `pathb-cutover-display` · **ยังไม่ merge** — ต้อง deploy พร้อม DB (snapshot qty → เปิด trigger) ใน cutover เดียว โดย Owner คุมจังหวะ
ถ้า merge ก่อน trigger เปิด: `left/qty` = gross qty (ยังไม่หักขาย) = โชว์ของเกินจริงช่วง interim

---

## ส่วน A — ปลด Path B display (6 จุด · แก้ครบ)

กฎ: ทุกจุดที่คำนวณ `qty − Σ(sales by sku)` → อ่าน `stock_records.qty` ตรง (หลัง trigger = live on-hand) · ลบ `soldBySku`/การหักยอดขายออก · คง fetch sales ไว้เฉพาะที่ยังใช้อย่างอื่น

| # | ไฟล์ | แก้อะไร | fetch sales | downstream |
|---|---|---|---|---|
| 1 | `app/api/ai/v1/daily-brief/route.ts` | ลบ soldBySku · `sheetStock.qty = Number(s.qty)` | **คงไว้** (monthSales revenue/profit L74) | out_of_stock_sku นับจาก qty≤0 — ถูก |
| 2 | `app/api/ai/v1/data-health/route.ts` | ลบ soldBySku + **ตัด salesRes ออกจาก Promise.all** (ไม่มีที่อื่นใช้) · `sheetStock.qty = Number(s.qty)` | **ตัดออก** | cost_missing/out_of_stock นับจาก qty — ถูก |
| 3 | `app/api/ai/v1/parts/search/route.ts` | ลบ soldBySku + **ตัด salesRes** · `available = Number(s.qty)` · แก้คอมเมนต์หัวไฟล์ | **ตัดออก** | status in/out_of_stock อิง available — ถูก |
| 4 | `app/ops-x7k2m9/ledger/StockSuggestion.tsx` | ลบ soldBySku + dep · `left = Number(s.qty)` · แก้ note UI | **คงไว้** (sold90BySku = ดีมานด์ 90 วัน) | filter `left≤1 && sold90≥1` ยังทำงาน |
| 5 | `app/ops-x7k2m9/sell/page.tsx` ⭐ | ลบ block soldBySku (เดิม L137-139) · `left = Number(s.qty)` | **คงไว้** (todaySales L147) | oversell ใช้ `s.qty` (server) — **ไม่แตะ** ถูกอยู่แล้ว |
| 6 | `app/ops-x7k2m9/daily-brief/DailyBriefClient.tsx` ⭐ | ลบ soldBySku · `sheetStock.qty = Number(s.qty)` · **ตัด field received/sold** · แก้ note L704 + บรรทัดแสดง "รับเข้า−ขาย" L711→"คงเหลือ {qty}" | **คงไว้** (reorder/profit/crisis) | lowStock/totalUnits/out-of-stock/Top5 อิง qty — ถูก |

### ตอบคำถาม audit
1. **#5 sell page + #6 DailyBriefClient — ตกหล่นจริงไหม?**
   → **ตกหล่นจริงทั้งคู่** จากแผน "4 จุด" เดิม. ทั้งสองมีบล็อก `soldBySku` + หัก `qty − sold` แยกของตัวเอง (คนละบล็อกกับ #1 API route). ถ้าไม่แก้ = double-count หลัง trigger เปิด. Builder ถูกต้อง.
2. **เจอ Path B จุดอื่นที่ audit นี้ตกไหม?**
   → **ไม่เจอเพิ่ม.** grep ทั้ง repo (`soldBySku`, `received - sold`, `qty) - `) เหลือแค่ 6 จุดนี้พอดี — แก้ครบแล้ว 0 เหลือ.
3. **สิ่งที่ "หน้าตาคล้าย Path B" แต่ไม่ใช่ (ยืนยันไม่แตะ — ถูกต้อง):**
   - `stock-source` `buildDemand` — นับ **จำนวนแถว** stock ตาม part+model (ไม่ใช่ qty) → คนละ model
   - `DailyBriefClient reorderSignals` (L54-70) + `x.sold/x.left` (L68/253/691) — `left` นับ**แถว** in_stock ตามชื่อ, `sold` = จำนวนครั้งขาย 90 วัน (ดีมานด์) → ไม่ใช่ qty ledger
   - `StockSuggestion sold90BySku` — จำนวนครั้งขาย 90 วัน (ดีมานด์) → คงไว้
   - CartDrawer / storefront `products` — sync จาก Google Sheet "Web Catalog" คนละตารางกับ stock_records

---

## ส่วน B — sync-stock (WRITE conflict) · เลือกวิธี (ข) hardened

**ปัญหา:** `applyStockSync` เขียน `stock_records.qty = ยอดรับเข้ารวม (gross)` จากชีต. หลัง cutover qty = live (trigger คุม) → ถ้า Owner เผลอรัน = เขียนทับ qty กลับเป็น gross = **ledger พังเงียบ (double-count กลับมา)**

**วิธีที่เลือก: (ข) gate ด้วย ENV flag + คำเตือน — defense-in-depth**
- **Server (authoritative):** `applyStockSync` return error ทันทีถ้า `process.env.ALLOW_STOCK_SYNC_OVERWRITE !== '1'` → บล็อกการเขียนแม้ bypass UI
- **UI:** banner แดงอธิบายเหตุผล + ปุ่มยืนยันถูก disable + `confirmWrite` เตือนซ้ำ · **preview/diff ยังดูได้** (dry-run ไม่เขียน)
- default = ล็อก · Owner ปลดล็อกเฉพาะตั้งใจ (ก่อน cutover / กู้คืน) โดยตั้ง `ALLOW_STOCK_SYNC_OVERWRITE=1`

**ทำไมไม่เลือกอย่างอื่น:**
- (ก) disable ทั้งหน้า — ตัด tool bootstrap คลังตั้งต้น/กู้คืนทิ้ง = หยาบเกิน
- (ค) rework ให้ additive (ลง receive-ledger แทน overwrite) — เป็น design ที่ **ถูกระยะยาว** แต่ต้องเพิ่ม movement_type='received' + idempotency กัน re-import ซ้ำ + dedup batch ที่รับแล้ว = งานใหญ่ เสี่ยงทำ blind ใน PR display นี้ → **เสนอเป็น follow-up** หลัง cutover นิ่ง

**แผนเฟส 2 เดิมมีจัดการ sync-stock ไหม?** — จาก brief: แผน "4 จุด" โฟกัส display ล้วน ไม่ครอบ write path นี้ → **ช่องโหว่จริง** ที่ Builder จับได้ถูก

---

## Deploy checklist (Owner คุม · cutover เดียว)
1. Snapshot qty → เปิด trigger (fn_trigger / master SQL SECTION 6)
2. Deploy branch นี้ (Path B display อ่าน qty ตรง)
3. ตั้ง ENV prod: **ไม่ตั้ง** `ALLOW_STOCK_SYNC_OVERWRITE` (= ล็อก sync-stock)
4. Smoke test: sell/ledger/daily-brief/parts-search โชว์คงเหลือตรง on-hand · sync-stock page = banner แดง + ปุ่มล็อก

## ยังไม่ได้ทำ (นอก scope PR นี้)
- rework sync-stock → additive receive-ledger (follow-up)
- pre-existing tsc error: `lib/r2-client.ts` module `aws4fetch` (ไม่เกี่ยวกับ PR นี้)
