# WIRE — Phase 0 Decision Doc (Spec Lock)

> เอกสารนี้คือผลของ Phase 0 ตาม `ai-backoffice-copilot-phased-dev-spec.md`
> **สถานะ:** DRAFT — รออนุมัติจาก Owner
> **กติกา:** ห้ามเริ่ม Phase 1 build เต็มรูปแบบ จนกว่าเอกสารนี้จะ PASS owner review
> **ขอบเขต:** V1 = Module 1 Smart Document Intake เท่านั้น (invoice / receipt → Google Sheets)

---

## สารบัญการตัดสินใจ (12 เรื่องที่ต้องล็อก)

| # | เรื่อง | สถานะ |
|---|--------|--------|
| 1 | Tech stack เดียว | ✅ ล็อกแล้ว |
| 2 | Canonical state machine | ✅ ล็อกแล้ว |
| 3 | Field spec (required/optional) | ✅ ล็อกแล้ว |
| 4 | Validation rules ไทย | ✅ ล็อกแล้ว |
| 5 | Export idempotency key | ✅ ล็อกแล้ว |
| 6 | Phase 2 acceptance metrics | ✅ ล็อกแล้ว |
| 7 | Error taxonomy (เพิ่ม) | ✅ ล็อกแล้ว |
| 8 | Review ownership (เพิ่ม) | ✅ ล็อกแล้ว |
| 9 | Audit trail (เพิ่ม) | ✅ ล็อกแล้ว |
| 10 | Google Sheets export schema | ✅ ล็อกแล้ว |
| 11 | File limits (ชนิด/ขนาด/หน้า) | ✅ ล็อกแล้ว |
| 12 | Retry & failure policy | ✅ ล็อกแล้ว |

> **คำศัพท์มาตรฐาน (บังคับทั้ง doc + code + DB + API + UI):**
> `pending_review` คือ **state เดียว** สำหรับ review queue ทั้งหมด — ทุกใบที่รอคนตรวจอยู่ state นี้ค่าเดียว
> **ห้ามสร้าง alias เด็ดขาด** ทั้งใน DB enum, ตัวแปรใน code, response ของ API, และ label บน UI (ห้าม `needs_review`, `review_pending`, `to_review` ฯลฯ)
> การจัดลำดับ/ประเภทเหตุผล ให้ใช้ **review flags** (`low_confidence`, `validation_failed`, `possible_duplicate`, `future_date`, `invalid_tax_id`, `vat_mismatch`) — ไม่ใช่สร้าง state ใหม่

---

## 1. Tech Stack (ล็อก — ห้ามเปลี่ยนกลาง V1)

| Layer | เลือก | เหตุผล |
|-------|-------|--------|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind** | Fullstack เดียวจบ, lean, deploy ง่าย |
| Backend | **Next.js Route Handlers** (monolith) | ไม่แยก service ใน V1 ลด ops overhead |
| DB | **Postgres** | relational + constraint แข็งแรง เหมาะข้อมูลการเงิน |
| Storage | **Object storage (S3-compatible)** เช่น Cloudflare R2 / Supabase Storage | เก็บ original file แยกจาก DB |
| Extraction Engine | **Claude vision extraction** (structured output) | ภาษาไทยดี, structured output งง่าย, vendor เดียว, เข้าธีม AI copilot |
| Job/Queue | **DB-backed job table** + worker loop | ไม่เพิ่ม infra (Redis/queue) ใน V1 |

**Cost control สำหรับ Claude:**
- เรียก extraction **1 ครั้ง/เอกสาร** เท่านั้น (ยกเว้น retry ที่ owner สั่ง)
- ใช้ prompt caching สำหรับ system prompt + field schema
- Downscale ภาพก่อนส่ง (ขนาดพออ่าน แต่ไม่เกินจำเป็น)
- Rate limit ต่อ user/วัน

**Cost cap ต่อเอกสาร (ค่าตั้งต้น V1 — ปรับหลังวัดจริงใน Phase 2):**

