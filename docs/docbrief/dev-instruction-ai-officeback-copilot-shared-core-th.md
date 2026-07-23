# DEV INSTRUCTION — AI Officeback Copilot SMEs (Shared Core with AI OpsBrief OS)

## เป้าหมาย
ให้ทีม dev พัฒนา `AI Officeback Copilot SMEs` โดย **ใช้ฐานเดียวกับ AI OpsBrief OS ที่มีอยู่แล้ว** และรักษาแนวทาง **Lean / ไม่บวม / ไม่มั่ว** อย่างเคร่งครัด

## ข้อบังคับหลัก
1. **ต้องใช้ backend / auth / storage / deployment base เดียวกับ AI OpsBrief OS**
2. ห้ามสร้างระบบคู่ขนานใหม่ เช่น Postgres ใหม่, Docker stack ใหม่, local storage stack ใหม่, auth ใหม่, หรือ admin panel ใหม่ ถ้ายังไม่จำเป็นจริง
3. แบรนดิ้งและหน้า UI แยกได้ แต่ **core capabilities ต้องแชร์ของเดิม**
4. Scope ของ V1 ต้องแคบและชัด: ทำเฉพาะสิ่งที่จำเป็นต่อการใช้งานจริง

## Scope ของ V1
V1 ของ AI Officeback Copilot SMEs ให้จำกัดอยู่ที่:
- document intake
- extraction
- validation
- review / escalate
- Google Sheets export

Google Sheets ให้ถือเป็น **final destination** ของ workflow ใน V1

## สิ่งที่ห้ามทำใน V1
- ห้ามทำระบบบัญชีใหม่
- ห้ามทำ mini ERP
- ห้ามทำ dashboard ใหม่ที่ซ้ำกับ OpsBrief OS
- ห้ามย้ายหรือแยก auth ออกจากระบบหลัก
- ห้ามสร้าง storage layer ใหม่
- ห้ามเพิ่ม flow เกินจากงานเอกสารหลัก
- ห้ามเพิ่ม feature เพราะ "เผื่อไว้ก่อน"

## หลักสถาปัตยกรรม
ใช้แนวคิด **Lean Engine v1**:
1. Receive
2. Parse
3. Validate
4. Commit
5. Escalate

และจัดระบบให้เป็น 3 lanes:
- Intake
- Decision
- Outcome

หลักการคือ **ทางเดียวหลัก** ไม่มี branching ซับซ้อนเกินจำเป็น

## ขอบเขตข้อมูลและโครงสร้าง
- ใช้ Supabase project เดิมของระบบหลัก
- ใช้ auth และ storage เดิม
- ถ้าจำเป็นต้องมี table/function/bucket ใหม่ ให้ตั้งชื่อด้วย `doc_` prefix เพื่อแยกขอบเขตงาน document ให้ชัด
- ห้ามแตะ schema หลักเกินความจำเป็น
- ต้องออกแบบ rollback path ให้ชัดทั้งฝั่ง code และ DB

## Security / Secrets
- Owner จะเป็นผู้รัน SQL เองใน Supabase SQL Editor
- ห้ามขอ secret หรือ key ผ่าน chat
- key ทั้งหมดต้องอยู่ใน Vercel / environment ของระบบหลัก หรือ `.env.local` ฝั่ง owner เท่านั้น
- ห้าม hardcode secret ใด ๆ ลง repo

## Guardrails ด้านผลิตภัณฑ์
ทุกงานใหม่ต้องตอบให้ได้ก่อนว่า:
1. ช่วยลดงานคีย์มือจริงหรือไม่
2. ช่วยลดเงินรั่วหรือความผิดพลาดจริงหรือไม่
3. ผู้ใช้ต้องเรียนรู้อะไรใหม่หรือไม่
4. ถ้าไม่ทำตอนนี้ V1 ยังใช้งานจริงได้หรือไม่

ถ้าตอบไม่ได้ชัด ให้ **ยังไม่ทำ**

## UX Principle
- ผู้ใช้ต้องรู้สึกว่าเป็นระบบที่คุ้นเคย ไม่ใช่ซอฟต์แวร์ใหม่ที่ต้องฝึกเยอะ
- ใช้สิ่งที่ลูกค้าคุ้นเคยอยู่แล้วเป็นหลัก เช่น LINE / Google Sheets / shell เดิมของระบบ
- ห้ามเพิ่มเมนูหรือขั้นตอนจนทำให้ flow หนักเกินจำเป็น

## Engineering Principle
- โค้ดต้องสั้น อ่านง่าย debug ง่าย rollback ง่าย
- ใช้ pattern ที่มีอยู่แล้วใน repo เป็นหลัก แทนการเดา implementation ใหม่
- ต้อง build / typecheck / QA ให้ผ่านก่อน push
- ถ้ามี Next.js compatibility issue ให้แก้แบบ conservative และไม่ ripple ไปทั้งระบบ

## Definition of Done
V1 ถือว่าเสร็จเมื่อ:
- ใช้ core เดิมร่วมกับ AI OpsBrief OS ได้จริง
- ไม่มี infra ซ้ำซ้อน
- document flow หลักทำงานได้จริงตั้งแต่ intake ถึง Google Sheets
- anomaly / confidence ต่ำไม่ถูก commit อัตโนมัติ
- owner review ได้ในจุดที่จำเป็น
- ไม่มี feature บวมเกินจาก scope นี้

## ประโยคสั่งงานสั้นสำหรับทีม
> ให้สร้าง AI Officeback Copilot SMEs บนฐานเดียวกับ AI OpsBrief OS ที่มีอยู่แล้ว ใช้ auth/storage/backend เดิม, จำกัด V1 แค่ document intake → extraction → validation → review/escalate → Google Sheets export, ห้ามสร้าง infra ใหม่ ห้ามทำ mini ERP ห้ามทำ dashboard ซ้ำ และห้ามเพิ่ม feature ที่ไม่จำเป็นต่อการใช้งานจริง
