# 📲 LINE Webhook → docbrief — Roadmap (ละเอียด)

> เป้าหมาย: พนักงาน/ลูกค้าส่ง **รูปบิล/ใบส่งของ** เข้า **LINE OA (mr.chuti5988)** → เด้งเข้า **docbrief** อัตโนมัติ สถานะ "รอตรวจ" → owner ตรวจ+ยืนยันเหมือนเดิม
> สถานะปัจจุบัน: ยังไม่ได้สร้าง · docbrief รับเอกสารได้ทาง **อัปโหลดในเว็บ** เท่านั้น
> Stack: Next.js 16 (chutiparts-web) · Supabase (storage + doc_documents) · reuse lib/docbrief-intake + extract เดิม

---

## 1) ทำไมต้องมี (คุณค่า)
- พนักงานหน้างานถ่ายบิล **ส่งเข้า LINE ที่ใช้อยู่แล้ว** — ไม่ต้องเปิดเว็บ/ล็อกอิน
- ของเข้า docbrief ทันที 24 ชม. **ไม่ต้องเปิดแชตกับ AI** (ต่างจาก LINE MCP ที่ทำงานเฉพาะตอน dev)
- ลดแรงเสียดทาน = พนักงานใช้จริงมากขึ้น (dogfood → ขยายผล)

> ⚠️ นี่คือ **production integration** (คนละเรื่องกับ LINE MCP) — ทำงานบนเซิร์ฟเวอร์ chutibenz ตลอดเวลา

---

## 2) ภาพรวมสถาปัตยกรรม

```
[พนักงาน/ลูกค้า]
     │ ส่งรูปบิลเข้า LINE OA
     ▼
[LINE Messaging API]  ──POST event──►  [chutibenz.com/api/line/webhook]
                                            │ 1. verify signature (HMAC)
                                            │ 2. เช็ก whitelist ผู้ส่ง
                                            │ 3. ดึงรูปจาก LINE (message content)
                                            │ 4. เก็บรูปลง Supabase storage
                                            │ 5. สร้าง doc_documents (state=queued)
                                            │ 6. reply "รับรูปแล้ว กำลังอ่าน…"
                                            ▼
                                     [docbrief เดิม]
                                     extract (Claude) → รอตรวจ → owner ยืนยัน → Sheet/สต็อก
```

**หัวใจ:** webhook แค่ "รับรูป → หย่อนเข้า docbrief" ที่เหลือใช้ pipeline docbrief เดิมทั้งหมด (ไม่สร้าง flow ใหม่)

---

## 3) Flow ละเอียด (image message)

| # | ขั้น | รายละเอียด |
|---|------|-----------|
| 1 | LINE ส่ง event | POST body มี `events[]` · แต่ละ event มี `type:'message'`, `message.type:'image'`, `message.id`, `source.userId`, `replyToken` |
| 2 | **Verify signature** | header `X-Line-Signature` = base64(HMAC-SHA256(channelSecret, **raw body**)) — ต้องตรง ไม่งั้น 401 (กันคนปลอม POST) |
| 3 | **Whitelist ผู้ส่ง** | เทียบ `source.userId` กับรายชื่อพนักงานที่อนุญาต (env/ตาราง) — กัน spam/คนนอก |
| 4 | ดึงรูป | GET `https://api-data.line.me/v2/bot/message/{message.id}/content` + Bearer channelAccessToken → ได้ binary |
| 5 | เก็บรูป | อัปเข้า Supabase storage (DOC_BUCKET เดิม) — เหมือน intakeFile ในเว็บ |
| 6 | สร้างเอกสาร | insert `doc_documents` (profile เดา/ถามทีหลัง, state='queued', source='line', line_user_id) |
| 7 | reply | ใช้ `replyToken` ตอบ "✅ รับบิลแล้ว กำลังให้ AI อ่าน เดี๋ยวขึ้นในกล่องรอตรวจ" |
| 8 | extract | trigger extractDocument เดิม (async) — Claude อ่าน → pending_review |

**ข้อความ (text) แทนรูป:** ตอบ instruction "ส่งเป็นรูปบิลได้เลยครับ" (เฟสแรกรับเฉพาะรูป)

---

## 4) สิ่งที่ Owner ต้องเตรียม (ฝั่งคุณ)

1. **LINE Developers Console** (developers.line.biz) → สร้าง **Messaging API channel** ผูกกับ OA mr.chuti5988
2. เก็บค่า 2 ตัว (ใส่ **Vercel env เท่านั้น** — ห้าม hardcode/ส่งผ่านแชต):
   - `LINE_CHANNEL_SECRET` (ใช้ verify signature)
   - `LINE_CHANNEL_ACCESS_TOKEN` (ใช้ดึงรูป + reply)
3. ตั้ง **Webhook URL** = `https://chutibenz.com/api/line/webhook` + เปิด "Use webhook"
4. ปิด auto-reply/greeting ของ OA (กันชนกับ bot)
5. รายชื่อ **LINE userId พนักงานที่อนุญาต** (ได้จากตอน dev/ทดสอบ — ให้พนักงานทักมาแล้ว log userId)

---

## 5) ความปลอดภัย (ยึดกฎเดิม)
- ✅ **Verify X-Line-Signature ทุก request** (HMAC-SHA256 · raw body) — ไม่ผ่าน = 401
- ✅ **Whitelist ผู้ส่ง** — เฉพาะพนักงาน (กันคนนอกยิงรูปเข้า docbrief)
- ✅ secrets อยู่ **Vercel env** เท่านั้น (LINE_CHANNEL_SECRET/TOKEN) · ห้าม hardcode
- ✅ **ทุกใบยังผ่านคนตรวจ** (state=queued→pending_review) — LINE แค่เป็นช่องรับเข้า ไม่ auto-publish
- ✅ rate limit ต่อ userId (กัน flood) — reuse lib/docbrief-ratelimit
- ✅ ตอบ 200 เร็ว (< 1 วินาที) แล้วประมวลผล async (LINE timeout ~1s) — กัน retry ซ้ำ