| ระดับ | ค่าตั้งต้น | พฤติกรรม |
|-------|-----------|----------|
| **Soft cap** | **2 บาท/ใบ** | เกิน → log + แจ้งเตือน owner แต่ยังทำงานต่อ |
| **Hard cap** | **4 บาท/ใบ** | เกิน → หยุด, mark `failed` (`error_category = cost_limit`), รอ owner สั่ง |

> ตัวเลขนี้เป็น **placeholder ที่ตกลงร่วมกันแล้ว** ให้ทีมใช้เป็นค่าเริ่ม ไม่ใช่ให้ตั้งกันเอง — Phase 2 จะรายงาน cost จริงแล้วปรับ

**ยังไม่ทำใน V1:** microservices, message broker แยก, multi-model routing

---

## 2. Canonical State Machine (แหล่งความจริงเดียวของสถานะเอกสาร)

ทุก Phase อ้างอิง state machine นี้เท่านั้น ห้ามสร้าง state นอกรายการ

```
received → queued → extracting → pending_review → confirmed → exporting → exported
                        │              │                            │
                        ▼              ▼                            ▼
                     failed        rejected                     failed
                                  (โดยคน)                    (retry ได้)

  intake พบไฟล์ซ้ำ (hash ตรง) ──► duplicate  (terminal)
```

### นิยาม state

| State | ความหมาย | ใครทำให้เปลี่ยน |
|-------|----------|-----------------|
| `received` | สร้าง record + เก็บ original file แล้ว | system (Phase 1) |
| `queued` | ผ่าน dedup ระดับไฟล์ รอ extract | system |
| `extracting` | Claude กำลังดึงข้อมูล | system (Phase 2) |
| `pending_review` | ดึงเสร็จ รอคนตรวจ (ทุกใบต้องผ่านตรงนี้) | system → คน |
| `confirmed` | Owner ยืนยันค่าถูกต้องแล้ว | **Owner เท่านั้น** |
| `exporting` | กำลังเขียนลง Sheets | system (Phase 4) |
| `exported` | เขียนสำเร็จ (terminal, success) | system |
| `rejected` | Owner ปฏิเสธเอกสาร (terminal) | **Owner เท่านั้น** |
| `duplicate` | ไฟล์ซ้ำระดับ hash (terminal) | system (Phase 1) |
| `failed` | error — มี `error_category` เสมอ | system |

### กฎเหล็กของ state machine
- **ไม่มี auto-export** — ทุกใบต้องผ่าน `pending_review → confirmed` โดยคน (Confirm-before-write)
- `pending_review` มี **review flags** (ไม่ใช่ state แยก) เช่น `low_confidence`, `validation_failed`, `possible_duplicate` เพื่อจัดลำดับความสำคัญในคิว
- `failed` retry ได้ แต่ **retry นับ cost ใหม่** และต้องมี owner action (กันวน loop เผาเงิน)
- ทุก transition เขียน **audit log** (ดูข้อ 9)

### `validation_failed` vs `failed` (ล็อกให้ไม่ตีความชนกัน)
- **Validation fail ใน Phase 3 ≠ state `failed`** — เอกสารยังอยู่ที่ **`pending_review`** พร้อม flag `validation_failed` เพื่อให้คนตัดสิน (เช่น arithmetic ไม่ตรง, tax_id checksum ผิด, future date)
- เอกสารจะไป state **`failed`** ก็ต่อเมื่อ **process รันต่อไม่ได้จริง** เท่านั้น (เช่น ไฟล์เสีย, Claude อ่านไม่ออก, Sheets ล่ม)
- สรุป: *"validation ผิด = ให้คนดู, ไม่ใช่ระบบพัง"*

---

## 3. Field Spec (V1 — invoice / receipt)

