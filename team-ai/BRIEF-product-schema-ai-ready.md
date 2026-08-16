# BRIEF ส่ง Claude Code — Product Schema ให้ AI shopping อ่านได้ + availability ตรงสต็อกจริง
เป้า: หน้า product ของ chutibenz.com ให้ AI (Gemini/ChatGPT shopping) อ่านครบ + **availability สะท้อนสต็อกสด** (แก้ bug InStock ตายตัว)
ไฟล์หลัก: `app/products/[slug]/page.tsx` · main ล่าสุด
**ขอบเขต: enrich JSON-LD + ผูก liveQty · read-only เพิ่ม query สต็อก · ห้ามแตะ trigger/RLS/products sync · ห้ามเขียน DB**

## ที่มา (วัดจากโค้ดจริงแล้ว)
หน้า product **มี JSON-LD Product+Offer อยู่แล้ว** (ดีกว่า SME 70%) แต่มี 3 ช่องโหว่:
- `availability: 'https://schema.org/InStock'` **hardcode เสมอ** — ของหมดก็บอกมี = ตัวทำลายความน่าเชื่อถืออันดับ 1 ของ AI shopping
- ราคา/สต็อกดึงจากตาราง `products` (sync จาก Google Sheet) **ไม่ใช่ `stock_records` สด** — post-cutover ขายแล้ว qty ตัด แต่หน้าเว็บค้าง
- ขาด itemCondition (มือสอง), fitment (รุ่นที่ใส่ได้), return policy, shipping — ฟิลด์ที่ AS ใช้ตัดสิน

## งาน 3 ส่วน (ไฟล์เดียวเป็นหลัก)

### (1) availability สะท้อนสต็อกสด + qty ตรงกันทั้งคนและ AI ★สำคัญสุด
- ใน server component เพิ่ม query สต็อกสด: `stock_records` ที่ `sku = product.part_number` (match แบบ trim/ci — เผื่อ upper/trim) · `deleted_at is null` · **sum(qty) ของ active rows** = `liveQty`
  - ไม่เจอ row (มีในแคตตาล็อกแต่ยังไม่มีใน ledger) → fallback `product.stock` · query fail → fallback `product.stock` (ห้ามหน้าล่ม)
- **JSON-LD offers.availability** = `liveQty > 0` → `https://schema.org/InStock` · `= 0` → `https://schema.org/OutOfStock` (คง Offer ไว้เสมอ)
- ใช้ `liveQty` ตัวเดียวกันไปแทน `product.stock` ที่ **บรรทัด 171 (badge ใกล้หมด)** + **บรรทัด 263 ("มี N ชิ้น")** → คน + AI เห็นเลขเดียวกัน = "เสถียร" จริง
- (optional) ถ้า `liveQty === 0` เปลี่ยนปุ่ม AddToCart เป็น "ของหมด/สอบถาม LINE" — ทำได้ก็ดี ไม่บังคับ

### (2) itemCondition + fitment (ถูก · ตรงกับอะไหล่มือสอง)
- `offers.itemCondition: 'https://schema.org/UsedCondition'` (default มือสอง · ถ้า product มี flag ของใหม่ค่อยสลับ NewCondition — ไม่มีก็ Used)
- เพิ่ม `additionalProperty` (array of PropertyValue) — ใส่เฉพาะที่มีค่า:
  - `compatible_models` → `{ '@type':'PropertyValue', name:'รุ่นที่ใส่ได้', value: compatible_models.join(', ') }`
  - `engine_codes` → `{ name:'รหัสเครื่อง', value: engine_codes.join(', ') }`
  - `sideLabel` → `{ name:'ข้าง', value: sideLabel }`
  - **fitment คือ structured data ที่สำคัญสุดของอะไหล่รถ** (AI จับคู่ "อะไหล่สำหรับ W140" จากตรงนี้ · สำคัญกว่า GTIN)

