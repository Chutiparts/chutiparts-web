# WIRE Deploy — docbrief Phase 1 (Document Intake)

**Repo:** https://github.com/Chutiparts/chutiparts-web
**Supabase:** `chutiparts-prod` (qaqawfvbaqyznyuuecfp) — migration M1–M7 **รันแล้ว** ✅
**ผู้ deploy:** Owner (Mr.Chuti) · staged files เตรียมไว้ที่ `~/Desktop/CODE/chutiparts-web/`

> ⚠️ **ยังไม่ได้ typecheck / build / lint** — เครื่องนี้ไม่มี Node ต้องรัน `npm run build` ก่อน deploy จริง

---

## 1. ไฟล์ที่เปลี่ยน (3 ไฟล์ · footprint เล็กสุด)

| ไฟล์ | สถานะ | อะไร |
|------|-------|------|
| `lib/docbrief.ts` | 🆕 ใหม่ | validate + sha256 + นับหน้า PDF (**ไม่เพิ่ม dependency**) |
| `app/ops-x7k2m9/documents/page.tsx` | 🆕 ใหม่ | server: `authed()` + `svc()` + upload action + inbox |
| `app/ops-x7k2m9/documents/DocumentsClient.tsx` | 🆕 ใหม่ | UI อัปโหลด + ตาราง inbox |
| `components/OpsShell.tsx` | ✏️ แก้ **1 บรรทัด** | เพิ่มเมนู `📄 เอกสาร` (`ownerOnly: true`) ใต้กลุ่ม "เงิน & สต็อก" |

**ไม่แตะ:** middleware · layout · schema เดิม · โมดูลอื่น · package.json (ไม่มี dependency ใหม่)

---

## 2. Pre-req — ตรวจก่อน deploy

Env vars ที่ต้องมีใน Vercel (ทั้งหมด**มีอยู่แล้ว** เพราะ `ledger` ใช้ชุดเดียวกัน):
```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SECRET_KEY  (หรือ SUPABASE_SERVICE_ROLE_KEY)
ADMIN_OPS_SECRET
```
> ไม่ต้องเพิ่ม env ใหม่เลย

ตรวจ migration ครบ (SQL Editor):
```sql
select table_name from information_schema.tables where table_name like 'doc\_%'
union all select 'TYPE: '||typname from pg_type where typname like 'doc\_%'
union all select 'BUCKET: '||id from storage.buckets where id='doc-originals';
```
ต้องได้ **8 แถว** (4 ตาราง + 3 types + 1 bucket)

---

## 3. ขั้นตอน deploy

```bash
cd ~/Desktop/CODE/chutiparts-web
npm install          # ครั้งแรกเท่านั้น
npm run build        # ⚠️ ต้องผ่านก่อน — ยังไม่เคยรัน
npm run dev          # ทดสอบที่ http://localhost:3000/ops-x7k2m9/documents
```

ถ้า build ผ่าน + ทดสอบ local ผ่าน → commit + push → Vercel deploy อัตโนมัติ

```bash
git checkout -b feat/docbrief-intake
git add lib/docbrief.ts app/ops-x7k2m9/documents components/OpsShell.tsx
git commit -m "feat(docbrief): document intake page (owner-only)"
git push -u origin feat/docbrief-intake
```

---

## 4. QA Checklist (Phase 1 Pass Gate — ต้องผ่านก่อนไป extract)

เปิด `/ops-x7k2m9/documents` (ใส่รหัส owner):

- [ ] **Auth:** เปิดโดยไม่มี cookie → ต้องเจอหน้าใส่รหัส (ไม่ใช่เห็นข้อมูล)
- [ ] **เมนู:** `📄 เอกสาร` โผล่ในเมนูซ้าย · login ด้วย cookie ทีม → **ต้องไม่เห็นเมนูนี้ + เข้า URL ตรงแล้วโดนกัน**
- [ ] อัปโหลด PDF → สถานะ **เข้าคิว**
- [ ] อัปโหลด JPG/PNG → **เข้าคิว**
- [ ] อัปโหลด .txt/.docx → **ไม่ผ่าน** + ข้อความชัด
- [ ] อัปโหลดไฟล์ > 10 MB → **ไม่ผ่าน**
- [ ] อัปโหลด PDF > 5 หน้า → **ไม่ผ่าน** (เช็คว่านับหน้าถูก)
- [ ] อัปโหลด PDF เสีย → **ไม่ผ่าน**
- [ ] อัปโหลดไฟล์เดิมซ้ำ → สถานะ **ซ้ำ** (ต้นฉบับเดิมไม่ถูกเขียนทับ)
- [ ] เช็ค Supabase Storage bucket `doc-originals` → ไฟล์ครบ
- [ ] เช็คตาราง `doc_audit` → มีแถวทุก transition
- [ ] ลองแก้แถวใน `doc_audit` → **ต้อง error** (append-only trigger ทำงาน)
- [ ] เปิดโมดูลอื่น (ledger, daily-brief, parts-desk) → **ทำงานปกติ ไม่พัง**

**Pass Gate:** intake ใช้งานได้จริง + ไม่มี data loss + ไม่กระทบโมดูลเดิม

---

## 5. Rollback

**ระดับโค้ด:** revert commit / ลบ branch → เว็บกลับสภาพเดิม (แตะแค่ 1 บรรทัดใน OpsShell)

**ระดับ DB:** รัน rollback section ท้าย `docbrief-migration-m1-m7.sql`
```sql
drop trigger if exists doc_audit_no_update on doc_audit;
drop function if exists doc_audit_append_only();
drop table if exists doc_metrics, doc_exports, doc_audit, doc_documents;
drop type if exists doc_source, doc_error_category, doc_state;
delete from storage.buckets where id = 'doc-originals';
```
→ core ไม่ถูกแตะต้องเลย กลับสภาพ 100%

---

## 6. หมายเหตุ / ความเสี่ยงที่รู้ตัว

1. **ยังไม่ build/typecheck** — ต้องรัน `npm run build` ก่อน push (เครื่อง dev ไม่มี Node)
2. **Next.js 16** — `AGENTS.md` เตือนว่ามี breaking changes · โค้ดนี้ **ลอก pattern จาก `ledger/page.tsx` ทุกจุด** (server action, `await cookies()`, `force-dynamic`) แทนการเดาจาก docs ที่อ่านไม่ได้
3. **นับหน้า PDF แบบ regex** (ไม่พึ่ง library เพื่อไม่เพิ่ม dependency) — แม่นกับ PDF มาตรฐาน แต่ PDF แปลก ๆ อาจนับพลาด → ถ้าเจอเคสพลาดบ่อย ค่อยพิจารณาเพิ่ม `pdf-lib`
4. **รันบน prod ตรง** (ไม่มี dev/stage) — migration เป็น additive ล้วน ไม่แตะของเดิม + rollback ชัด
5. **ยังไม่ทำ:** extract (Claude vision) · validation ไทย · review queue · export staging · `/internal/documents/summary` → เฟสถัดไป