| Field | Type | Required? | หมายเหตุ |
|-------|------|-----------|----------|
| `vendor_name` | string | **required** | ชื่อผู้ขาย/ร้าน |
| `vendor_tax_id` | string(13) | optional* | ใบเสร็จรายย่อยอาจไม่มี → optional แต่ถ้ามีต้อง valid |
| `doc_no` | string | **required** | เลขที่เอกสาร (ใช้ใน idempotency key) |
| `doc_date` | date (ISO) | **required** | normalize เป็น `YYYY-MM-DD` ค.ศ. เสมอ |
| `subtotal` | decimal(2) | optional† | ก่อน VAT |
| `vat` | decimal(2) | optional† | ภาษีมูลค่าเพิ่ม |
| `grand_total` | decimal(2) | **required** | ยอดสุทธิ (ใช้ใน idempotency key) |
| `currency` | string(3) | **required** | default `THB` ถ้าไม่ระบุ |

\* `vendor_tax_id` เป็น optional แต่ถ้า extract ได้ค่ามา **ต้องผ่าน validation** (ข้อ 4)

† **แก้ 2026-07-23 จาก required → optional:** ทดสอบเอกสารจริงพบว่า **ใบเสร็จศุลกากรและ ภ.พ.30 ไม่แยก subtotal/VAT** มีแต่ยอดรวม ถ้าบังคับ required จะตีตกเอกสารที่ถูกต้อง
→ เมื่อค่าใดค่าหนึ่งเป็น null ให้ **ข้าม arithmetic check** (§4.1) ไม่ใช่ตีเป็น fail

### กติกา confidence (แก้ 2026-07-23)
- ทุก field มี `confidence` (0–1) แยกราย field
- **ห้ามใช้ confidence ของโมเดลเป็นตัวตัดสินหลัก** — ทดสอบสมุดจดลายมือพบว่าโมเดลรายงาน 0.44 แต่ค่าที่ดึงมา**ถูกต้องจริง** (ประเมินตัวเองต่ำเกินไปกับลายมือ) ถ้าใช้ threshold คงที่จะตีธงทุกบรรทัดจนธงไร้ความหมาย

**ลำดับความน่าเชื่อถือที่ให้ใช้แทน:**
1. **กฎเชิงคณิต (เชื่อถือได้สูงสุด)** — `subtotal + vat = grand_total` หรือ `qty × unit_price = amount`
   → ถ้าคูณ/บวกลงตัว = อ่านเลขถูกแน่นอน **ไม่ต้องดู confidence เลย**
2. **confidence (ใช้เป็น fallback)** — เฉพาะเมื่อกฎข้อ 1 **รันไม่ได้** (ค่าเป็น null) ให้ใช้ `< 0.85` ตั้ง flag `low_confidence`
- เก็บ `raw_extraction` (JSON ดิบจากโมเดล) ไว้เสมอ เพื่อ debug ว่า field มาจากไหน

---

## 4. Validation Rules ไทย (ล็อก — โมเดลห้ามเดา ระบบต้องตรวจซ้ำ)

> หลักการ: Claude ดึงค่า → **ระบบ validate ด้วยกฎ deterministic เอง** ไม่เชื่อโมเดล 100%

### 4.1 VAT (ภาษีมูลค่าเพิ่ม 7%)
- อัตรามาตรฐาน = **7%**
- **Arithmetic check (ล็อก):** `abs(subtotal + vat - grand_total) ≤ 0.02 THB` — เกิน → flag `validation_failed` เข้า review
- **VAT sanity check (ล็อกค่า tolerance ชัดเจน เพื่อให้ QA เขียน test ได้):**
  ```
  expected_vat = round(subtotal * 0.07, 2)
  ผ่าน  ถ้า  abs(vat - expected_vat) ≤ 1.00 THB
  ```
  - tolerance = **1.00 บาท** (เผื่อ rounding สะสมจากหลาย line item — ไม่ใช่คำกว้าง ๆ อีกต่อไป)
  - เกิน tolerance → flag **`vat_mismatch`** เข้า review (บางใบเป็น VAT-inclusive หรือมีสินค้ายกเว้นปน — **ไม่ auto-reject** ให้คนตัดสิน)
