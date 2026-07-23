> ⚠️ **SUPERSEDED** — ยุบเข้า `docbrief-final-spec-v1.md` แล้ว ใช้ไฟล์นั้นเป็นหลัก

# Phase 0 Addendum — Shared Core Integration

> **แก้ทิศจากเดิม:** เดิม Decision Doc วางเป็น standalone app + Postgres ของตัวเอง
> **ใหม่:** Backoffice Copilot = **product แยกบน shared core เดียวกับ AI OpsBrief OS** เชื่อมแบบ lean, read-only ก่อน
> **เป้า:** เล็กพริกขี้หนู ไม่ใช่ใหญ่แต่ซ้ำ — **ห้าม rebuild สิ่งที่ OpsBrief OS มีแล้ว**
> Addendum นี้ **override** ข้อ 1 (Tech stack) ของ `phase-0-decision-doc.md` ส่วนข้อ 2–12 (state machine, validation ไทย, idempotency, metrics, audit ฯลฯ) **ยังใช้เหมือนเดิมทั้งหมด**

---

## A1. เส้นแบ่ง product (สำคัญที่สุด)

| ความสามารถ | เจ้าของ | Copilot ทำไหม |
|------------|---------|---------------|
| Lead intake / AI Lead Desk | **OpsBrief OS** | ❌ ห้ามทำซ้ำ |
| Follow-up Control (สถานะ/next action/due) | **OpsBrief OS** | ❌ |
| Daily Brief | **OpsBrief OS** | ❌ (แค่ส่งตัวเลขให้) |
| Auth / role / owner login | **shared core** | ❌ ใช้ของเดิม |
| Admin UI shell + nav | **shared core** | ❌ ไม่สร้างแอปใหม่ |
| File storage | **shared core** (Supabase Storage) | ❌ ใช้ของเดิม |
| **Document intake (อัปโหลดบิล/ใบเสร็จ)** | **Copilot** | ✅ ใหม่ |
| **Claude vision extraction** | **Copilot** | ✅ ใหม่ |
| **Validation ไทย (VAT/tax_id/date)** | **Copilot** | ✅ ใหม่ |
| **Review queue + confirm** | **Copilot** | ✅ ใหม่ |
| **Export Google Sheets + idempotency** | **Copilot** | ✅ ใหม่ |

> Copilot มีเหตุผลดำรงอยู่แค่ **"เอกสารการเงินเข้า → ข้อมูลออกที่เชื่อถือได้"** เท่านั้น อย่างอื่นเป็นของ core

---

## A2. Tech stack (แทนที่ §1 เดิม)

| Layer | เดิม (ยกเลิก) | ใหม่ |
|-------|--------------|------|
| DB | ❌ Postgres แยก + docker-compose | ✅ **Supabase เดิม** (ตารางใหม่ prefix `doc_`) |
| Auth | ❌ สร้างเอง | ✅ **auth เดิมของ core** |
| Storage | ❌ local FS adapter | ✅ **Supabase Storage** (bucket ใหม่ `documents`) |
| UI | ❌ แอป Next.js แยก | ✅ **เพิ่ม 1 หน้าในแอดมินเดิม** |
| Extraction | Claude vision | ✅ **คงเดิม** |

**ห้ามสร้าง:** DB instance ใหม่, ระบบ login ใหม่, เมนูใหม่หลายอัน, docker-compose, dashboard ซ้ำกับ Daily Brief

---

## A3. UI — เพิ่มน้อยที่สุด

- เพิ่ม **หน้าเดียว** ในแอดมินเดิม: `/ops-x7k2m9/documents`
- ในหน้านั้นมี 2 แท็บเท่านั้น: **อัปโหลด** · **รอตรวจ (pending_review)**
- **ห้ามเพิ่ม nav item เกิน 1 อัน** (ยึด Lean 8 + §"ห้ามเพิ่มเมนูเกินจำเป็น")

---

## A4. สัญญาการเชื่อมต่อ (Integration Contract) — read-only ก่อน

