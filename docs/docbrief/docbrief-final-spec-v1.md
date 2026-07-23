# FINAL SPEC — AI Backoffice Copilot V1 (`docbrief`) on OpsBrief OS Core

**สถานะ:** FINAL SPEC — มีผลบังคับเมื่อ owner ยืนยัน 4 ข้อใน §8
**แทนที่:** `phase-0-addendum-shared-core.md` (addendum เดิมยุบเข้ามาที่นี่)
**ยังใช้ร่วม:** `phase-0-decision-doc.md` §2–§12 (ไม่แก้)

> **นิยามหลัก:** `docbrief` = **โมดูลเอกสารบน OpsBrief OS เดิม** ไม่ใช่ระบบใหม่แยกต่างหาก

---

## 1. Scope / เส้นแบ่งหน้าที่

**Copilot ทำแค่ 5 ขั้นตอน:**
```
เอกสารเข้า → extract → validate → review → export Sheets
```

**ของ OpsBrief OS core — ห้ามแก้ / ห้ามทำซ้ำ:**
- Lead & Follow-up
- Daily Brief / Crisis Watch
- Auth / Role Access / Owner–Team Guardrails
- UI Shell ของ `/ops-x7k2m9/*`
- Storage / Notification / Integration layer ที่ core ใช้อยู่

| | บทบาท |
|---|---|
| **docbrief** | document workflow module บน core |
| **OpsBrief OS** | owner OS / command center — ห้ามยุ่ง logic เดิม |

---

## 2. Stack / Infra

**ทิ้ง (จาก prototype):** Postgres แยก · docker DB · local filesystem storage

**ใช้ shared infra เดิม:**
- **Supabase เดิมของ OpsBrief OS** (DB + auth + storage) — ฐานเดียวกัน
- ตารางใหม่ทั้งหมด **prefix `doc_`** เช่น `doc_documents`, `doc_audit`, `doc_metrics`
- **ห้ามแก้/migrate schema เดิม** ของ OpsBrief OS
- Auth ใช้กลไกเดิม (**OWNER / TEAM**) · route อยู่ใต้ guard เดิมของ `/ops-x7k2m9/*`

> เป้า: **หนึ่ง Supabase · แยกด้วย prefix · shared auth/storage · ไม่แตะ schema core**

---

## 3. UI / Routing

**ไม่สร้างแอปใหม่** — เพิ่ม **หน้าเดียว**:

- Path: **`/ops-x7k2m9/documents`**
- ใช้ **UI shell เดิม (`OpsShell`)** + auth middleware เดิม
- เมนูเพิ่มใน **กลุ่ม owner-admin เท่านั้น** (ไม่อยู่ในเมนูทีม)
- หน้าเดียวนี้ทำ: upload / inbox / review / status + ลิงก์ไปหน้า review/export (ใน owner zone เท่านั้น)

**ห้าม:** dashboard ใหม่ · layout ใหม่ · nav system ใหม่

---

## 4. Integration Strategy — read-only 2 ทาง

### 4.1 Copilot → อ่านจาก core (read-only)
- อ่าน vendor / customer / basic master data จากตาราง core ผ่าน internal query/API
- **SELECT/GET เท่านั้น — ไม่มี write กลับ core**

### 4.2 Core → อ่านสรุปจาก Copilot (read-only)
- Endpoint ใน Copilot: **`GET /internal/documents/summary`**
- OpsBrief OS (Daily Brief / owner view) ดึงไปโชว์เป็นการ์ดสรุปตอนเช้า
- คืนค่า: จำนวนเอกสาร, สถานะ extract/validate/review/export, error ที่ต้องดู

### 4.3 ห้ามใน V1 ⛔
- write กลับเข้า core ทุกกรณี
- auto-link ledger
- auto-update stock / finance ใน core
- **การเขียนการเงินต้องผ่าน owner flow แยกใน core เท่านั้น (ยังไม่ทำรอบนี้)**

> เป้า: **เชื่อมกันได้ เห็นกันได้ แต่ไม่มี write cross-system ใน V1**

### 4.4 ปลายทาง export (ล็อกแล้ว — ปิดประเด็นซ้ำกับ ledger)