- **VAT = 0** อนุญาตได้ (สินค้า/บริการยกเว้น) แต่ตั้ง flag `vat_mismatch` ให้คนดูเสมอ
- **หมายเหตุ VAT-inclusive:** ถ้าเอกสารเป็นราคารวม VAT (`grand_total` = ราคารวม, ไม่มี subtotal แยก) → ระบบคำนวณย้อน `subtotal = round(grand_total / 1.07, 2)`, `vat = grand_total - subtotal` แล้ว flag ให้คนยืนยัน

### 4.2 Tax ID (เลขประจำตัวผู้เสียภาษี 13 หลัก)
- ต้องเป็นตัวเลข **13 หลักพอดี**
- ตรวจ **checksum หลักที่ 13** ตามสูตรกรมสรรพากร:
  ```
  sum = Σ (digit[i] * (13 - i))  for i = 0..11
  check = (11 - (sum % 11)) % 10
  valid = (check == digit[12])
  ```
- ถ้าไม่ผ่าน checksum → flag `invalid_tax_id` เข้า review (ไม่ลบค่า — ให้คนตัดสิน)

### 4.3 Date normalization (พ.ศ. / ค.ศ.)
- เก็บภายในเป็น **ค.ศ. `YYYY-MM-DD` เสมอ**
- ถ้าปี > 2400 → ถือเป็น **พ.ศ.** แปลง `ค.ศ. = พ.ศ. − 543`
- ถ้าปี 2500–2600 (คร่อมช่วง) → ใช้เกณฑ์ พ.ศ. เป็นหลัก (ธ.พ. ไม่มีเอกสารปี ค.ศ. 2500)
- รองรับ format ไทย: `31/12/2567`, `31 ธ.ค. 2567`, `2567-12-31`
- **ห้ามวันที่อนาคต:** `doc_date > today` → flag `future_date` เข้า review

### 4.4 Currency / เงินบาท
- default `THB` ถ้าเอกสารไม่ระบุ
- parse ตัวเลขเงิน: ตัด `฿`, `บาท`, comma คั่นหลัก, ช่องว่าง → decimal 2 ตำแหน่ง
- ต้อง `grand_total > 0`
- ระวัง comma vs จุดทศนิยม: `1,234.50` = 1234.50 (ไทยใช้ comma หลักพัน, จุดทศนิยม)

### 4.5 เลขเอกสาร (doc_no)
- required, ไม่ว่าง
- trim ช่องว่างหน้า-หลัง, เก็บ original ไว้ด้วย
- ใช้ประกอบ idempotency key (ข้อ 5)

### 4.6 Duplicate check
- **ระดับไฟล์ (Phase 1):** sha256 ของ byte ไฟล์ตรงกัน → `duplicate` ทันที
- **ระดับเนื้อหา (Phase 3):** `export_key` (ข้อ 5) ชนกับที่ export ไปแล้ว → flag `possible_duplicate`
  - **`possible_duplicate` = review only, ไม่ auto-block** — ให้คนตัดสิน เพราะ:
    - เลขเอกสารเดิมแต่คนละบริบท (เช่น ออกใหม่แทนใบเดิม, ยอดตรงกันบังเอิญ)
    - `vendor_tax_id` ว่าง (ใบเสร็จรายย่อย) ทำให้ key ชนกันง่ายขึ้น
  - มีเพียง **exact file hash (Phase 1)** เท่านั้นที่ auto-block เป็น `duplicate`

---

## 5. Export Idempotency Key (สูตรเดียว ใช้ซ้ำทั้งระบบ)

```
export_key = sha256(
    lower(trim(vendor_tax_id | "NA")) + "|" +
    trim(doc_no)                       + "|" +
    format(grand_total, "0.00")        + "|" +
    doc_date_iso (YYYY-MM-DD)          + "|" +
    upper(currency)
)
```