---

## 6) แบ่งเป็น 3 Phase

### Phase 1 — Webhook พื้นฐาน (verify + echo) [ครึ่งวัน]
- `POST /api/line/webhook` — verify signature, log event, ตอบ 200
- ทดสอบด้วย LINE verify button + ส่งข้อความ echo กลับ
- **ได้:** ยืนยัน channel เชื่อมถูก + signature ผ่าน

### Phase 2 — รูป → docbrief [1 วัน]
- รับ image message → ดึงรูป → เก็บ storage → สร้าง doc_documents (state=queued, source='line')
- reply "รับแล้ว" + trigger extract
- whitelist ผู้ส่ง + rate limit
- **ได้:** ส่งบิลเข้า LINE → เห็นในกล่องรอตรวจ docbrief

### Phase 3 — ขัดเกลา (2-way / สถานะ) [ตามต้องการ]
- แจ้งกลับเมื่อ AI อ่านเสร็จ ("อ่านได้ 3 รายการ ยอด 12,000 — เปิดตรวจ: <ลิงก์>")
- เลือก profile (บัญชี/สต็อก) จากปุ่ม LINE (quick reply)
- ผูก LINE userId ↔ ชื่อพนักงาน (audit ว่าใครส่ง)

---

## 7) งานฝั่งโค้ด (สรุป)
- `app/api/line/webhook/route.ts` — endpoint (POST) · verify · route event
- `lib/line-client.ts` — getMessageContent(messageId), reply(replyToken, text), verifySignature(raw, sig)
- reuse: `lib/docbrief-intake.ts` (เก็บไฟล์+สร้าง doc), `extractDocument` (Claude)
- (ทางเลือก) ตาราง/env สำหรับ whitelist userId + mapping ชื่อพนักงาน
- **ไม่แตะ:** docbrief pipeline เดิม · schema หลัก (อาจ add column `source`/`line_user_id` ใน doc_documents — owner รัน SQL)

---

## 8) ค่าใช้จ่าย
- **LINE Messaging API:** free tier ~500-1,000 ข้อความ reply/เดือน (รับ inbound ฟรี) — พอสำหรับ dogfood
- **Claude extract:** ~1-1.4 บาท/ใบ (เท่าเดิม)
- **ไม่มีค่า infra เพิ่ม** — รันบน Vercel เดิม

---

## 9) Acceptance criteria
| หัวข้อ | ผ่านเมื่อ |
|--------|-----------|
| Verify | POST ที่ signature ผิด → 401 · ถูก → 200 |
| Security | คนนอก whitelist ส่งรูป → ไม่เข้าระบบ |
| Intake | พนักงานส่งรูปบิล → เห็นใน docbrief "รอตรวจ" ภายใน ~10 วิ |
| Reply | ผู้ส่งได้ข้อความยืนยัน "รับแล้ว" |
| Human gate | ทุกใบยังต้อง owner ยืนยันก่อนเข้า Sheet/สต็อก |

---

## 10) ความเสี่ยง / ข้อควรระวัง
- ⏱️ **LINE timeout ~1 วิ** → ต้องตอบ 200 ก่อน แล้วดึงรูป/extract แบบ async (ไม่งั้น LINE ส่งซ้ำ)
- 🔁 **Idempotency** — LINE อาจส่ง event ซ้ำ · กันด้วย message.id (ไม่สร้าง doc ซ้ำ)
- 🖼️ รูปจาก LINE อาจถูกบีบอัด → ความละเอียดต่ำกว่าถ่ายตรง (AI อ่านลายมืออาจหลุด — review จับได้)
- 👤 ต้องมีวิธีเก็บ userId พนักงานตอนเริ่ม (ให้ทัก "ลงทะเบียน" แล้ว log)
- 📜 ถ้าให้**ลูกค้า**ส่ง (ไม่ใช่แค่พนักงาน) ต้องมี consent/PDPA + คัดกรองเข้มขึ้น

---

## 11) เริ่มยังไง (checklist)
```
□ owner: สร้าง Messaging API channel ผูก OA mr.chuti5988
□ owner: ตั้ง LINE_CHANNEL_SECRET + LINE_CHANNEL_ACCESS_TOKEN ใน Vercel env
□ dev: Phase 1 — /api/line/webhook (verify + echo) → กด Verify ใน console ผ่าน
□ owner: ตั้ง Webhook URL + เปิด use webhook + ปิด auto-reply
□ dev: Phase 2 — รูป → storage → doc_documents → reply → extract
□ test: ส่งบิลจริงเข้า LINE → เช็กเห็นในกล่องรอตรวจ
□ owner: เก็บ userId พนักงาน → ใส่ whitelist
□ go: เปิดให้พนักงานใช้ (dogfood 1-2 สัปดาห์)
```

---

## คำแนะนำจังหวะ
ช่วง **dogfood ตอนนี้ยังไม่ต้องรีบ** — อัปโหลดในเว็บใช้ได้อยู่
ทำ LINE Webhook ตอนจะ **เปิดให้พนักงานหลายคนใช้จริง** จะคุ้มสุด (ออกแบบให้ตรงพฤติกรรมจริงหลังเห็น pilot data)

*roadmap สร้าง 26 ก.ค. 2569 · ต่อยอดจาก docbrief · LINE OA mr.chuti5988*
