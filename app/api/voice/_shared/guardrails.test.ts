// app/api/voice/_shared/guardrails.test.ts
// Run: node --test app/api/voice/_shared/*.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  routeCallResult, consentAllows, latestConsent, reuseIfExists,
  STT_CONFIDENCE_THRESHOLD, type ConsentLookup,
} from './guardrails.ts'
import type { ConsentRow } from './types.ts'

// ---- intent-routing thresholds (brief §3.3 / §7.1) ----
test('clear intent + confidence >= 0.85 → review / pending_review', () => {
  for (const intent of ['confirmed', 'declined', 'reschedule'] as const) {
    const r = routeCallResult({ intent, stt_confidence: 0.85 })
    assert.equal(r.routing, 'review', `${intent}@0.85 should route to review`)
    assert.equal(r.decisionStatus, 'pending_review')
  }
})

test('confidence just below threshold → inbox (need_human_followup)', () => {
  const r = routeCallResult({ intent: 'confirmed', stt_confidence: STT_CONFIDENCE_THRESHOLD - 0.001 })
  assert.equal(r.routing, 'inbox')
  assert.equal(r.decisionStatus, 'need_human_followup')
})

test('intent unclear → inbox even at confidence 1.0', () => {
  const r = routeCallResult({ intent: 'unclear', stt_confidence: 1 })
  assert.equal(r.routing, 'inbox')
  assert.equal(r.decisionStatus, 'need_human_followup')
})

// ---- consent-gate incl. FAIL-CLOSED (brief §2.1 / §7.1) ----
test('consent granted → allowed', () => {
  const lookup: ConsentLookup = { ok: true, latest: { contact_lead_id: 'x', granted: true, captured_at: '2026-08-06T00:00:00Z', consent_text_version: 'v1' } }
  assert.equal(consentAllows(lookup), true)
})

test('consent latest not-granted → rejected', () => {
  const lookup: ConsentLookup = { ok: true, latest: { contact_lead_id: 'x', granted: false, captured_at: '2026-08-06T00:00:00Z', consent_text_version: 'v1' } }
  assert.equal(consentAllows(lookup), false)
})

test('no consent row → rejected', () => {
  assert.equal(consentAllows({ ok: true, latest: null }), false)
})

test('FAIL-CLOSED: consent table unreadable → rejected (never fail-open)', () => {
  assert.equal(consentAllows({ ok: false, reason: 'unavailable' }), false)
})

// ---- latest-by-captured_at (append-only, brief §3.4) ----
test('latestConsent picks the newest captured_at (revocation wins)', () => {
  const rows: ConsentRow[] = [
    { contact_lead_id: 'x', granted: true, captured_at: '2026-08-01T00:00:00Z', consent_text_version: 'v1' },
    { contact_lead_id: 'x', granted: false, captured_at: '2026-08-05T00:00:00Z', consent_text_version: 'v1' },
    { contact_lead_id: 'x', granted: true, captured_at: '2026-08-03T00:00:00Z', consent_text_version: 'v1' },
  ]
  const latest = latestConsent(rows)
  assert.equal(latest?.captured_at, '2026-08-05T00:00:00Z')
  assert.equal(latest?.granted, false)
  // and the gate rejects on that revocation
  assert.equal(consentAllows({ ok: true, latest }), false)
})

// ---- idempotency decision (brief §3.2 / §3.3) ----
test('reuseIfExists: existing row → reuse, no insert', () => {
  assert.deepEqual(reuseIfExists({ id: 'q1', status: 'queued' }), { reuse: true, row: { id: 'q1', status: 'queued' } })
})
test('reuseIfExists: nothing → do insert', () => {
  assert.deepEqual(reuseIfExists(null), { reuse: false, row: null })
})
