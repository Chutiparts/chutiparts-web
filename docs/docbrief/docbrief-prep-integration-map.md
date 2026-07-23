# docbrief — Prep / Integration Map (ยังไม่ implement)

> งานเตรียมล่วงหน้าที่อนุญาต ตามคำสั่ง: map จุดเสียบ · list ตาราง `doc_*` · migration plan
> **ยังไม่เขียน schema / route / UI จริง** — รอ owner ยืนยัน core repo + Supabase project

---

## 0. สถานะ — ✅ VERIFIED กับ repo จริงแล้ว

- Repo: **https://github.com/Chutiparts/chutiparts-web** (public) → clone ไว้ที่ `CODE/chutiparts-web/`
- ผล verify อยู่ใน **§8** ด้านล่าง — §1–§7 ปรับตามของจริงแล้ว

---

## 1. Route map ของ core (จากเอกสาร)

`/ops-x7k2m9/*` ที่มีอยู่แล้ว (เรียงตามความถี่ที่ถูกอ้างถึง):

```
daily-brief · parts-desk · ledger · stock-source · web-checker · sourcing
profit-guard · settings · finance · brief · landed-cost · leads · risk-guard
crm-retention · businesses · orders · sync-stock · quotes · layout · sync
sell · ebook-stats · search-demand · unauthorized
```

**จุดเสียบใหม่:** `/ops-x7k2m9/documents` ← **ยังไม่มี ไม่ชนของเดิม** ✅

---

## 2. ✅ ธงแดง finance overlap — ปิดแล้ว

Core มี finance stack อยู่แล้ว: `ledger` · `finance` · `landed-cost` · `profit-guard`

**คำตัดสินจาก owner:**
- **V1 จบที่ export ไป staging Sheets / ตาราง staging เท่านั้น**
- ⛔ ไม่เขียนเข้า `ledger` โดยตรง — การลงบัญชีจริงเป็นเฟสถัดไป ผ่าน owner flow ของ core
- docbrief = **ตัวป้อนข้อมูลที่เชื่อถือได้** ไม่ใช่ระบบบัญชีอีกตัว

| ประเด็นที่ยังต้องเคาะ (ไม่ blocking) | หมายเหตุ |
|--------------------------------------|----------|
| **Vendor master** อยู่ตารางไหน | `parts-desk` / `sourcing` / `stock-source` น่าจะมี → ต้องเลือก 1 ตัวเป็น master สำหรับ match `vendor_name` (read-only) — **verify ตอนได้ repo** |
| staging Sheets vs staging table | ใช้ Google Sheets อย่างเดียว หรือมีตาราง `doc_exports` เป็น staging คู่กัน (ตอนนี้ plan ไว้ทั้งคู่: ตารางเก็บ audit/idempotency, Sheets เป็นปลายทางที่ owner เปิดดู) |
| landed-cost | บิลซื้อ vendor เกี่ยวโดยตรง — เฟสหน้าค่อยต่อ (V1 ไม่ write อยู่แล้ว) |

---

## 3. ตาราง `doc_*` ที่ต้องสร้าง (additive ล้วน)

| ตาราง | หน้าที่ | อ้างอิง spec |
|-------|---------|--------------|
| `doc_documents` | inbox + state machine + intake metadata + extracted fields | §2, §3 |
| `doc_audit` | append-only audit ทุก transition / แก้ไข / confirm / export | §9 |
| `doc_exports` | บันทึกการ export + **unique constraint บน `export_key`** | §5, §10 |
| `doc_metrics` | ตัวเลขสรุปสำหรับ `GET /internal/documents/summary` + Phase 2 metrics | §6 |

**หลักการ:**
- ทุกตาราง prefix `doc_` — **ไม่แตะ ไม่ alter ตารางเดิมของ core เลย**
- FK ชี้เข้า core ได้เฉพาะแบบ **soft reference** (เก็บ id เป็น text/uuid ธรรมดา ไม่ผูก FK constraint ข้ามระบบ) → ถอดออกได้ ไม่ทำ core พัง
- Enum: ใช้ prefix เช่น `doc_state`, `doc_error_category` กัน type ชนกับของเดิม