### ทิศทางที่ 1: Copilot → อ่านจาก core (read-only) ✅ ทำใน V1
- Copilot **อ่านอย่างเดียว** ไม่เขียนลงตารางของ core เด็ดขาด
- ใช้ทำอะไร: ดึงรายชื่อ vendor/คู่ค้าที่มีอยู่ มาช่วย match `vendor_name` ตอน review (ลดการพิมพ์ซ้ำ)
- วิธี: **read-only view** หรือ internal API `GET /internal/vendors` — ไม่แตะตารางต้นทางโดยตรง

### ทิศทางที่ 2: core → อ่านสรุปจาก Copilot ✅ ทำใน V1 (read-only เช่นกัน)
- Daily Brief ของ OpsBrief ดึงตัวเลข 1 บรรทัดจาก Copilot:
  ```
  GET /internal/documents/summary
  → { pending_review: 4, failed: 1, exported_today: 12 }
  ```
- **Copilot ไม่ push/เขียนอะไรเข้า core** — core เป็นฝ่ายมาอ่านเอง (pull)

### ทิศทางที่ 3: Event / write กลับเข้า core ⛔ **ยังไม่ทำใน V1**
- เช่น สร้าง follow-up task อัตโนมัติเมื่อเอกสารค้าง, เขียนยอดเข้า ledger ของ core
- เลื่อนไป **หลัง** V1 พิสูจน์แล้ว (สอดคล้องหลัก confirm-before-write + ไม่รีบ coupling)

> **กฎ:** V1 ทุกการเชื่อมต่อเป็น **read-only ทั้งสองทาง** — ผูกกันหลวม ๆ ถอดออกได้ ไม่พังกันเวลาแก้

---

## A5. Data model บน shared core

- ตารางใหม่ทั้งหมด **prefix `doc_`** เพื่อไม่ชนของเดิม:
  - `doc_documents` (inbox — state machine §2 เดิม)
  - `doc_audit_log` (append-only §9 เดิม)
  - `doc_exports` (idempotency key §5 เดิม, unique constraint)
- **ห้ามแก้ schema ตารางเดิมของ core** (`contact_leads` ฯลฯ) — additive only, ย้อนกลับได้

---

## A6. ชื่อ product (แก้ collision)

- ❌ ชื่อเดิมที่ผมตั้ง `wire` **ชนกับคำว่า "WIRE deploy"** ที่ระบบคุณใช้เรียกเอกสาร deploy handoff อยู่แล้ว
- ✅ เสนอชื่อใหม่: **`docbrief`** (เข้าชุดกับ OpsBrief) หรือ `doc-intake` / `ops-docs`
- repo/โฟลเดอร์เดิม `CODE/wire/` ต้องเปลี่ยนชื่อตาม

---

## A7. ผลกระทบต่อโค้ดที่ทำไปแล้ว (`CODE/wire/`)

| ส่วน | สถานะ |
|------|-------|
| `src/domain/states.ts` (state machine) | ✅ **ใช้ต่อได้เลย** |
| `src/lib/validation.ts`, `hash.ts`, `pdf.ts`, `config.ts` | ✅ **ใช้ต่อได้เลย** |
| `src/lib/intake.ts` (flow) | 🔧 คงตรรกะ เปลี่ยน DB/storage client |
| `src/db/*` (Drizzle + Postgres แยก) | 🔄 **เปลี่ยนเป็น Supabase client** |
| `src/lib/storage/local.ts` | 🔄 **เปลี่ยนเป็น Supabase Storage** |
| `docker-compose.yml`, `drizzle.config.ts` | ❌ **ลบ** |
| `src/app/*` (แอปแยก + UI) | 🔄 **ย้ายไปเป็น 1 หน้าในแอดมินเดิม** |

> ประมาณ **60% ของโค้ดที่เขียนไปใช้ต่อได้** (logic แกน) ส่วนที่ทิ้งคือ infra ที่ซ้ำกับ core

---

## สิ่งที่ต้องรู้ก่อนลงมือต่อ (รอ owner ยืนยัน)

1. **repo ของ core** อยู่ไหน (GitHub URL) — ต้อง clone ล่าสุดก่อนแก้ ตามกฎใน CLAUDE.md
2. **Supabase project** — ใช้ตัวเดิมของ OpsBrief ใช่ไหม
3. **ชื่อ product ใหม่** — เอา `docbrief` ไหม
4. เอกสารการเงินที่จะเข้าระบบ เป็น **บิลซื้อจาก vendor** (ต้นทุนร้าน) ใช่ไหม