- คำนวณ **หลัง confirm** (ใช้ค่าที่คนยืนยันแล้ว ไม่ใช่ค่าดิบจากโมเดล)
- ตาราง export ปลายทางมี **unique constraint บน `export_key`**
- retry export ที่ key เดิม → **ไม่สร้างแถวใหม่** (คืน status เดิม)
- `vendor_tax_id` ว่าง → ใช้ literal `"NA"` เพื่อให้ key ยัง deterministic

---

## 6. Phase 2 Acceptance Metrics (เกณฑ์ผ่านเป็นตัวเลข)

Test set: **เอกสารจริง 30–50 ใบ** แยก invoice/receipt, มี ground truth ที่คนคีย์เอง

| Metric | เกณฑ์ผ่าน | หมายเหตุ |
|--------|-----------|----------|
| Critical field accuracy | **≥ 90%** | `grand_total`, `vat`, `doc_no`, `doc_date` |
| All-field accuracy | **≥ 80%** | ทุก field รวม vendor/tax_id |
| Arithmetic consistency | **100%** ของใบที่ export | `subtotal+vat=total` ต้องผ่านก่อน confirm |
| Review rate | รายงานเป็น baseline | % ใบที่มี flag (ไม่มีเกณฑ์ fail แต่ต้องวัด) |
| Export success rate | **≥ 99%** | หลัง confirm |
| Duplicate false-export | **= 0** | ห้าม export ซ้ำโดยไม่มีเหตุผลเด็ดขาด |
| Hallucinated field | **= 0** | ห้ามโมเดลแต่งค่าที่ไม่มีในเอกสาร |
| Cost/เอกสาร | รายงานจริง + ตั้ง cap | เป้าเบื้องต้น ≤ ~2–3 บาท/ใบ (ปรับหลังวัด) |

**Pass Gate Phase 2:** critical accuracy ≥ 90% + hallucinated = 0 + วัด cost/ใบ ได้จริง

### 6.1 Test Fixtures (ต้องมีก่อนเริ่ม Phase 2 — Owner จัดหา)
> **Blocker ของ Phase 2:** ต้องมีเอกสารตัวอย่างจริง **3–5 ใบ** เป็น starter fixture ก่อนเริ่ม build extraction (แล้วขยายเป็น 30–50 ใบตอน QA)

ชุด starter ควรครอบเคสหลากหลาย (อย่างน้อย):
| ใบที่ | ประเภท | จุดที่อยากให้ครอบ |
|-------|--------|-------------------|
| 1 | Full tax invoice | มี tax_id 13 หลัก, VAT 7% แยกชัด |
| 2 | Receipt รายย่อย | **ไม่มี** tax_id (ทดสอบ optional + key = "NA") |
| 3 | VAT-inclusive | ราคารวม VAT (ทดสอบ §4.1 คำนวณย้อน) |
| 4 | วันที่ พ.ศ. | เช่น `31/12/2567` (ทดสอบ date normalization) |
| 5 | เคสยาก | ภาพถ่ายมือถือ/เอียง/แสงไม่ดี (ทดสอบ `ocr_unreadable`) |

- แต่ละใบต้องมี **ground truth** (ค่าที่ถูกต้องจริง คนคีย์เอง) เก็บคู่กันเพื่อวัด accuracy
- เก็บใน repo เป็น test fixture (ปกปิดข้อมูลจริง/PII ถ้าจำเป็น)

---

## 7. Error Taxonomy (ทุก `failed` ต้องระบุ category)

| `error_category` | เกิดตอนไหน | ตัวอย่าง |
|------------------|-----------|----------|
| `intake_error` | Phase 1 | ไฟล์เสีย, format ไม่รองรับ, ไฟล์ใหญ่เกิน limit |
| `ocr_unreadable` | Phase 2 | ภาพเบลอ/มืด, Claude อ่านไม่ออก |
| `parse_error` | Phase 2 | อ่านได้แต่ map เป็น field ไม่ได้ / JSON ไม่ครบ |
| `validation_failed` | Phase 3 | arithmetic ไม่ตรง, tax_id ผิด, future date (→ ปกติเข้า review ไม่ fail) |
| `export_failed` | Phase 4 | Sheets API error, schema mismatch, network |
| `cost_limit` | ทุก phase | เกิน rate limit / cost cap |