---

## 4. Migration plan (ไม่แตะ schema เดิม)

```
M1  สร้าง enum: doc_state, doc_error_category, doc_source
M2  สร้างตาราง doc_documents (+ index: file_hash, state, created_at)
M3  สร้างตาราง doc_audit    (append-only; ไม่มี UPDATE/DELETE policy)
M4  สร้างตาราง doc_exports  (unique constraint บน export_key)
M5  สร้างตาราง doc_metrics
M6  สร้าง storage bucket "documents" (private) + RLS
M7  RLS policy: owner-only ทั้ง 4 ตาราง (อิง role เดิม OWNER/TEAM ของ core)
```

**กฎ:**
- **Additive only** — ไม่มี `ALTER`/`DROP` บนของเดิมแม้แต่บรรทัดเดียว
- **Rollback = drop เฉพาะ `doc_*` + bucket** → core กลับสภาพเดิม 100%
- รันบน **dev/stage ก่อน** เสมอ แล้วค่อย prod (รอยืนยัน environment)

---

## 5. จุดเสียบ UI (รอ verify กับ repo จริง)

| สิ่งที่ต้องหาใน repo core | ใช้ทำอะไร |
|---------------------------|-----------|
| component `OpsShell` (หรือชื่อจริงของ layout) | ครอบหน้า `/ops-x7k2m9/documents` |
| auth middleware / guard ของ `/ops-x7k2m9/*` | ใช้ guard เดิม ไม่เขียนใหม่ |
| ที่นิยาม nav items + การแยก owner-admin vs team | เพิ่ม **1 เมนู** ในกลุ่ม owner เท่านั้น |
| Supabase client ที่ core ใช้ (server/browser) | reuse ไม่สร้าง client ใหม่ |
| หน้า `unauthorized` | redirect ปลายทางเมื่อ role ไม่ผ่าน |

---

## 6. โค้ดเดิมใน `CODE/docbrief/` — ใช้ต่อ / ทิ้ง

| ไฟล์ | สถานะ |
|------|-------|
| `src/domain/states.ts` | ✅ ใช้ต่อ (rename enum เป็น `doc_*`) |
| `src/lib/validation.ts` · `hash.ts` · `pdf.ts` · `config.ts` | ✅ ใช้ต่อได้เลย |
| `src/lib/intake.ts` | 🔧 คงตรรกะ เปลี่ยน client เป็น Supabase |
| `src/lib/audit.ts` | 🔧 คงโครง เปลี่ยนปลายทางเป็น `doc_audit` |
| `tests/*` | ✅ ใช้ต่อ (logic tests ไม่ผูก infra) |
| `src/db/*` · `drizzle.config.ts` · `docker-compose.yml` | ❌ ทิ้ง |
| `src/lib/storage/local.ts` | ❌ ทิ้ง → Supabase Storage |
| `src/app/*` | ❌ ทิ้ง → ย้ายเข้า `/ops-x7k2m9/documents` ของ core |

---

## 7. ยังรอ owner (blocking)

1. ~~Core repo GitHub URL~~ ✅ ได้แล้ว
2. **Supabase project + environment** (dev/stage/prod) + สิทธิ์เข้าถึง → **ยัง block อยู่**
3. ~~ธงแดง ledger/finance~~ ✅ ปิดแล้ว (staging only)

---

## 8. ผล VERIFY จาก repo จริง

### 8.1 Stack (ยืนยัน)
| | ของจริง |
|---|---|
| Framework | **Next.js 16.2.4** · React 19.2.4 · TypeScript |
| Supabase | `@supabase/ssr` ^0.10.2 · `@supabase/supabase-js` ^2.105.1 |
| Deploy | Vercel (`vercel.json`) |
| Client helpers | `utils/supabase/client.ts` · `utils/supabase/server.ts` |

