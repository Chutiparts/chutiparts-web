// app/api/voice/_shared/providers/providers.test.ts
// Run: node --test app/api/voice/_shared/providers/*.test.ts
// No network: adapters are skeletons; tests only assert selection + result contracts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveProviderName, DEFAULT_STT_PROVIDER, KNOWN_PROVIDERS } from './select.ts'
import { IappStt, IappTts, isConfigured, IAPP_API_KEY_ENV } from './iapp.ts'
import { SelfhostStt, SelfhostTts } from './selfhost.ts'

// ---- provider selection by config (spec §3.4) ----
test('resolveProviderName: exact names', () => {
  assert.equal(resolveProviderName('iapp', DEFAULT_STT_PROVIDER), 'iapp')
  assert.equal(resolveProviderName('selfhost', DEFAULT_STT_PROVIDER), 'selfhost')
})
test('resolveProviderName: case-insensitive + trimmed', () => {
  assert.equal(resolveProviderName('  IApp ', 'selfhost'), 'iapp')
})
test('resolveProviderName: unknown/empty/undefined → fallback', () => {
  assert.equal(resolveProviderName('bogus', 'selfhost'), 'selfhost')
  assert.equal(resolveProviderName('', 'iapp'), 'iapp')
  assert.equal(resolveProviderName(undefined, 'selfhost'), 'selfhost')
})
test('KNOWN_PROVIDERS is exactly iapp + selfhost', () => {
  assert.deepEqual([...KNOWN_PROVIDERS].sort(), ['iapp', 'selfhost'])
})

// ---- iApp adapter: env-gated, never networks ----
test('iApp STT: no key → NOT_CONFIGURED (real call gated off)', async () => {
  const prev = process.env[IAPP_API_KEY_ENV]
  delete process.env[IAPP_API_KEY_ENV]
  assert.equal(isConfigured(), false)
  const r = await new IappStt().transcribe({ audioRef: 'storage://x', languageHint: 'th' })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.error.code, 'NOT_CONFIGURED')
  assert.equal(r.provider, 'iapp')
  if (prev !== undefined) process.env[IAPP_API_KEY_ENV] = prev
})

test('iApp STT/TTS: key present → NOT_IMPLEMENTED (no guessed API, no network)', async () => {
  const prev = process.env[IAPP_API_KEY_ENV]
  process.env[IAPP_API_KEY_ENV] = 'test-key'
  assert.equal(isConfigured(), true)
  const s = await new IappStt().transcribe({ audioRef: 'storage://x' })
  const t = await new IappTts().synthesize({ text: 'สวัสดีครับ' })
  assert.equal(s.ok, false)
  if (!s.ok) assert.equal(s.error.code, 'NOT_IMPLEMENTED')
  assert.equal(t.ok, false)
  if (!t.ok) assert.equal(t.error.code, 'NOT_IMPLEMENTED')
  if (prev === undefined) delete process.env[IAPP_API_KEY_ENV]; else process.env[IAPP_API_KEY_ENV] = prev
})

// ---- self-host placeholder ----
test('self-host STT/TTS: NOT_IMPLEMENTED placeholder', async () => {
  const s = await new SelfhostStt().transcribe({ audioRef: 'storage://x' })
  const t = await new SelfhostTts().synthesize({ text: 'hi' })
  assert.equal(s.ok, false)
  if (!s.ok) assert.equal(s.error.code, 'NOT_IMPLEMENTED')
  assert.equal(t.ok, false)
  if (!t.ok) assert.equal(t.error.code, 'NOT_IMPLEMENTED')
})

// ---- interface contract (name + shape) ----
test('providers expose the right name', () => {
  assert.equal(new IappStt().name, 'iapp')
  assert.equal(new IappTts().name, 'iapp')
  assert.equal(new SelfhostStt().name, 'selfhost')
  assert.equal(new SelfhostTts().name, 'selfhost')
})
