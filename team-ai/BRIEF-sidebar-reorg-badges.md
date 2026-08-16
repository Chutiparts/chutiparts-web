# BRIEF ส่ง Claude Code — Sidebar reorg + Badges (OpsShell)
เป้า: จัดกลุ่มเมนูใหม่ (section headers) + Voice/รายเดือน placeholder "เร็วๆ นี้" + notification badges · **nav config เท่านั้น · เก็บทุกหน้าเดิม · ไม่รวมหน้าจริง · ไม่แตะ RBAC logic**
แตะ 2 ไฟล์: `components/OpsShell.tsx` + `app/ops-x7k2m9/layout.tsx` · main @ `2cae6b6`

## โครงเมนูใหม่ (map → href + role flag เดิม · ห้ามตกหล่น)
BASE = `/ops-x7k2m9`

**(บนสุด · ไม่มี header)**
- Daily Brief → `/daily-brief` · ownerOnly

**section "ลูกค้า & งาน"**
- Leads & Follow-up → `/parts-desk` · plain · **badgeKey: 'tasks'** (รวม Leads+Tasks · Tasks ไม่เป็นเมนูแยกแล้ว · แท็บอยู่ในหน้า)
- Voice / AI Conversations · **soon (disabled)** · plain

**section "การเงิน"**
- ขายออก → `/sell` · plain
- Ledger → `/ledger` · ownerOnly
- รายเดือน · **soon (disabled)** · ownerOnly
- Landed Cost → `/landed-cost` · ownerOnly

**section "สต็อก & สินค้า"**
- hub "สต็อก & Sourcing":
  - สต็อก → `/stock-source` · ownerOnly · **badgeKey: 'lowstock'**
  - หาของ → `/sourcing` · plain
  - รับเข้าสต็อก → `/stock-intake` · doc  *(ย้ายมาจากกลุ่มเอกสาร)*
- hub "สินค้า":
  - เพิ่มสินค้า → `/add-part` · plain
  - อัพรูป → `/photo` · plain

**section "เอกสาร"**
- hub "เอกสาร":
  - กล่องงาน → `/inbox` · doc
  - บัญชี → `/documents` · doc
  - คลังเอกสาร → `/repository` · doc

**section "ระบบ"**
- ต้นทุน AI → `/doc-metrics` · docOwner  *(ย้ายมาจากเอกสาร)*
- Monitor → `/web-checker` · ownerOnly
- Directory / อู่เบนซ์ → `/garages` · ownerOnly
- ถังขยะ → `/trash` · docOwner  *(ท้ายสุด)*

**เก็บ hidden:** `sync-stock` (hidden:true) — คงไว้ในโค้ด (URL ยังใช้ได้) วางใน hub สต็อกก็ได้ · ไม่ render

## ⚠️ RENDER STYLE (เคาะแล้ว): **Accordion — อย่า flatten**
- **คง accordion เดิม** (hub การเงิน/สต็อก/เอกสาร กด collapse/expand ได้ · เก็บ useState/toggle เดิม) — **ห้ามทำ flat**
- เพิ่มแค่ **section headers** (`.opsx-ghead`) คั่นกลุ่ม 5 กลุ่ม เหนือ items/hubs ในกลุ่มนั้น
- item เดี่ยว (Daily Brief · Leads&FU · Voice · ระบบ items) = link ตรง (ไม่ต้องอยู่ใน hub)
- multi-item groups (สต็อก&Sourcing · สินค้า · เอกสาร) = **hub พับได้ (accordion)**
- placeholder: 🎙️ Voice → section **ลูกค้า&งาน** · 📅 รายเดือน → section **การเงิน** (ไม่ใช่ หลัก/เอกสาร)

