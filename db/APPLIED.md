# APPLIED — ไฟล์ SQL ไหนรันบนโปรดักชันไปแล้วบ้าง

โปรดักชัน = Supabase project `qaqawfvbaqyznyuuecfp`
(staging เก่า `gccytdbydtmsqzvoibcz` **ไม่ใช่ตัวนี้** — `chutiparts-web/.env.local` ชี้ไปตัวเก่า)

> **ทำไมต้องมีไฟล์นี้:** ไฟล์ `.sql` ในโฟลเดอร์นี้ไม่ได้บอกตัวเองว่ารันไปหรือยัง
> 2026-08-22 พบว่า `20260821_leads_anon_lockdown.sql` เขียนหัวไฟล์ว่า "ยังไม่ได้ apply ‼️"
> ค้างไว้ ทั้งที่วัดของจริงแล้วรันไปแล้ว — และไฟล์นั้นยัง **untracked** ไม่เคยเข้า git ด้วย
>
> **กฎ:** รัน `.sql` บนโปรดักชันเมื่อไหร่ ให้มาเติมแถวในตารางนี้ทันที
> ช่อง "ยืนยันด้วยอะไร" ต้องเป็น**สิ่งที่วัดได้** ไม่ใช่ความจำ

## สถานะ (อัปเดต 2026-08-22)

| ไฟล์ | สถานะ | เมื่อไหร่ | ยืนยันด้วยอะไร |
|---|---|---|---|
| `security/20260809_anon_lockdown.sql` | 🟡 น่าจะรันแล้ว | ~2026-08-09 | `stock_records` ตอบ 401 code 42501 ด้วย anon key — **ตรวจแค่ตารางเดียวจาก 15 object ที่ไฟล์ครอบ** ที่เหลือยังไม่ได้ไล่ |
| `security/20260821_leads_anon_lockdown.sql` | ✅ รันแล้ว | ~2026-08-21 | `contact_leads` + `search_queries` ตอบ 401 code 42501 ทั้งคู่ (ก่อนรันเคยเป็น 200 `[]`) · `products` ยัง 200 มีข้อมูล = storefront ไม่พัง |
| `data/20260822_tuner_sku_scheme.sql` | ✅ รันแล้ว | 2026-08-22 | `products` คืน `AMG-001/002/003` + `VIC-001` · `oem_number='1244405147'` · `alt_part_numbers` มีรหัสเดิม · `part_number_norm` ถูกเขียนค่า · ค้น SKU เดิมทั้ง 4 ไม่เจอแล้ว |
| `agent/agent_lookup_fn.sql` | ⚠️ รันแล้ว แต่ **ไม่ตรงกับไฟล์ใน repo** | 2026-08-22 | RPC `agent_lookup` หาเจอครบ 9/9 (รวมเลข OEM + รหัสเดิม) · regression 7/7 ผ่าน — **แต่** `md5(prosrc)` บน DB = `47387bcc7a0587a72eb3b206dc3f6a29` (5896 ตัวอักษร) ส่วนไฟล์ `1babe42` = `52af4574699a2f2528922443ccfda09f` (5791) ต่างกัน 105 ตัวอักษร = คอมเมนต์ที่เจ้าของร้านเติมตอนแก้มือ · **ค้าง: รันไฟล์ `1babe42` ทับให้ DB=repo** |
| `security/anon-exposure-sweep.sql` | ⬜ ไม่ใช่ migration | — | เป็นคิวรีไว้ตรวจ ไม่ได้เปลี่ยนอะไร รันได้ตลอด |
| `docs/docbrief/*.sql` (m1-m7, m10, m11) | ❓ ไม่ทราบ | — | ยังไม่ได้ไล่ตรวจ อย่าเดา |
| `docs/garage-directory/*.sql` | ❓ ไม่ทราบ | — | ยังไม่ได้ไล่ตรวจ อย่าเดา |
| `docs/sourcing/sourcing-queries-schema.sql` | ❓ ไม่ทราบ | — | ยังไม่ได้ไล่ตรวจ อย่าเดา |

## ก่อนรันไฟล์ใหม่ทุกครั้ง

```bash
pip install pglast
python3 db/check_sql.py <ไฟล์.sql>        # ต้องผ่านก่อนส่งให้ใครรัน
```

`check_sql.py` เรียก `parse_plpgsql` แยกต่อฟังก์ชัน เพราะ `parse_sql` มอง body ใน `$$...$$`
เป็นแค่ string literal → จับ bug ใน plpgsql ไม่ได้เลย
(2026-08-22 เคยส่งไฟล์ที่วงเล็บขาด 1 ตัวให้เจ้าของร้านรันแล้วล้ม — ดู commit `1babe42`)

## หลังรันไฟล์ที่สร้าง/แก้ฟังก์ชัน

1. วาง `db/check_drift.sql` ลง Supabase SQL Editor ของโปรดักชัน → Run
2. เทียบผลกับ `db/drift_baseline.tsv` (commit ไว้ใน repo) — **ยึดคอลัมน์ `full_md5`**
   เพราะ `body_md5` มองไม่เห็นการเปลี่ยน `security definer` / `set search_path` /
   argument / volatility ซึ่งเปลี่ยนความปลอดภัยได้โดย body เท่าเดิม
3. อยากเทียบ DB กับไฟล์ `.sql` ตรง ๆ (เฉพาะ body) ใช้:
   ```bash
   python3 db/drift_manifest.py
   ```
   แล้วเทียบกับคอลัมน์ `body_md5` / `body_len`

**ต่างกัน ≠ พัง** — คอมเมนต์ต่างกันก็ทำให้ md5 ต่างได้ ถ้าอยากให้ DB = repo
ให้เอาไฟล์ใน repo วางทับอีกรอบ (`create or replace` รันซ้ำได้ ไม่มีผลข้างเคียง)
