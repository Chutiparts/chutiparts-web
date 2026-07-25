import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agg, bkkDay, withinLastDays, timeSavedMinutes, humanizeMinutes, reviewRate, exportSuccessRate, dayStartShift,
} from './docbrief-metrics.ts'

test('agg: รวมยอด + เฉลี่ย + latency', () => {
  const a = agg([
    { cost_thb: 1.5, latency_ms: 10000, created_at: '2026-07-25T00:00:00Z' },
    { cost_thb: 2.5, latency_ms: 20000, created_at: '2026-07-25T00:00:00Z' },
  ])
  assert.equal(a.n, 2)
  assert.equal(a.cost, 4)
  assert.equal(a.avg, 2)
  assert.equal(a.latency, 15000)
})

test('agg: ชุดว่าง → 0 ทั้งหมด (ไม่ NaN)', () => {
  const a = agg([])
  assert.equal(a.n, 0); assert.equal(a.cost, 0); assert.equal(a.avg, 0); assert.equal(a.latency, 0)
})

test('agg: cost null → นับเป็น 0', () => {
  const a = agg([{ cost_thb: null, latency_ms: null, created_at: '2026-07-25T00:00:00Z' }])
  assert.equal(a.cost, 0)
})

test('bkkDay: UTC 17:00 → วันถัดไป (ไทย +7)', () => {
  // 2026-07-24T17:30Z = 2026-07-25 00:30 ไทย
  assert.equal(bkkDay('2026-07-24T17:30:00Z'), '2026-07-25')
  assert.equal(bkkDay('2026-07-24T10:00:00Z'), '2026-07-24')
})

test('withinLastDays: วันนี้อยู่ใน 1 วัน, เมื่อวานไม่อยู่', () => {
  const now = new Date('2026-07-25T05:00:00Z').getTime() // ไทย 12:00 25 ก.ค.
  assert.equal(withinLastDays('2026-07-25T04:00:00Z', 1, now), true)  // วันนี้
  assert.equal(withinLastDays('2026-07-23T04:00:00Z', 1, now), false) // 2 วันก่อน
  assert.equal(withinLastDays('2026-07-19T04:00:00Z', 7, now), true)  // 6 วันก่อน อยู่ใน 7
  assert.equal(withinLastDays('2026-07-18T04:00:00Z', 7, now), false) // 7 วันก่อน ไม่อยู่ใน 7
})

test('dayStartShift: คืนค่าคงที่สำหรับเวลาในวันเดียวกัน', () => {
  const a = dayStartShift(new Date('2026-07-25T01:00:00Z').getTime())
  const b = dayStartShift(new Date('2026-07-25T16:00:00Z').getTime())
  assert.equal(a, b)
})

test('timeSavedMinutes: จำนวนใบ × นาที/ใบ', () => {
  assert.equal(timeSavedMinutes(20), 60)
  assert.equal(timeSavedMinutes(10, 5), 50)
})

test('humanizeMinutes', () => {
  assert.equal(humanizeMinutes(45), '45 นาที')
  assert.equal(humanizeMinutes(60), '1 ชม.')
  assert.equal(humanizeMinutes(150), '2 ชม. 30 นาที')
})

test('reviewRate', () => {
  assert.equal(reviewRate(3, 10), 30)
  assert.equal(reviewRate(0, 0), 0) // ไม่มีใบ → 0 ไม่ใช่ NaN
})

test('exportSuccessRate', () => {
  assert.equal(exportSuccessRate(9, 1), 90)
  assert.equal(exportSuccessRate(0, 0), 100) // ยังไม่ส่งออก = ยังไม่มีปัญหา
  assert.equal(exportSuccessRate(5, 0), 100)
})
