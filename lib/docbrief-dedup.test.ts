import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scorePair } from './docbrief-dedup.ts'

const mk = (o: Partial<{ vendor_name: string | null; doc_no: string | null; grand_total: number | null; doc_date: string | null }>) => ({
  id: 'x', profile: 'accounting',
  vendor_name: o.vendor_name ?? null, doc_no: o.doc_no ?? null,
  grand_total: o.grand_total ?? null, doc_date: o.doc_date ?? null,
})

const TH = 0.5 // threshold ในโค้ดจริง

test('ยอดตรง + วันที่ตรง = 0.55 (ถึงเกณฑ์) — ใบส่งของไม่มีเลขที่', () => {
  const r = scorePair(mk({ grand_total: 38000, doc_date: '2023-01-03' }), mk({ grand_total: 38000, doc_date: '2023-01-03' }))
  assert.ok(r.score >= TH, `score ${r.score} ควร >= ${TH}`)
  assert.deepEqual(r.reasons.sort(), ['amount_match', 'date_proximity'])
})

test('ยอดตรงอย่างเดียว = 0.4 (ไม่ถึงเกณฑ์) — กันเตือนมั่ว', () => {
  const r = scorePair(mk({ grand_total: 38000, doc_date: '2023-01-01' }), mk({ grand_total: 38000, doc_date: '2023-06-01' }))
  assert.ok(r.score < TH, `score ${r.score} ควร < ${TH}`)
})

test('เลขที่ตรง + ยอดตรง = 0.8 (แรงมาก)', () => {
  const r = scorePair(mk({ doc_no: 'INV-1', grand_total: 100 }), mk({ doc_no: 'INV-1', grand_total: 100 }))
  assert.ok(Math.abs(r.score - 0.8) < 1e-9)
})

test('เลขที่ตรงอย่างเดียว = 0.4 (ไม่ถึง) — เลขที่อาจบังเอิญซ้ำ', () => {
  const r = scorePair(mk({ doc_no: 'A1' }), mk({ doc_no: 'A1' }))
  assert.ok(r.score < TH)
})

test('ผู้ขายคล้าย (substring) จับได้', () => {
  const r = scorePair(mk({ vendor_name: 'บริษัท ชิพ แอดวานซ์ จำกัด', grand_total: 5 }), mk({ vendor_name: 'ชิพ แอดวานซ์', grand_total: 5 }))
  assert.ok(r.reasons.includes('vendor_similar'))
})

test('ไม่มีอะไรตรง → 0', () => {
  const r = scorePair(mk({ vendor_name: 'A', grand_total: 1, doc_date: '2020-01-01' }), mk({ vendor_name: 'B', grand_total: 2, doc_date: '2024-01-01' }))
  assert.equal(r.score, 0)
  assert.equal(r.reasons.length, 0)
})

test('วันที่ห่างกัน 3 วันยังนับใกล้, 4 วันไม่นับ', () => {
  assert.ok(scorePair(mk({ doc_date: '2023-01-01' }), mk({ doc_date: '2023-01-04' })).reasons.includes('date_proximity'))
  assert.ok(!scorePair(mk({ doc_date: '2023-01-01' }), mk({ doc_date: '2023-01-05' })).reasons.includes('date_proximity'))
})

test('null vendor ไม่จับคู่ (กันว่างตรงว่าง)', () => {
  const r = scorePair(mk({ vendor_name: null, grand_total: 5 }), mk({ vendor_name: null, grand_total: 5 }))
  assert.ok(!r.reasons.includes('vendor_similar'))
})