- **Google Sheets = final destination ของ workflow V1** — เอกสารไปจบที่นั่น **จบเลย ไม่ใช่ staging**
- ⛔ **ไม่เขียนเข้า `ledger` / `finance` ของ core** ทั้งใน V1 และไม่มีขั้นต่อ auto ใด ๆ
- ถ้าอนาคตต้องการนำเข้า ledger = **เฟสใหม่ ผ่าน owner flow ของ core** (ตัดสินใจแยกต่างหาก ไม่ใช่ส่วนขยายของ V1)

**เหตุผล:** core มี finance stack อยู่แล้ว (`ledger` · `finance` · `landed-cost` · `profit-guard`)
docbrief จึงเป็น **ตัวป้อนข้อมูลที่เชื่อถือได้** ไม่ใช่ระบบบัญชีอีกตัว — คงหลัก **"เล็กพริกขี้หนู ไม่ใหญ่แต่ซ้ำ"**

### 4.5 Lean Engine v1 ↔ state machine (แมพ ไม่ต้องรื้อ)

| Lean Engine | Lane | states |
|---|---|---|
| **Receive** | Intake | `received` → `queued` ✅ *ทำแล้ว* |
| **Parse** | Intake | `extracting` |
| **Validate** | Decision | `pending_review` + review flags |
| **Escalate** | Decision | `pending_review` (flag) / `rejected` |
| **Commit** | Outcome | `confirmed` → `exporting` → `exported` |

> "anomaly / confidence ต่ำ ห้าม commit อัตโนมัติ" = กฎ **confirm-before-write** เดิม (§2) ไม่มีอะไรเปลี่ยน

---

## 5. Spec เดิมที่ยังใช้ต่อ

จาก `phase-0-decision-doc.md`:
- **§2–§12 ใช้ได้ทั้งหมด** — state machine · validation ไทย (วันที่, ยอดเงิน, VAT, tax_id, duplicate) · idempotency export key · metrics / audit / limits
- **เปลี่ยนเฉพาะ §1** (Architecture / Stack / Placement) ตาม §2–4 ของเอกสารนี้

> logic เอกสารถูกแล้ว — แค่ **ย้ายบ้านมาอยู่บน Supabase + OpsBrief core เดิม**

---

## 6. Reuse / ทิ้ง

**ใช้ต่อทันที (~60%):**
- canonical state machine
- validation engine (ชนิดไฟล์, ขนาด, จำนวนหน้า, รูปแบบเลข/วันที่, validation ไทย)
- hash / dedup (sha256)
- pdf utilities (count pages, detect broken file)
- audit log structure (append-only transitions)

**ทิ้ง:**
- Postgres/docker schema แยกที่ไม่อิง Supabase
- local filesystem storage adapter
- infra ใหม่ที่ซ้ำกับ core (auth ใหม่, storage ใหม่, notification ใหม่, metrics DB ใหม่)

> เป้า: **reuse logic · ทิ้ง infra ที่ซ้ำ**

---

## 7. Naming / Repository

- Collision: repo `wire` ชนกับ **WIRE deploy** ที่ทีมใช้อยู่
- ✅ **เปลี่ยนแล้ว:** `wire` → **`docbrief`** (document + brief)
- โฟลเดอร์ปัจจุบัน: `CODE/docbrief/`

---

## 8. รอ Owner Confirm ก่อนเดินหน้า (4 ข้อ)

| # | คำถาม | สถานะ |
|---|-------|-------|
| 1 | **Core repo** ที่จะต่อคืออะไร (GitHub URL)? | ⏳ **รออยู่** |
| 2 | **Supabase project + environment** (dev/stage/prod) ที่ใช้ร่วมกัน | ⏳ **รออยู่** |
| 3 | **ชื่อ `docbrief`** | ✅ **ยืนยันแล้ว** — ใช้ชื่อนี้ |
| 4 | **เอกสาร V1** | ✅ **ยืนยันแล้ว** — ดู §8.1 |

### 8.1 Document scope V1 (ล็อกแล้ว)

**รวม:**
- **invoice / receipt / tax invoice — ฝั่งซื้อจาก vendor เท่านั้น**
- flow เดิม: intake → extract → validate → review → export
- validation, state machine, idempotency ตาม `phase-0-decision-doc.md` §2–12 ใช้ต่อได้ทั้งหมด

**ไม่รวมใน V1 ⛔ — slip โอนเงินลูกค้า**
เหตุผล (ถ้ารวมจะพังหลายจุดพร้อมกัน):
- validation คนละแบบ
- fields คนละชุด
- **duplicate / idempotency key ใช้สูตรเดิมไม่ได้** (slip ไม่มี `doc_no` / `tax_id`)
- review flow จะแตกเป็น product branch อีกสายทันที

