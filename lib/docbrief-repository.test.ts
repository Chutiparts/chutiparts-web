import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRepoFilters, hasActiveFilters, sanitizeLike } from './docbrief-repository.ts'

test('parseRepoFilters: ค่าว่าง → default สะอาด', () => {
  const f = parseRepoFilters({})
  assert.equal(f.q, '')
  assert.equal(f.state, '')
  assert.equal(f.profile, '')
  assert.equal(f.amountMin, null)
  assert.equal(f.dupOnly, false)
})

test('parseRepoFilters: state/profile ที่ไม่ถูกต้อง → ตกเป็นว่าง', () => {
  const f = parseRepoFilters({ state: 'nonsense', profile: 'hacker' })
  assert.equal(f.state, '')
  assert.equal(f.profile, '')
})

test('parseRepoFilters: state/profile ถูกต้อง → เก็บไว้', () => {
  const f = parseRepoFilters({ state: 'pending_review', profile: 'stock' })
  assert.equal(f.state, 'pending_review')
  assert.equal(f.profile, 'stock')
})

test('parseRepoFilters: amount min>max → สลับให้', () => {
  const f = parseRepoFilters({ amount_min: '9000', amount_max: '1000' })
  assert.equal(f.amountMin, 1000)
  assert.equal(f.amountMax, 9000)
})

test('parseRepoFilters: amount มี comma → parse ได้', () => {
  const f = parseRepoFilters({ amount_min: '1,500' })
  assert.equal(f.amountMin, 1500)
})

test('parseRepoFilters: date รูปแบบผิด → ตกเป็นว่าง', () => {
  const f = parseRepoFilters({ date_from: '2026/07/25', date_to: '2026-07-25' })
  assert.equal(f.dateFrom, '')
  assert.equal(f.dateTo, '2026-07-25')
})

test('parseRepoFilters: dup=1 → true', () => {
  assert.equal(parseRepoFilters({ dup: '1' }).dupOnly, true)
  assert.equal(parseRepoFilters({ dup: '0' }).dupOnly, false)
})

test('parseRepoFilters: รับ array (searchParams ซ้ำ) → เอาตัวแรก', () => {
  const f = parseRepoFilters({ q: ['abc', 'def'] })
  assert.equal(f.q, 'abc')
})

test('hasActiveFilters: ว่าง → false, มีค่า → true', () => {
  assert.equal(hasActiveFilters(parseRepoFilters({})), false)
  assert.equal(hasActiveFilters(parseRepoFilters({ q: 'test' })), true)
  assert.equal(hasActiveFilters(parseRepoFilters({ amount_min: '100' })), true)
})

test('sanitizeLike: ตัดอักขระอันตรายของ supabase filter', () => {
  const out = sanitizeLike('a,b(c)%*d')
  for (const ch of [',', '(', ')', '%', '*']) assert.ok(!out.includes(ch), `ต้องไม่มี ${ch}`)
  assert.equal(sanitizeLike('  hello  '), 'hello')
})
