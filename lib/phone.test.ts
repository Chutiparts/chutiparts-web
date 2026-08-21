import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toThDigits, isThaiPhone, isIntlPhone, samePhone, isAcceptablePhone, checkLeadPhone } from './phone.ts'

const SHOP = '081-828-5855'

test('เบอร์ไทยที่ใช้ได้จริงต้องผ่าน', () => {
  for (const v of ['0891234567', '081-828-5855', '089 123 4567', '0612345678', '0991234567',
                   '021234567', '02-123-4567', '032123456', '+66891234567', '+66 89 123 4567']) {
    assert.equal(isThaiPhone(v), true, `ควรผ่าน: ${v}`)
  }
})

test('เบอร์มั่ว/หลักไม่ครบ/prefix ไม่มีจริง ต้องตก', () => {
  for (const v of ['012345', '0123456789', '05123456789', '1234567890', '089123456',
                   '08912345678', '', 'abc']) {
    assert.equal(isThaiPhone(v), false, `ควรตก: ${v}`)
  }
})

test('รหัสอะไหล่ต้องไม่ถูกนับเป็นเบอร์ (กับดักเดิมจาก STATE 5.7)', () => {
  for (const v of ['140-033', '210-820-03-56', '126-820-11-56', 'A0004660101', 'W210']) {
    assert.equal(isAcceptablePhone(v), false, `รหัสอะไหล่ไม่ใช่เบอร์: ${v}`)
  }
})

test('เบอร์ต่างประเทศ (ไม่ใช่ +66) ยังรับได้ — ลูกค้าอีบุ๊ก/ต่างชาติมีจริง', () => {
  assert.equal(isIntlPhone('+886912345678'), true)   // ไต้หวัน
  assert.equal(isIntlPhone('+1 415 555 0134'), true) // สหรัฐฯ
  assert.equal(isIntlPhone('+66891234567'), false)   // +66 ต้องไปตรวจแบบเบอร์ไทย
  assert.equal(isAcceptablePhone('+886912345678'), true)
})

test('samePhone เทียบที่ตัวเลขล้วน — รูปแบบต่างกันหลอกด่านไม่ได้', () => {
  for (const v of ['081-828-5855', '0818285855', '081 828 5855', '+66818285855', '66818285855']) {
    assert.equal(samePhone(v, SHOP), true, `ควรเท่ากับเบอร์ร้าน: ${v}`)
  }
  assert.equal(samePhone('0891234567', SHOP), false)
  assert.equal(samePhone('', SHOP), false)   // ว่างต้องไม่แมตช์อะไรทั้งนั้น
})

test('toThDigits แปลง +66 → 0 เฉพาะความยาวที่สมเหตุสมผล', () => {
  assert.equal(toThDigits('+66891234567'), '0891234567')
  assert.equal(toThDigits('0891234567'), '0891234567')
  assert.equal(toThDigits('66'), '66')            // สั้นเกินกว่าจะเป็นรหัสประเทศ
  assert.equal(toThDigits('140-033'), '140033')
})

// ── ด่านของ POST /api/leads ────────────────────────────────────────────────
test('checkLeadPhone: เบอร์ดีผ่าน · เบอร์ร้าน/เบอร์มั่วตก', () => {
  assert.equal(checkLeadPhone('0891234567', SHOP), null)
  assert.equal(checkLeadPhone('02-123-4567', SHOP), null)
  assert.equal(checkLeadPhone('081-828-5855', SHOP), 'shop_phone')
  assert.equal(checkLeadPhone('+66818285855', SHOP), 'shop_phone')  // รูปแบบต่างกันก็ต้องจับได้
  assert.equal(checkLeadPhone('012345', SHOP), 'invalid_phone')
})

test('checkLeadPhone: lead ที่ไม่มีเบอร์ (ให้แต่ LINE/อีเมล) ต้องไม่ถูก reject', () => {
  assert.equal(checkLeadPhone('', SHOP), null)
  assert.equal(checkLeadPhone('   ', SHOP), null)
  assert.equal(checkLeadPhone(undefined as unknown as string, SHOP), null)
})