> ถ้าจะเพิ่ม slip ในอนาคต = **เฟสแยก + รีวิว §2–12 ใหม่** ไม่ใช่แค่เพิ่ม type

### 8.2 สถานะ

- ✅ ข้อ 3, 4 ยืนยันแล้ว
- ⏳ **ยังเหลือข้อ 1, 2 — ห้ามเขียน schema / route / UI จริงจนกว่าจะครบ**
- งานที่ทำล่วงหน้าได้: อ่าน repo core · map จุดเสียบ `/ops-x7k2m9/documents` · list ตาราง `doc_*` · เตรียม migration plan (ไม่แตะ schema เดิม)

---

## 9. ผลทดสอบจริง (2026-07-23) — ข้อค้นพบที่กระทบสเปก

### 9.1 Scope เดิมไม่ตรงธุรกิจจริง
- **"บิลซื้อจาก vendor" ไม่มีอยู่จริง** — อะไหล่นำเข้าเหมาทั้งตู้ (7 แสน–1 ล้านบาท) ผู้ขายไม่ออกใบเสร็จ
- เอกสารที่มีจริง: **ใบขนสินค้าขาเข้า / ใบเสร็จศุลกากร · ใบเสร็จภาษี ภ.พ.30 · สมุดจดลายมือภาษาจีน (รายการอะไหล่)**
- **Pain อันดับ 1 ที่ owner ตอบเอง = คีย์สต็อกอะไหล่เข้าระบบ** (ไม่ใช่คีย์บัญชี แต่ต้องทำทั้งคู่)

### 9.2 แบ่งเป็น 2 โปรไฟล์ ใช้เครื่องยนต์เดียวกัน
| | **A. สต็อก** | **B. บัญชี** |
|---|---|---|
| เอกสาร | สมุดจดลายมือจีน / packing list | ใบเสร็จศุลกากร · ภ.พ.30 · ค่าใช้จ่าย |
| ดึง | **รายการหลายบรรทัด** | **หัวเอกสาร** (§3 เดิม) |
| ปลายทาง | Sheet แท็บ Stock → **`sync-stock` เดิมรับต่อ** | Sheet บัญชี |
| สถานะ | สำรวจแล้ว ยังไม่สร้าง | โค้ดเสร็จ ~90% |

> **Seam สำคัญ:** core มี `sync-stock` (Sheet → `stock_records`, owner ยืนยัน, dry-run, backup) อยู่แล้ว → docbrief แค่ทำ **กระดาษ → Sheet** ไม่ต้อง write กลับ core เลย

**ลำดับที่ตกลง: ทำ B ให้จบก่อน แล้วค่อย A**

### 9.3 ⚠️ confidence ของโมเดลใช้ตัดสินไม่ได้กับลายมือ
ทดสอบสมุดจดจีน: โมเดลรายงาน confidence เฉลี่ย **0.44** แต่ owner ยืนยันว่า**ค่าที่ดึงมาถูกต้อง** → โมเดลประเมินตัวเองต่ำเกินไป

**ผลต่อ §3:** กฎ `confidence < 0.85 → flag` ใช้ได้กับ**เอกสารพิมพ์**เท่านั้น สำหรับลายมือจะตีธงทุกบรรทัดจนไร้ความหมาย

**ให้ใช้ตัวชี้วัดเชิงคณิตแทน:**
- รายการ: `qty × unit_price = amount` ตรงไหม
- หัวเอกสาร: `subtotal + vat = grand_total` ตรงไหม (§4.1)

เลขที่คูณ/บวกลงตัว = อ่านถูกแน่นอน โดยไม่ต้องเชื่อความเห็นของโมเดล

### 9.4 subtotal / vat ต้องเป็น optional
ใบเสร็จศุลกากรและ ภ.พ.30 **ไม่แยก subtotal/VAT** มีแต่ยอดรวม → §3 ที่ระบุว่า required ต้องผ่อนเป็น optional และ §4.1 arithmetic check ข้ามเมื่อค่าเป็น null

---

## Goal

สร้าง Copilot เอกสาร **เล็กพริกขี้หนู** บนฐาน OpsBrief OS เดิม — ไม่ทำระบบซ้ำ · ไม่สร้างแอปใหม่ · เชื่อมแบบ read-only ก่อน · ขยายต่อได้อย่างปลอดภัยในเฟสถัดไป
