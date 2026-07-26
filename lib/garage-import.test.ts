// lib/garage-import.test.ts — node --test (type-strip)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normName, hash36, slugify, detectProvince, normalizeApify, findDuplicate, dedupeBatch,
} from './garage-import.ts'

test('normName strips spaces/punctuation/sample marker', () => {
  assert.equal(normName('อู่ เบนซ์  ทองหล่อ (ตัวอย่าง)'), 'อู่เบนซ์ทองหล่อ')
  assert.equal(normName('Benz-Tech_Garage.'), 'benztechgarage')
})

test('hash36 is stable + 4 chars', () => {
  assert.equal(hash36('ChIJabc'), hash36('ChIJabc'))
  assert.equal(hash36('ChIJabc').length, 4)
  assert.notEqual(hash36('a'), hash36('b'))
})

test('slugify keeps base + token', () => {
  assert.equal(slugify('Thonglor Benz', 'ab12'), 'thonglor-benz-ab12')
  assert.equal(slugify('', 'ab12'), 'garage-ab12')
})

test('detectProvince finds known province in text', () => {
  assert.equal(detectProvince('123 ถนนสุขุมวิท กรุงเทพมหานคร'), 'กรุงเทพมหานคร')
  assert.equal(detectProvince('Bangkok Thailand'), 'กรุงเทพมหานคร')
  assert.equal(detectProvince('อ.เมือง จ.เชียงใหม่'), 'เชียงใหม่')
  assert.equal(detectProvince('ไม่มีจังหวัด'), null)
})

test('normalizeApify maps common Apify Google Maps fields', () => {
  const r = normalizeApify({
    title: 'อู่เบนซ์ทองหล่อ',
    address: 'ซอยทองหล่อ วัฒนา กรุงเทพมหานคร',
    phone: '02-111-2222',
    website: 'https://example.com',
    totalScore: 4.8,
    reviewsCount: 126,
    location: { lat: 13.736, lng: 100.582 },
    url: 'https://maps.google.com/?cid=1',
    placeId: 'ChIJxxx',
  })
  assert.equal(r.name_th, 'อู่เบนซ์ทองหล่อ')
  assert.equal(r.province, 'กรุงเทพมหานคร')
  assert.equal(r.phone, '02-111-2222')
  assert.equal(r.rating, 4.8)
  assert.equal(r.review_count, 126)
  assert.equal(r.lat, 13.736)
  assert.equal(r.place_id, 'ChIJxxx')
  assert.equal(r.status, 'cleaned')
  assert.equal(r.needs_manual_review, false)
  assert.ok(r.slug.endsWith(hash36('ChIJxxx'))) // token ท้าย slug เสถียรจาก place_id
})

test('normalizeApify flags needs_manual_review when missing contact/province', () => {
  const r = normalizeApify({ title: 'อู่ไม่มีข้อมูล' })
  assert.equal(r.needs_manual_review, true)
})

test('findDuplicate matches by place_id then name+phone', () => {
  const row = normalizeApify({ title: 'อู่ A', phone: '02-1', placeId: 'PID1', address: 'กรุงเทพมหานคร' })
  const existing = [
    { id: 'x1', place_id: 'PID1', normalized_name: 'other', phone: null },
    { id: 'x2', place_id: null, normalized_name: 'อู่a', phone: '02-1' },
  ]
  assert.equal(findDuplicate(row, existing), 'x1') // place_id ชนะ
  const row2 = normalizeApify({ title: 'อู่ A', phone: '02-1', address: 'กรุงเทพมหานคร' })
  assert.equal(findDuplicate(row2, existing), 'x2') // ไม่มี place_id → name+phone
  const row3 = normalizeApify({ title: 'อู่ Z', phone: '09-9', address: 'กรุงเทพมหานคร' })
  assert.equal(findDuplicate(row3, existing), null)
})

test('dedupeBatch removes duplicates within the same import', () => {
  const a = normalizeApify({ title: 'อู่ A', placeId: 'P1', address: 'กรุงเทพมหานคร' })
  const b = normalizeApify({ title: 'อู่ A (ซ้ำ)', placeId: 'P1', address: 'กรุงเทพมหานคร' })
  const c = normalizeApify({ title: 'อู่ B', placeId: 'P2', address: 'เชียงใหม่' })
  assert.equal(dedupeBatch([a, b, c]).length, 2)
})
