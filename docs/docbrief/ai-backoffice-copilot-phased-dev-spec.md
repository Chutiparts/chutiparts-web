# WIRE — AI Backoffice Copilot for SME

เอกสารนี้ใช้เป็นคำสั่งงานสำหรับทีมพัฒนา โดยให้พัฒนาแบบแยกเป็นหลาย Phase อย่างชัดเจน, มีอัปเดตทุก Phase, ตรวจรับเป็นด่าน, และ deploy เมื่อผ่านเกณฑ์ที่กำหนดแล้วเท่านั้น

## เป้าหมาย

สร้างระบบ **AI Backoffice Copilot for SME** แบบ Lean ที่เริ่มจาก **Smart Document Intake** ก่อน โดยรอบแรกต้องจบ flow หลักให้แน่น:

รับเอกสาร -> ดึงข้อมูล -> ตรวจทาน -> ยืนยัน -> ส่งออก

ห้ามกระโดดไปทำ Agent เต็มรูปแบบ, ห้ามทำเมนูใหม่เกินจำเป็น, และห้ามให้ระบบเขียนข้อมูลสำคัญเองโดยไม่มีการยืนยันจากมนุษย์

## หลักการบังคับใช้

- พัฒนาแบบ **Phase-by-Phase** เท่านั้น
- ทุก Phase ต้องมี:
  - Scope ชัดเจน
  - Deliverables ชัดเจน
  - Acceptance Criteria ชัดเจน
  - QA Evidence
  - Owner Update
  - Pass / Not Pass
- ถ้า Phase ยังไม่ผ่าน **ห้ามไป Phase ถัดไป**
- Deploy ให้ทำเมื่อ Phase ที่กำหนดผ่านครบ และมี rollback / monitoring พร้อม
- หลักการสำคัญของระบบ:
  - Confirm-before-write
  - Owner approval สำหรับ action เสี่ยง
  - Audit log ทุก action สำคัญ
  - Lean UI / ไม่เพิ่มเมนูเกินจำเป็น
  - Rate limiting / cost control

## ขอบเขต V1

V1 ให้โฟกัสเฉพาะ **Module 1: Smart Document Intake**

- ช่องทางเข้า: manual upload ก่อน, จากนั้นค่อย LINE OA / WhatsApp
- ประเภทเอกสาร: เริ่ม 1–2 แบบเท่านั้น (invoice / receipt)
- ปลายทาง: Google Sheets ก่อน
- ยังไม่ทำ auto-post เข้าระบบบัญชี
- ยังไม่ทำ auto payment
- ยังไม่ทำ autonomous agent

## ลำดับการพัฒนา

## Phase 0 — Spec Lock

### เป้าหมาย
ล็อก scope ให้ตรงกันก่อนเริ่ม build

### Deliverables
- PRD ย่อ
- workflow diagram
- database schema draft
- API list
- role/access rules
- acceptance criteria ราย phase

### Acceptance Criteria
- Scope ตรงกันทั้งทีม
- ไม่มีจุดกำกวมเรื่อง role, review, confirm-before-write, export path
- รู้ชัดว่า V1 ยังไม่ทำอะไรบ้าง

### Owner Update ที่ต้องส่ง
- สิ่งที่จะทำใน V1
- สิ่งที่ยังไม่ทำใน V1
- จุดเสี่ยงที่ต้องตัดสินใจก่อน build

### Pass Gate
- Owner อนุมัติ scope
- เอกสารครบ

---

## Phase 1 — Intake Foundation

### เป้าหมาย
รับไฟล์เข้าและเก็บต้นฉบับได้เสถียร

### Deliverables
- manual upload endpoint / UI
- `document_inbox`
- file storage
- queued status
- duplicate file hash เบื้องต้น

### Acceptance Criteria
- รับไฟล์ PDF / image ได้
- เก็บ original file ได้ครบ
- สร้าง record ใน inbox ได้ทุกครั้ง
- state เริ่มต้นถูกต้อง
- ยังไม่มี write ไปปลายทางอื่น