## โครงสร้างข้อมูล (แนะนำ refactor)
```
type Item = { href?, label, icon, match?, badgeKey?: string, soon?: boolean,
              doc?, docOwner?, ownerOnly?, hidden? }
type Hub  = { key, label, icon, items: Item[] }
type Section = { header?: string; entries: (Item | Hub)[] }   // entry = link หรือ hub
const SECTIONS: Section[] = [...]   // แทน MAIN/HUBS/SYSTEM เดิม
```
- render: วน SECTIONS → ถ้ามี header โชว์ `.opsx-ghead` → วน entries (Item=link · Hub=accordion เดิม)
- **hide-empty:** section/hub ที่ไม่มี item ที่ผ่าน canSee → ไม่ render header (สำคัญ: doc-staff เห็นเฉพาะเมนู doc → section อื่นต้องหายทั้ง header)
- **soon item:** render เป็น `<div>` เทาๆ กดไม่ได้ + tag "เร็วๆ นี้" (bg #eee/text #999) · ไม่มี href · ยังเช็ก canSee ตาม flag (voice=plain, รายเดือน=ownerOnly)

## Badges (fold in · layout.tsx)
- เพิ่ม prop `badges?: Record<string, number>` เข้า OpsShell
- **layout.tsx (server)** fetch count-only ด้วย `svc()` (`{head:true, count:'exact'}`) · try/catch ต่ออัน · fail→0:
  - `tasks` = ops_tasks ที่ยังเปิด (นิยามเดียวกับ daily-brief `taskOpen` — status ไม่ใช่ done/closed/cancelled)
  - `lowstock` = stock_records `qty<=1 and deleted_at is null` (เดียวกับ daily-brief lowStock)
- render pill ท้าย label เมื่อ `badges[item.badgeKey] > 0`:
  - tasks = amber (bg #FAEEDA / #854F0B) · lowstock = red (bg #FCEBEB / #A32D2D) · radius 999 · 11px · padding 1px 7px
- **hub ปิด** → โชว์ badge รวมของ item ข้างในที่หัว hub (เช่น สต็อก&Sourcing [N])
- mobile BottomNav: dot/เลขเล็กมุม icon (ถ้าง่าย · ไม่ง่าย note ไว้)

## กันพลาด (สำคัญ)
- **nav config เท่านั้น** — ไม่รวมหน้าจริง · ไม่ลบหน้า · ทุก href เดิมต้องยังเข้าถึงได้
- **RBAC เดิมห้ามเปลี่ยน** — ย้าย item ไป section ไหนก็ได้ แต่ role flag (ownerOnly/doc/docOwner) ติดไปกับ item เดิม · canSee logic เดิมห้ามแก้พฤติกรรม
- soon item = กดไม่ได้จริง (ไม่มี href · ไม่ nav) · กัน 404
- badge read-only · count-only · fail→เมนูไม่ล่ม
- active-state highlight ยังทำงาน (item ที่มี href · match logic เดิม)
- mobile BottomNav: ยังต้องมีทุก item ที่ role เห็น (soon item จะใส่หรือไม่ใส่ก็ได้ · ถ้าใส่ = กดไม่ได้)

## Acceptance
1. เมนูจัดกลุ่มตามโครงใหม่ · header 5 กลุ่ม + Daily Brief บนสุด
2. ทุกหน้าเดิมเข้าถึงได้จากเมนู (ยกเว้น sync-stock ที่ hidden เดิม) · ไม่มีลิงก์ตาย ยกเว้น soon (กดไม่ได้ตั้งใจ)
3. Voice + รายเดือน = "เร็วๆ นี้" เทา กดไม่ได้
4. Leads & Follow-up = 1 เมนู → parts-desk · Tasks ไม่เป็นเมนูแยก
5. รับเข้าสต็อก อยู่กลุ่มสต็อก · ต้นทุน AI + ถังขยะ อยู่ระบบ (ถังขยะท้ายสุด)
6. badge: งานค้าง (amber) บน Leads&Follow-up · ใกล้หมด (red) บนสต็อก · เลขตรง daily-brief · =0 ไม่โชว์
7. doc-staff (reviewer/operator/viewer) เห็นเฉพาะเมนู doc + section อื่นหาย header หมด (RBAC เดิม)
8. mobile BottomNav ยังใช้งานได้ · tsc/lint สะอาด · แตะ 2 ไฟล์

## Builder review focus
- RBAC regression (doc-staff / team / owner เห็นถูกไหม · hide-empty section)
- ทุก href เดิมยังอยู่ (ไม่มีหน้าหลุดจากเมนูโดยไม่ตั้งใจ)
- badge: layout perf (รันทุกหน้า · count-only) · นิยามตรง daily-brief · try/catch
- soon item ไม่ nav จริง · active-state ไม่พังกับ item ที่ไม่มี href