- แต่ละ error เก็บ `error_message` + `error_category` + timestamp + retry count
- error ที่ retry ได้ (`export_failed`, `ocr_unreadable`) แยกจากที่ต้องคนแก้ (`parse_error`)

---

## 8. Review Ownership (V1 = Owner-only)

| Action | สิทธิ์ |
|--------|--------|
| Upload เอกสาร | ทุก user (ที่ล็อกอิน) |
| ดู review queue | ทุก user |
| **Confirm / Correct / Reject** | **Owner เท่านั้น** |
| **Export ไป Sheets** | **Owner เท่านั้น** |
| ตั้งค่า mapping / config | **Owner เท่านั้น** |

- V1 มี role เดียวที่แตะข้อมูลการเงิน = **Owner** (lean, ลดความเสี่ยง)
- โครง role model เผื่อขยาย `finance` role ในอนาคต แต่ **ยังไม่ implement**
- ทุก confirm/export ผูกกับ `user_id` ของ owner ที่กด (ใช้ใน audit)

---

## 9. Audit Trail (กันปัญหาการเงินย้อนหลัง)

เก็บ **ทุก action สำคัญ** แบบ append-only (แก้/ลบไม่ได้):

| ต้องเก็บ | รายละเอียด |
|----------|-----------|
| AI extraction | ค่าที่โมเดลดึง + confidence + raw JSON + model version + timestamp |
| Human correction | field ไหนถูกแก้, ค่าเดิม → ค่าใหม่, ใครแก้, เมื่อไร |
| Confirm | ใคร confirm, เมื่อไร, ค่าที่ confirm (snapshot) |
| Reject | ใคร reject, reason code, เมื่อไร |
| Export | export_key, ปลายทาง (sheet/row), ผล, เมื่อไร, ใครสั่ง |
| State transition | from → to, trigger, timestamp |

- Audit log **append-only** — ไม่มี endpoint แก้/ลบ
- ทุก record มี `actor` (user_id หรือ `system`) + `timestamp` (UTC)
- ตอบคำถามได้เสมอ: *"เอกสารใบนี้ AI ดึงค่าอะไร คนแก้อะไร ใคร export เมื่อไร"*

---

## 10. Google Sheets Export Schema (ล็อกให้ครบ กัน Phase 4 ลื่นไถล)

**รูปแบบ:** **one row per confirmed document** (1 เอกสาร = 1 แถว) บน sheet หลัก
**Raw extraction ไม่ลง Sheets** — เก็บใน DB (audit) เพื่อให้ Sheets สะอาด อ่านง่าย

### Sheet หลัก: `documents` (คอลัมน์ตายตัว ตามลำดับนี้)

| # | Column | มาจาก | หมายเหตุ |
|---|--------|-------|----------|
| A | `export_key` | ข้อ 5 | ใช้กัน duplicate (unique) |
| B | `doc_id` | ระบบ | id ภายใน trace กลับได้ |
| C | `vendor_name` | field | |
| D | `vendor_tax_id` | field | ว่างได้ |
| E | `doc_no` | field | |
| F | `doc_date` | field | `YYYY-MM-DD` (ค.ศ.) |
| G | `subtotal` | field | ตัวเลข 2 ตำแหน่ง |
| H | `vat` | field | |
| I | `grand_total` | field | |
| J | `currency` | field | default THB |
| K | `source` | ระบบ | `upload` (V1), เผื่อ `line`/`whatsapp` |
| L | `confirmed_by` | audit | user_id ของ owner |
| M | `confirmed_at` | audit | timestamp |
| N | `exported_at` | ระบบ | timestamp |

