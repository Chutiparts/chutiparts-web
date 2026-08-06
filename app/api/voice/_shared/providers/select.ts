// app/api/voice/_shared/providers/select.ts
// PURE provider selection (no I/O, no impl imports) → unit-testable + standalone-loadable.
import type { ProviderName } from './types'

export const KNOWN_PROVIDERS: readonly ProviderName[] = ['iapp', 'selfhost']

// Pilot default = iapp (cloud); flip to selfhost (Typhoon/NECTEC) later via env, no code change.
export const DEFAULT_STT_PROVIDER: ProviderName = 'iapp'
export const DEFAULT_TTS_PROVIDER: ProviderName = 'iapp'

// Map a config string (e.g. SABAI_STT_PROVIDER) → provider name; unknown/empty → fallback.
export function resolveProviderName(raw: string | undefined, fallback: ProviderName): ProviderName {
  const v = (raw || '').trim().toLowerCase()
  return (KNOWN_PROVIDERS as readonly string[]).includes(v) ? (v as ProviderName) : fallback
}