### QA
- ทดสอบอัปโหลดไฟล์หลายชนิด
- ทดสอบไฟล์เสีย / ไฟล์ซ้ำ / ไฟล์ใหญ่
- ตรวจว่า original file ไม่หาย

### Owner Update ที่ต้องส่ง
- รับไฟล์ได้กี่ประเภท
- error ที่เจอ
- ข้อจำกัดที่ยังมี

### Pass Gate
- Intake ใช้งานได้จริง
- ไม่มี data loss

---

## Phase 2 — Extraction Core

### เป้าหมาย
ดึง field หลักจากเอกสารเป้าหมาย 1 แบบให้ได้ก่อน

### Deliverables
- OCR / parser flow
- raw extraction JSON
- confidence score ราย field
- field mapping ชุดแรก

### Field ขั้นต่ำ
- vendor_name
- tax_id
- doc_no
- doc_date
- subtotal
- vat
- grand_total
- currency

### Acceptance Criteria
- field ขั้นต่ำออกครบในเอกสารทดสอบส่วนใหญ่
- มี confidence score
- เก็บ raw extraction ได้
- debug ได้ว่า field มาจากไหน

### QA
- test set อย่างน้อย 20 เอกสารจริง
- รายงาน field accuracy
- รายงานเอกสารที่ parse ไม่ได้
- รายงาน cost ต่อเอกสาร

### Owner Update ที่ต้องส่ง
- field ไหนแม่น / ไม่แม่น
- เอกสารแบบไหนพัง
- ต้นทุนต่อไฟล์

### Pass Gate
- extraction ใช้งานต่อได้จริง
- ไม่มี hallucinated export

---

## Phase 3 — Validation & Review Queue

### เป้าหมาย
แยกเอกสารที่มั่นใจออกจากเอกสารที่คนต้องตรวจ

### Deliverables
- validation rules
- `needs_review`
- review queue UI
- confirm / correct / reject actions
- reason codes

### Validation ขั้นต่ำ
- subtotal + vat = total
- total > 0
- วันที่ไม่เกินอนาคต
- tax_id format ถูก
- duplicate risk check

### Acceptance Criteria
- confidence ต่ำใน field สำคัญ ต้องเข้า review
- duplicate risk ต้องถูก flag
- reviewer กดยืนยัน / แก้ไข / ปฏิเสธได้
- ยังไม่มี auto-export

### QA
- ทดสอบ low-confidence docs
- ทดสอบ duplicate docs
- ทดสอบ correction flow
- ทดสอบ reject flow

### Owner Update ที่ต้องส่ง
- กี่ไฟล์เข้า review
- reason code หลักคืออะไร
- field ไหนคนแก้บ่อย

### Pass Gate
- review flow ใช้งานได้จริง
- ไม่มีเอกสารเสี่ยงหลุดไป export เอง

---

## Phase 4 — Export Foundation

### เป้าหมาย
ส่งออกไป Google Sheets อย่างปลอดภัย

### Deliverables
- export service
- schema validation
- mapping config
- export status / retry
- audit log

### Acceptance Criteria
- export ได้หลัง confirm เท่านั้น
- schema mismatch ไม่ทำให้ข้อมูลพัง
- export result trace back ได้
- append row ไม่ซ้ำโดยไม่มีเหตุผล

### QA
- test export success
- test export fail
- test schema mismatch
- test duplicate export protection

### Owner Update ที่ต้องส่ง
- append สำเร็จเท่าไร
- fail เพราะอะไร
- mapping จุดไหนต้องแก้

### Pass Gate
- export เชื่อถือได้
- audit ดูย้อนหลังได้ครบ

---

## Phase 5 — LINE OA / WhatsApp Integration

### เป้าหมาย
รับเอกสารผ่านแชตโดยใช้ flow เดิม

### Deliverables
- webhook receiver
- channel auth
- file normalization
- source tagging

### Acceptance Criteria
- ส่งไฟล์จากแชตเข้าระบบได้จริง
- state machine เดิมยังทำงานครบ
- แยก source ได้ถูกต้อง
- auth ปลอดภัย

