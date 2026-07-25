import { test } from 'node:test'
import assert from 'node:assert/strict'
import { can, roleRank, ROLE_TH, type Role } from './ops-roles.ts'

test('owner ทำได้ทุกอย่าง', () => {
  for (const p of ['view', 'upload', 'extract', 'edit', 'confirm', 'export', 'reject', 'trash', 'restore', 'dedup'] as const) {
    assert.equal(can('owner', p), true, `owner ควรทำ ${p} ได้`)
  }
})

test('viewer ดูได้อย่างเดียว', () => {
  assert.equal(can('viewer', 'view'), true)
  for (const p of ['upload', 'extract', 'edit', 'confirm', 'export', 'trash', 'restore'] as const) {
    assert.equal(can('viewer', p), false, `viewer ไม่ควรทำ ${p}`)
  }
})

test('operator: อัปโหลด/อ่าน ได้ แต่แก้/ยืนยันไม่ได้', () => {
  assert.equal(can('operator', 'upload'), true)
  assert.equal(can('operator', 'extract'), true)
  assert.equal(can('operator', 'view'), true)
  assert.equal(can('operator', 'edit'), false)
  assert.equal(can('operator', 'confirm'), false)
  assert.equal(can('operator', 'export'), false)
})

test('reviewer: แก้/ยืนยัน/ทิ้ง ได้ แต่ export/restore ไม่ได้ (owner เท่านั้น)', () => {
  assert.equal(can('reviewer', 'edit'), true)
  assert.equal(can('reviewer', 'confirm'), true)
  assert.equal(can('reviewer', 'trash'), true)
  assert.equal(can('reviewer', 'dedup'), true)
  assert.equal(can('reviewer', 'export'), false)
  assert.equal(can('reviewer', 'restore'), false)
})

test('export/restore = owner เท่านั้น', () => {
  for (const r of ['reviewer', 'operator', 'viewer'] as const) {
    assert.equal(can(r, 'export'), false)
    assert.equal(can(r, 'restore'), false)
  }
  assert.equal(can('owner', 'export'), true)
  assert.equal(can('owner', 'restore'), true)
})

test('role null (ไม่ล็อกอิน) → ทำอะไรไม่ได้เลย', () => {
  for (const p of ['view', 'upload', 'edit', 'export'] as const) {
    assert.equal(can(null, p), false)
  }
})

test('ลำดับสิทธิ์: owner > reviewer > operator > viewer', () => {
  assert.ok(roleRank('owner') > roleRank('reviewer'))
  assert.ok(roleRank('reviewer') > roleRank('operator'))
  assert.ok(roleRank('operator') > roleRank('viewer'))
})

test('มีป้ายไทยครบทุก role', () => {
  for (const r of ['owner', 'reviewer', 'operator', 'viewer'] as Role[]) {
    assert.ok(ROLE_TH[r] && ROLE_TH[r].length > 0)
  }
})
