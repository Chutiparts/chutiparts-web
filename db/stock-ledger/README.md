# Stock Ledger — DB migrations & cutover SQL

ไฟล์ชุดนี้เดิมอยู่ลอย ๆ ใน `~/Desktop/CODE/` (นอก git) — ย้ายเข้า repo 7 ส.ค. 2026
เพื่อ version-control (เกือบหายตอนหา backup ledger cutover)

## Canonical
- **docbrief_os_stock_ledger_MASTER.sql** — ตัวจริง รวม SECTION 1–8 เรียงตามลำดับรัน
  - S1 ledger table · S2 confirm_stock_document (received) · S3 qty default 0
  - S4 soft-delete + v_stock_active · S5 issue fns · S6 trigger apply_stock_movement
  - S7 cutover snapshot · S8 RLS (รอ login flow)

## ประกอบ
- docbrief_os_stock_ledger.sql / _v2.sql — เวอร์ชันก่อนรวมเป็น MASTER (เก็บ lineage)
- docbrief_os_stock_softdelete.sql — soft-delete แยก
- docbrief_os_pathA_cutover.sql — cutover Path A
- prereq-check-staging.sql — เช็ก staging พร้อมก่อน shadow (อ่านอย่างเดียว)
- P0-2-rls-restore-staging.sql — RLS restore staging
- shadow_*.sql — shadow test (reconcile/scenario/cleanup) ตอน verify ledger

## ⚠️ ก่อนรันบน prod
ดู `LEDGER-CUTOVER-checklist-v2-FINAL.md` — ต้องผ่าน gate G2 (sheet gross/net) ก่อน snapshot