### QA
- test message with image
- test message with PDF
- test missing file
- test bad webhook / unauthorized access

### Owner Update ที่ต้องส่ง
- channel stability
- ปัญหา format ไฟล์
- latency โดยเฉลี่ย

### Pass Gate
- ใช้งานผ่านแชตได้จริง
- ไม่มี security hole พื้นฐาน

---

## Phase 6 — Pilot QA

### เป้าหมาย
ทดสอบกับเคสจริงและวัดผล

### Deliverables
- pilot กับเอกสารจริง 20–50 ใบ
- before/after timing
- correction log
- issue list
- owner feedback

### Acceptance Criteria
- ลดเวลาคีย์งานได้จริง
- flow ไม่งงสำหรับผู้ใช้
- ไม่มี bug สำคัญด้านข้อมูลการเงิน
- owner ใช้งานแล้วโอเค

### Owner Update ที่ต้องส่ง
- เวลาที่ลดได้
- จุดที่ยังติดขัด
- เอกสารแบบไหนยัง fail
- ควรแก้ก่อน deploy อะไรบ้าง

### Pass Gate
- owner sign-off
- bug สำคัญถูกปิด

---

## Phase 7 — Deploy

### เป้าหมาย
ขึ้น production อย่างมีแผน ไม่ใช่ deploy แบบเสี่ยง

### Deliverables
- production config
- secrets check
- rollback plan
- monitoring / alerting
- unauthorized test results
- deployment checklist

### Acceptance Criteria
- env ถูกต้อง
- rollback ได้
- monitoring เห็น error สำคัญ
- unauthorized routes ถูกบล็อก
- audit log ทำงานจริงใน prod

### QA
- smoke test หลัง deploy
- role access test
- upload / extract / review / export end-to-end
- fail case test

### Pass Gate
- owner อนุมัติ deploy
- production smoke test ผ่าน

---

## กติกาอัปเดตทุก Phase

ทุกครั้งที่ส่งอัปเดต ให้ใช้ format เดียวกัน:

### Phase Update
- Phase:
- Status: PASS / NOT PASS / BLOCKED
- Done:
- Not done:
- QA evidence:
- Risks / blockers:
- Owner decision needed:
- Next step if pass:

ห้ามส่งอัปเดตแบบกว้าง ๆ หรือเล่าว่า “เกือบเสร็จ” โดยไม่มีหลักฐาน

## Guardrails ฝั่งระบบ

- Confirm-before-write เสมอ
- Action สำคัญต้องมี human review
- Owner-only สำหรับ write ที่กระทบข้อมูลการเงินหรือปลายทางสำคัญ
- ทุก action สำคัญต้องมี audit log
- ต้องมี rate limiting
- ต้องมี cost control / ไม่เรียก model เกินจำเป็น
- ห้ามเพิ่มเมนูใหม่ถ้ายังใช้ flow เดิมได้
- ห้าม deploy ถ้า phase ปัจจุบันยัง not pass

## สิ่งที่ยังไม่ทำใน V1

- Reconciliation เต็มรูปแบบ
- Bank statement matching
- Auto payment / embedded finance
- Autonomous claim agent
- Tax optimization copilot
- Predictive cashflow engine
- Multi-agent workflow
- Full accounting integration หลายเจ้า

สิ่งเหล่านี้ค่อยพิจารณาหลังจาก V1 intake/review/export เสถียรและ pilot ผ่านแล้ว

## คำสั่งสรุปสำหรับทีม dev

ให้พัฒนาระบบนี้แบบ phased delivery เท่านั้น โดยทุก phase ต้องมี scope, deliverables, acceptance criteria, QA evidence, owner update, และ pass gate ที่ชัดเจน ถ้า phase ใดยังไม่ผ่านห้ามข้ามไป phase ถัดไป และ deploy ให้ทำเมื่อ phase ที่กำหนดผ่านครบพร้อม rollback/monitoring เท่านั้น