> ⚠️ **`AGENTS.md` ของ repo เตือนไว้:** *"This is NOT the Next.js you know"* — Next 16 มี breaking changes **ต้องอ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด** (เพิ่มเป็นขั้นบังคับก่อน implement)

### 8.2 Route / จุดเสียบ
- `app/ops-x7k2m9/` มี 22 โฟลเดอร์ + `layout.tsx`
- **`documents/` ยังว่าง ไม่ชนของเดิม** ✅ → สร้าง `app/ops-x7k2m9/documents/page.tsx`

### 8.3 Auth — ⚠️ สำคัญมาก อ่านก่อน implement
`middleware.ts` (matcher `/ops-x7k2m9/:path*`):
```ts
TEAM_ALLOWED = [parts-desk, sync-stock, sourcing, sell, unauthorized]
isOwner = cookie 'ops_admin'  === ADMIN_OPS_SECRET
isTeam  = cookie 'ops_team'   === TEAM_OPS_SECRET
if (isTeam && !allowed) → redirect /unauthorized
```

**ผลต่อ docbrief:**
- ✅ **ไม่ต้องแก้ middleware เลย** — path ใหม่ไม่อยู่ใน `TEAM_ALLOWED` → team ถูกกันอัตโนมัติ = owner-only ตามสเปก
- 🔴 **แต่ middleware ไม่กันคนที่ไม่มี cookie เลย** (isOwner=false, isTeam=false → ผ่าน) → **การป้องกันจริงอยู่ที่ระดับ page**
- ➜ **หน้า documents ต้องมี `authed()` ของตัวเอง** ตาม pattern เดิม ห้ามพึ่ง middleware อย่างเดียว (เอกสารการเงินหลุดไม่ได้)

### 8.4 Page pattern ที่ต้องลอก (จาก `ledger/page.tsx`)
```ts
export const dynamic = 'force-dynamic'
const COOKIE = 'ops_admin'
function svc() {            // service-role client
  createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY,
               { auth: { persistSession: false } })
}
async function authed() {   // owner gate
  (await cookies()).get(COOKIE)?.value === process.env.ADMIN_OPS_SECRET
}
async function loginOps(fd) { 'use server'; /* set httpOnly cookie 30d */ }
// ทุก server action ขึ้นต้นด้วย: if (!(await authed())) return
```
**Env ที่ต้องมี:** `NEXT_PUBLIC_SUPABASE_URL` · `SUPABASE_SECRET_KEY` (หรือ `SUPABASE_SERVICE_ROLE_KEY`) · `ADMIN_OPS_SECRET` · `TEAM_OPS_SECRET`

### 8.5 เมนู (1 อัน)
`components/OpsShell.tsx` → array `ITEMS` มี type รองรับอยู่แล้ว:
```ts
type Item = { href, label, icon, match?, ownerOnly?: boolean }
```
➜ เพิ่ม **1 บรรทัด**: `{ href: `${BASE}/documents`, label: 'เอกสาร', icon: '📄', ownerOnly: true }`
(รูปแบบเดียวกับ Ledger / Landed Cost / Daily Brief ที่เป็น `ownerOnly: true`)

### 8.6 Vendor master — ยังไม่มีตาราง vendor จริง
- ไม่พบตาราง vendor แยก · `ledger` เก็บ **`source` (แหล่งซื้อ) เป็น free text** ใน stock record
- ➜ **ตัวเลือก:** ใช้ `DISTINCT source` จาก stock records เป็น autocomplete (read-only) ใน review
- ➜ **ไม่ blocking** แต่ต้องเคาะตอน implement · **ห้ามสร้างตาราง vendor ใหม่** (ผิดหลักไม่ทำซ้ำ)

### 8.7 ข้อจำกัดเครื่อง dev
เครื่องนี้ **ไม่มี Node/npm** → รัน `npm install` / dev server / อ่าน `node_modules/next/dist/docs/` **ไม่ได้** จนกว่าจะติดตั้ง Node
