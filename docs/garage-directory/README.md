# อู่เบนซ์ทั่วไทย (Benz Garage Directory) — คู่มือ deploy

> โมดูล directory รวมอู่ซ่อมเบนซ์ทั่วไทยบน ChutiBenz · เริ่มที่ **Phase 1 = schema 4 ตาราง**
> spec เต็ม: `chutibenz-benz-garage-directory-spec (1).md`

---

## 🚀 พรุ่งนี้ deploy — ทำแค่ 3 ขั้น

### 1. รัน migration (Supabase SQL Editor)
เปิด **Supabase → SQL Editor → New query** → copy ทั้งไฟล์ `garage-migration-g1.sql` มาวาง → **Run**

- Additive ล้วน · ไม่แตะตารางเดิม · รันซ้ำได้ (idempotent)
- สร้าง 4 ตาราง: `garages` · `garage_services` · `garage_snapshots` · `garage_reviews_meta`

### 2. เช็กว่าตารางขึ้นครบ
รัน query นี้ ควรเห็น 4 แถว:
```sql
select table_name from information_schema.tables
where table_name like 'garage%' order by table_name;
```

### 3. (ทางเลือก) ทดสอบ insert 1 แถว
ในไฟล์ migration มี SEED ChutiBenz แบบ comment ไว้ท้ายไฟล์ — uncomment แล้วรัน จากนั้น:
```sql
select id, name_th, province, status from garages;
```

**เสร็จ Phase 1 ฝั่ง DB แล้ว** ✅

---

## โครงสร้างที่ได้ (สรุป)

| ตาราง | หน้าที่ | key สำคัญ |
|---|---|---|
| **garages** | ข้อมูลอู่ที่จัดรูปแบบแล้ว | `place_id` unique (dedupe) · `slug` unique (URL) · `status` (raw→published) |
| **garage_services** | บริการ/แท็ก (engine/gearbox/brake) | unique (garage_id, service_key) |
| **garage_snapshots** | raw payload จาก Apify (audit) | `source_payload_json` เก็บดิบครบเสมอ |
| **garage_reviews_meta** | rating/เวลาเปิด/รูป (1 แถว/อู่) | PK = garage_id |

**Lifecycle:** `raw → cleaned → reviewed → published → rejected`
(reject_reason: duplicate / not_benz_specialist / missing_contact / unclear_name / other)

> 💡 คอลัมน์ enrichment (`classification`, `description`, `needs_manual_review`) ใส่ไว้แล้วตั้งแต่ G1 — Phase 3 (Claude) จะไม่ต้อง migrate ซ้ำ

---

## ขั้นถัดไป (ยังไม่ต้องทำตอนนี้)

**Phase 1 (ที่เหลือ)** — importer
- รับ Apify dataset (JSON) → เขียนลง `garage_snapshots` ก่อนเสมอ (audit-first)
- normalize (ชื่อ/จังหวัด/เบอร์) → dedupe (place_id → ชื่อ+เบอร์ → ชื่อ+จังหวัด+พิกัด) → upsert เข้า `garages` status='cleaned'

**Phase 2** — หน้าเว็บ (Next.js เดิม)
- `/benz-garages-thailand` (country) · `/benz-garages/[province]` · `/garage/[slug]`
- LocalBusiness JSON-LD (name/address/phone/geo/hours ต้องตรงหน้าเว็บ) · sitemap

**Phase 3** — Claude enrichment + manual review queue + curated pages

---

## แผนต้นทุน (ตามที่ตกลง)
- เริ่ม **Apify Free** (~$5 credit/เดือน) เทส 1–2 จังหวัดก่อน วัดผล/ต้นทุนต่อรอบ
- ขยับ **Starter $29/เดือน** เมื่อต้องรันซ้ำหลายจังหวัด
- **ยังไม่เปิด Claude enrich รอบแรก** — directory ไม่พึ่ง enrich (ชื่อ/เบอร์/พิกัด/rating มาจาก scraper ตรง)
- **ห้าม scrape แล้ว publish ทันที** — คนตรวจคือด่านสำคัญ (กันแบรนด์เสีย)

---

## ⚠️ ก่อนเปิด public
- เช็ก Google Maps ToS สำหรับใช้ข้อมูลเชิงพาณิชย์
- ถ้าจะให้ frontend อ่านตรงด้วย anon key → เปิด RLS + policy `status='published'` (ตัวอย่างอยู่ท้าย migration) · ตอนนี้อ่านผ่าน service-role ฝั่ง server เหมือน doc_* เดิม
- key Apify ตั้งใน Vercel/env ฝั่ง owner เท่านั้น (ห้าม hardcode)

---

---

## ✅ Importer + Admin review (พร้อมใช้ — Phase 1 ที่เหลือ + acceptance "Review")

**หน้าแอดมิน:** `/ops-x7k2m9/garages` (owner login) — หรือเมนู ระบบ → "อู่เบนซ์ (directory)"

**วิธีใช้กับ Apify Free:**
1. รัน Apify Google Maps scraper — query `อู่เบนซ์ + <จังหวัด>` (ตั้ง cap ~50-100/query)
2. ที่ Apify dataset → **Export → JSON** → copy ทั้ง array
3. หน้าแอดมิน → กล่อง "📥 นำเข้าจาก Apify" → วาง JSON → ใส่ป้ายกำกับ → **นำเข้า + ประมวลผล**
   - เก็บ raw ลง `garage_snapshots` อัตโนมัติ (audit-first)
   - normalize (ชื่อ/จังหวัด/เบอร์/พิกัด) + **dedupe ด้วย place_id** (ซ้ำ→อัปเดต last_seen, ใหม่→insert status=cleaned)
   - รองรับ field Apify: `title/name, address, phone, website, totalScore, reviewsCount, location.lat/lng, url, placeId`
4. กรองสถานะ "ล้างแล้ว" → ตรวจแต่ละอู่ (มีธง ⚠ ต้องตรวจ ถ้าข้อมูลไม่ครบ) → กด **✓ เผยแพร่** / **ตัดทิ้ง** (พร้อมเหตุผล) / **ตรวจแล้ว**
5. เฉพาะสถานะ **"เผยแพร่"** เท่านั้นที่ขึ้นเว็บสาธารณะ (RLS)

**logic (มี unit test):** `lib/garage-import.ts` — normalizeApify · dedupeBatch · findDuplicate · detectProvince · slugify (`npm test`)

**ลบ seed ตัวอย่างเมื่อมีข้อมูลจริงพอ:** `delete from garages where source='manual-seed-sample';`

---

*Phase 1 (schema) + Phase 2 (เว็บ) + Importer/Admin เสร็จ · อัปเดต 2026-07-26 · ต่อจาก garage directory spec*
