import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePartName, nameSimilarity, findSimilarNames } from './docbrief-name-match.ts'

test('normalize: ตัดช่องว่าง/อักขระพิเศษ + lowercase', () => {
  assert.equal(normalizePartName('ผ้าเบรคหน้า Vios'), 'ผ้าเบรคหน้าvios')
  assert.equal(normalizePartName('กระจัง-หน้า (W140)'), 'กระจังหน้าw140')
})

test('เหมือนเป๊ะ (ต่างแค่ช่องว่าง) = 1', () => {
  assert.equal(nameSimilarity('ไฟท้าย ซ้าย', 'ไฟท้ายซ้าย'), 1)
})

test('สลับคำ/ช่องว่างต่าง ยังคล้ายสูง — เคสหลัก B2', () => {
  const sim = nameSimilarity('ผ้าเบรคหน้า Vios', 'ผ้าเบรค Vios หน้า')
  assert.ok(sim >= 0.6, `sim ${sim} ควร >= 0.6`)
})

test('อะไหล่คนละชิ้น (แชร์แค่รุ่นรถ) ไม่คล้าย', () => {
  const sim = nameSimilarity('กระจังหน้า W140', 'ไฟท้าย W140')
  assert.ok(sim < 0.6, `sim ${sim} ควร < 0.6`)
})

test('ว่าง → 0', () => {
  assert.equal(nameSimilarity('', 'ไฟท้าย'), 0)
  assert.equal(nameSimilarity('ไฟท้าย', ''), 0)
})

const STOCK = [
  { sku: '140-012', part_name: 'ผ้าเบรคหน้า Vios' },
  { sku: '140-013', part_name: 'ไฟท้ายซ้าย W140' },
  { sku: null, part_name: null },
]

test('findSimilarNames: จับของเดิมที่ชื่อคล้าย + คืน sku', () => {
  const m = findSimilarNames('ผ้าเบรค Vios หน้า', STOCK)
  assert.equal(m.length, 1)
  assert.equal(m[0].sku, '140-012')
  assert.ok(m[0].similarity >= 0.6)
})

test('findSimilarNames: ชื่อไม่ซ้ำใคร → []', () => {
  assert.deepEqual(findSimilarNames('คานหน้า W124', STOCK), [])
})

test('findSimilarNames: candidate ว่าง/null → []', () => {
  assert.deepEqual(findSimilarNames(null, STOCK), [])
  assert.deepEqual(findSimilarNames('   ', STOCK), [])
})

test('findSimilarNames: เรียงคล้ายมากขึ้นก่อน', () => {
  const stock = [
    { sku: 'A', part_name: 'ไฟหน้าขวา W140 รุ่นพิเศษ' },
    { sku: 'B', part_name: 'ไฟหน้าขวา W140' },
  ]
  const m = findSimilarNames('ไฟหน้าขวา W140', stock)
  assert.equal(m[0].sku, 'B') // เหมือนเป๊ะกว่า
  assert.ok(m[0].similarity >= m[m.length - 1].similarity)
})
