# REVIEWER VERDICT — Path B cutover PR + SECTION 7 · 6 ส.ค. 2026
Decision record สำหรับเคาะ cutover · branch `pathb-cutover-display` (c725d18 + fix รอ)
ทีม: Builder (Cowork) · Reviewer (verify/WIRE) · Claude Code (dev) · Owner (คุม prod)

## สถานะ 6 checks (Reviewer brief)
| # | check | สถานะ | ปิดโดย |
|---|---|---|---|
| 1 | Path B sweep = 0 | ✅ **ปิด** (grep: soldBySku=0, received−sold=0, ไม่เหลือ qty−Σsales) | Builder |
| 2 | ผู้เขียน qty รายอื่น | ✅ **ปิด** (5 writers · clobber qty มีแค่ sync-stock ซึ่ง gated · ledger update ไม่แตะ qty · docbrief insert = ของใหม่ legit) | Builder |
| 3 | downstream regression | ✅ **ปิด** — บั๊ก `===0`→`<=0` แก้แล้ว (commit `7e812d0`, Builder re-reviewed: scope เป๊ะ, `qty===0` เหลือ 0, `===0` ที่เหลือ legit) | Claude Code + Builder |
| 4 | sync-stock gate | ✅ **ผ่าน** (server gate จริง `applyStockSync` เช็ก ENV + UI defense-in-depth) | Reviewer |
| 5 | snapshot / qty=received | ⚠️ **operational** (ดูล่าง) — SQL diff เดิม invalid | Reviewer + Owner |
| 6 | merge-with-trigger + oversell | ✅ oversell ไม่ถูกแตะ · PR#3 live แล้ว → deploy branch นี้พร้อม trigger (ไม่มี 2-PR window) | Reviewer |

## check 5 — reframed (จุดเสี่ยงสุด)
- ❌ **query เทียบ `stock_movements` = INVALID** (ledger ว่างบน staging → `received=0` ทุกแถว → false pass เสมอ) · Reviewer จับได้ · **ห้ามใช้เป็นหลักฐาน**
- **received ตัวจริง = `stock_records.qty` เอง** (เขียนจาก external Google Sheet ผ่าน sync-stock) · ไม่มี DB source ที่ครบ (`doc_line_items` = partial เฉพาะของเข้าทางเอกสาร · `stock_movements` ว่าง)
- ⚠️ **ambiguity ที่ต้องยืนยัน:** คอมเมนต์ sync-stock ขัดกันว่า qty = gross ("รับเข้ารวม") หรือ net ("คงเหลือ") · `findCol` รับทั้ง 2 label · **ถ้าชีตใช้คอลัมน์ net → Path B หักขาย 2 เด้ง** → Owner ต้องยืนยัน semantics ชีตจริง

## SECTION 7 review (Reviewer · จาก master SQL)
- ✅ สูตร snapshot (`qty − Σsales`) **ถูกสำหรับ sku ไม่ซ้ำ**
- ✅ **dup-SKU double-subtract = เคลียร์** (prod ปัจจุบัน 0 ซ้ำ → per-row = per-sku) · ⚠️ บั๊กอยู่ที่สูตร ไม่ใช่ข้อมูล → **เพิ่ม dup-check ใน precheck รันซ้ำวัน cutover**
- ⚠️ ผูกกับ check-5: ต้อง sync qty ทันก่อน lock+snapshot
- ⚠️ รัน V2-pre (ทำนายติดลบ) ก่อน snapshot (checklist มีแล้ว)

## 2 เงื่อนไข OPERATIONAL ก่อน snapshot (ไม่ใช่บั๊กโค้ด · Owner)
1. **sync-stock ครั้งสุดท้ายให้ qty ทันการรับเข้าล่าสุด → lock (ENV) → freeze intake** (= SECTION 7 "งดรับสต็อกระหว่าง shadow")
2. **รัน precheck = 0 แถวทุกตัว ก่อนกด snapshot:** V0/V2-pre/V3 + duplicate-SKU check + qty-semantics ยืนยัน

## precheck bundle (รัน ณ วัน cutover · ต้อง 0/เคลียร์)
```sql
-- (a) DUP-SKU · ต้อง 0 แถว
select upper(trim(sku)) sku, count(*) rows from stock_records
where deleted_at is null and sku is not null and trim(sku)<>''
group by upper(trim(sku)) having count(*) > 1;

-- (b) PROVABLE-WRONG qty (necessary-not-sufficient) · ต้อง 0 แถว
with sold as (select upper(trim(sku)) k, sum(coalesce(qty,1)) sq from sales_records
              where sku is not null and trim(sku)<>'' group by 1)
select r.sku, r.qty, coalesce(s.sq,0) sold, r.qty-coalesce(s.sq,0) onhand
from stock_records r left join sold s on s.k=upper(trim(r.sku))
where r.deleted_at is null and (r.qty-coalesce(s.sq,0) < 0 or (r.qty=0 and coalesce(s.sq,0)>0))
order by onhand;
```

## VERDICT รวม
- **✅ CODE SIGN-OFF ปิดแล้ว** — check 1-6 + SECTION 7 code-side เคลียร์ครบ · branch `pathb-cutover-display` = c725d18 (Path B display + sync gate) + 7e812d0 (`===0` fix)
- **check-5:** query เดิม invalid → เปลี่ยนเป็น operational (sync freshness + sheet semantics + precheck)
- **SECTION 7:** สูตรถูก + dup เคลียร์
- **🚦 เหลือก่อน cutover = operational precheck เท่านั้น (Owner)** — ไม่มี code/review blocker แล้ว
  1. sync qty ทัน → lock → freeze intake
  2. precheck bundle = 0 (dup-SKU + provable-wrong + ยืนยัน semantics ชีต gross/net)
- **ก่อน merge จริง:** rebase branch onto main สด (base ปัจจุบัน = 06731b8 เก่า)

## cutover sequence (หลัง sign-off · Owner คุม)
backup สด → sync qty ทัน + lock intake → precheck bundle = 0 → snapshot (SECTION 7) → เปิด trigger (SECTION 6) → deploy branch `pathb-cutover-display` → smoke test (sell/ledger/daily-brief/parts-search โชว์ on-hand ตรง · sync-stock = banner ล็อก) → RLS restore (SECTION 8) last
