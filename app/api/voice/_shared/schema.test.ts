// app/api/voice/_shared/schema.test.ts
// Run: node --test app/api/voice/_shared/*.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTriggerCall, parseCallResult, parseConsent, parseContactLeadQuery } from './schema.ts'

// ---- trigger-call validation (brief §3.2 / §7.1) ----
test('trigger-call: valid body passes', () => {
  const r = parseTriggerCall({
    idempotency_key: 'k1', contact_lead_id: 'lead-1', business_id: 'biz-1',
    intent_type: 'arrival_notify', trigger_source: 'orders_ready_for_pickup', order_id: 'o1',
  })
  assert.equal(r.ok, true)
})

test('trigger-call: missing idempotency_key → fail', () => {
  const r = parseTriggerCall({ contact_lead_id: 'l', business_id: 'b', intent_type: 'arrival_notify', trigger_source: 'orders_ready_for_pickup' })
  assert.equal(r.ok, false)
  if (!r.ok) assert.ok(r.details.issues.some((i) => i.startsWith('idempotency_key')))
})

test('trigger-call: bad trigger_source → fail (Catch #2 pinned)', () => {
  const r = parseTriggerCall({ idempotency_key: 'k', contact_lead_id: 'l', business_id: 'b', intent_type: 'order_confirm', trigger_source: 'stock_movements_arrived' })
  assert.equal(r.ok, false)
})

test('trigger-call: customer_id present → fail (Catch #1 forbidden)', () => {
  const r = parseTriggerCall({ idempotency_key: 'k', customer_id: 'c', contact_lead_id: 'l', business_id: 'b', intent_type: 'arrival_notify', trigger_source: 'orders_ready_for_pickup' })
  assert.equal(r.ok, false)
  if (!r.ok) assert.ok(r.details.issues.some((i) => i.startsWith('customer_id')))
})

test('trigger-call: stock_movement_id present → fail (Catch #2 forbidden)', () => {
  const r = parseTriggerCall({ idempotency_key: 'k', stock_movement_id: 'm', contact_lead_id: 'l', business_id: 'b', intent_type: 'arrival_notify', trigger_source: 'orders_ready_for_pickup' })
  assert.equal(r.ok, false)
})

// ---- call-result validation ----
test('call-result: valid body passes', () => {
  const r = parseCallResult({ voice_call_log_id: 'vcl1', contact_lead_id: 'l', outcome: 'answered', intent: 'confirmed', stt_confidence: 0.9 })
  assert.equal(r.ok, true)
})

test('call-result: confidence out of [0,1] → fail', () => {
  const r = parseCallResult({ voice_call_log_id: 'v', contact_lead_id: 'l', outcome: 'answered', intent: 'confirmed', stt_confidence: 1.5 })
  assert.equal(r.ok, false)
})

test('call-result: negative cost_thb → fail', () => {
  const r = parseCallResult({ voice_call_log_id: 'v', contact_lead_id: 'l', outcome: 'answered', intent: 'confirmed', stt_confidence: 0.9, cost_thb: -1 })
  assert.equal(r.ok, false)
})

// ---- consent validation ----
test('consent: valid body passes', () => {
  const r = parseConsent({ contact_lead_id: 'l', channel: 'voice', granted: true, consent_text_version: 'v1', method: 'ivr', captured_at: '2026-08-06T00:00:00Z' })
  assert.equal(r.ok, true)
})

test('consent: granted not boolean → fail', () => {
  const r = parseConsent({ contact_lead_id: 'l', channel: 'voice', granted: 'yes', consent_text_version: 'v1', method: 'ivr', captured_at: '2026-08-06T00:00:00Z' })
  assert.equal(r.ok, false)
})

test('consent: bad captured_at → fail', () => {
  const r = parseConsent({ contact_lead_id: 'l', channel: 'voice', granted: true, consent_text_version: 'v1', method: 'ivr', captured_at: 'not-a-date' })
  assert.equal(r.ok, false)
})

// ---- GET query ----
test('query: missing contact_lead_id → fail', () => {
  assert.equal(parseContactLeadQuery(new URLSearchParams('')).ok, false)
})
test('query: customer_id present → fail (Catch #1)', () => {
  assert.equal(parseContactLeadQuery(new URLSearchParams('contact_lead_id=l&customer_id=c')).ok, false)
})
test('query: contact_lead_id present → ok', () => {
  const r = parseContactLeadQuery(new URLSearchParams('contact_lead_id=l&order_id=o'))
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.data.order_id, 'o')
})