### (3) return policy + shipping (ฟิลด์ที่ AI shopping ให้น้ำหนัก)
เจ้าของยืนยัน: รับประกัน = **ของมีปัญหา เปลี่ยน/คืนเงินภายใน 15 วัน** · ส่ง **กทม 1-2 / ตจว 2-4 วัน**
- `offers.hasMerchantReturnPolicy`:
  ```
  { '@type':'MerchantReturnPolicy', applicableCountry:'TH',
    returnPolicyCategory:'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: (product.warranty_days ?? 15),
    returnMethod:'https://schema.org/ReturnByMail',
    refundType:'https://schema.org/FullRefund' }
  ```
  (ซื่อสัตย์: เป็นการคืน/เปลี่ยนกรณีของมีปัญหา — ไม่ overclaim no-questions-asked · ใส่คำอธิบายเงื่อนไขในข้อความหน้าเว็บได้)
- `offers.shippingDetails`:
  ```
  { '@type':'OfferShippingDetails',
    shippingDestination:{ '@type':'DefinedRegion', addressCountry:'TH' },
    deliveryTime:{ '@type':'ShippingDeliveryTime',
      handlingTime:{ '@type':'QuantitativeValue', minValue:0, maxValue:1, unitCode:'DAY' },
      transitTime:{ '@type':'QuantitativeValue', minValue:1, maxValue:4, unitCode:'DAY' } } }
  ```
- (optional · ได้ประโยชน์น้อยสำหรับของมือสองชิ้นเดียว) `offers.priceValidUntil` = วันนี้+~1 ปี — ใส่ก็ได้เพื่อครบฟิลด์

## กันพลาด
- **server-rendered เท่านั้น** — JSON-LD ต้องอยู่ใน HTML ตั้งแต่แรก (หน้านี้เป็น async server component อยู่แล้ว · คง `<script type="application/ld+json">` เดิม แค่ enrich object) เพราะ AI crawler หลายตัวไม่รัน JS
- **ห้ามแตะ** trigger/RLS/products/sync-stock · query สต็อก = read-only · fail→fallback (หน้าห้ามล่ม)
- ใส่ field ใน schema **เฉพาะที่มีค่า** (undefined = ตัดออก · อย่าใส่ null/ค่าว่างให้ schema สกปรก)
- ไม่ overclaim: return policy = กรณีของมีปัญหา (ตามจริง) · ไม่แต่งเวลาส่ง/เงื่อนไขเกินจริง
- liveQty จาก sum(active rows) — เผื่อ sku มีหลาย active row (คง behavior เดิม ไม่ตัดสินใจแทน)

## Acceptance
1. เปิดหน้า product ของ SKU ที่ **qty=0 ใน stock_records** → JSON-LD `availability` = OutOfStock + หน้าโชว์ "ของหมด" (ไม่ใช่ InStock ตายตัว)
2. SKU ที่มีของ → InStock + "มี N ชิ้น" = liveQty (ตรง stock_records ไม่ใช่ product.stock ค้าง)
3. JSON-LD มี: itemCondition=Used · additionalProperty (รุ่นที่ใส่ได้/รหัสเครื่อง/ข้าง เท่าที่มี) · hasMerchantReturnPolicy(15 วัน) · shippingDetails(TH 1-4 วัน)
4. ผ่าน **Google Rich Results Test** (วาง URL จริง) ไม่มี error/warning สำคัญ
5. query สต็อก fail (จำลอง) → หน้าไม่ล่ม (fallback product.stock)
6. tsc/lint สะอาด · แตะไฟล์เดียวเป็นหลัก (`products/[slug]/page.tsx`)

## Builder review focus
- availability/qty มาจาก stock_records สดจริง (ไม่ใช่ product.stock) · fallback ปลอดภัย
- sku match ถูก (trim/ci · sum active rows · ไม่นับ deleted)
- schema ไม่มี field ว่าง/null · return policy ไม่ overclaim
- JSON-LD ยัง server-rendered (ไม่ย้ายไป client)
- ไม่แตะ path เขียน DB / trigger / sync ใด ๆ