- **Append เท่านั้น** — ไม่แก้แถวเดิม (แก้ = ออกเอกสารใหม่)
- ก่อน append: เช็ค `export_key` ใน column A ว่าไม่ซ้ำ (idempotent)
- Header row ล็อกลำดับตายตัว — schema mismatch → **ไม่ append**, mark `export_failed` (ไม่เขียนข้อมูลเพี้ยน)

---

## 11. File Limits (ล็อกชัด)

| ข้อ | ค่า V1 |
|-----|--------|
| ชนิดไฟล์ที่รับ | **PDF, JPG, JPEG, PNG** (HEIC → แปลงเป็น JPEG ก่อน ถ้าทำได้) |
| ขนาดสูงสุด | **10 MB / ไฟล์** |
| จำนวนหน้า (PDF) | **สูงสุด 5 หน้า** (invoice/receipt ปกติ 1–2 หน้า; เกิน → flag ให้คนดู) |
| 1 ไฟล์ = | **1 เอกสาร** (V1 ยังไม่รองรับหลายใบในไฟล์เดียว) |

- ไฟล์เกิน limit / ชนิดไม่รองรับ → `failed` (`error_category = intake_error`) พร้อมข้อความชัดเจนให้ user

---

## 12. Retry & Failure Policy (ล็อก)

### Retry ต่อเอกสาร
| ประเภท error | Auto-retry | Manual retry |
|--------------|-----------|--------------|
| `ocr_unreadable` (timeout/ชั่วคราว) | 1 ครั้งอัตโนมัติ | Owner กดได้ |
| `export_failed` (Sheets/network) | 2 ครั้ง + exponential backoff | Owner กดได้ |
| `parse_error` | ❌ ไม่ auto | Owner กดได้ (แก้ต้นเหตุก่อน) |
| `intake_error` (ไฟล์เสีย) | ❌ | ต้องอัปโหลดใหม่ |

- **เพดานรวม 3 ครั้ง/ใบ** (auto + manual) แล้วค้างที่ `failed` รอ owner ตัดสิน
- **Manual retry = Owner-only** (สอดคล้องข้อ 8)
- ทุก retry นับ cost ใหม่ + เขียน audit

### พฤติกรรมเมื่อ Google Sheets ล่ม (ล็อก)
1. เอกสารที่ **confirmed แล้ว ห้ามหายเด็ดขาด** — ค่าถูกล็อกใน DB ตั้งแต่ตอน confirm
2. Export fail → state `failed` (`export_failed`) → **auto-retry 2 ครั้ง + backoff**
3. ยังไม่สำเร็จ → ค้าง `failed`, ขึ้นในคิว "รอ export ใหม่", **Owner กด manual retry** ได้
4. Sheets กลับมา → owner retry → append ปกติ (idempotency key กันซ้ำ)

> หลักการ: **confirmed data ไม่มีวันหาย, export เป็นแค่ delivery ที่ retry ได้**

---

## Owner Update (ตาม format ใน spec)

- **สิ่งที่จะทำใน V1:** intake → extract (Claude vision) → validate (กฎไทย) → owner review → export Google Sheets, invoice/receipt เท่านั้น, manual upload ก่อน
- **สิ่งที่ยังไม่ทำใน V1:** LINE/WhatsApp (Phase 5), auto-post บัญชี, auto payment, autonomous agent, finance role, reconciliation, bank matching
- **จุดเสี่ยงที่ตัดสินแล้ว:** stack (Claude vision), review = owner-only, validation ไทยแบบ deterministic, idempotency key, Phase 2 = 90% critical accuracy

## Pass Gate ของ Phase 0

- [ ] Owner อนุมัติ scope และ 12 การตัดสินใจข้างบน
- [ ] ไม่มีจุดกำกวมเรื่อง role / review / confirm-before-write / export path
- [ ] ทีมเข้าใจตรงกันว่า V1 ยังไม่ทำอะไรบ้าง

**เมื่อ owner sign-off เอกสารนี้ → เริ่ม Phase 1 (Intake Foundation) ได้**
