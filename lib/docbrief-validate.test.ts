import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileVat, validateDocument, isValidThaiTaxId, type DocFields } from './docbrief-validate.ts'

// ── reconcileVat ────────────────────────────────────────────────
test('exclusive: subtotal + vat = total', () => {
  assert.equal(reconcileVat(1000, 70, 1070).model, 'exclusive')
})

test('inclusive: บิลโชว์ราคารวม VAT เป็น subtotal แล้วแตก VAT ออก', () => {
  // total 1000 รวม VAT แล้ว → VAT ฝัง = 1000×7/107 ≈ 65.42, subtotal โชว์ = 1000
  const r = reconcileVat(1000, 65.42, 1000)
  assert.equal(r.model, 'inclusive')
  assert.ok(Math.abs(r.expectedVat - 65.42) < 0.01)
})

test('inclusive: subtotal โชว์เป็นฐานก่อน VAT ก็ยังจับได้ (จริง ๆ คือ exclusive ที่ลงตัว)', () => {
  // 934.58 + 65.42 = 1000 → ลงตัวแบบ exclusive
  assert.equal(reconcileVat(934.58, 65.42, 1000).model, 'exclusive')
})

test('mismatch: ยอดไม่เข้าทั้ง exclusive และ inclusive', () => {
  assert.equal(reconcileVat(1000, 200, 1070).model, 'mismatch')
})

// ── validateDocument: VAT inclusive ไม่ใช่ fail ─────────────────
const base: DocFields = {
  vendor_name: 'ร้านทดสอบ', vendor_tax_id: null, doc_no: 'INV-1',
  doc_date: '2025-01-10', subtotal: null, vat: null, grand_total: 100,
  currency: 'THB', confidence: null,
}

test('บิลราคารวม VAT → ธง vat_inclusive (ไม่ใช่ validation_failed)', () => {
  const { flags } = validateDocument({ ...base, subtotal: 1000, vat: 65.42, grand_total: 1000 })
  assert.ok(flags.includes('vat_inclusive'), `flags: ${flags}`)
  assert.ok(!flags.includes('validation_failed'))
})

test('บิลราคาแยก VAT ปกติ → ไม่มีธง VAT', () => {
  const { flags } = validateDocument({ ...base, subtotal: 1000, vat: 70, grand_total: 1070 })
  assert.ok(!flags.includes('vat_inclusive'))
  assert.ok(!flags.includes('vat_mismatch'))
  assert.ok(!flags.includes('validation_failed'))
})

test('ยอดมั่วจริง (ไม่เข้าทั้งสองแบบ) → validation_failed', () => {
  const { flags } = validateDocument({ ...base, subtotal: 1000, vat: 200, grand_total: 1070 })
  assert.ok(flags.includes('validation_failed'))
})

test('ราคารวม VAT + ตัวเลขบวกลงตัว → ไม่เตือน low_confidence ของ field ตัวเลข', () => {
  const { flags } = validateDocument({
    ...base, subtotal: 1000, vat: 65.42, grand_total: 1000,
    confidence: { grand_total: 0.4, vat: 0.4 },
  })
  assert.ok(!flags.includes('low_confidence'), `flags: ${flags}`)
})

// ── sanity: checksum เดิมยังทำงาน ───────────────────────────────
test('tax id checksum: เลขผิด → false', () => {
  assert.equal(isValidThaiTaxId('1234567890123'), false)
})
