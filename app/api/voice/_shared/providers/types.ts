// app/api/voice/_shared/providers/types.ts
// STT/TTS provider abstraction — TYPES ONLY (no runtime values), so importers use
// `import type` and Node's test runner erases them (same rule as the voice _shared layer).
//
// Goal (spec §3.4 / §196): swap STT/TTS provider with ONE config value, business logic
// unchanged. Methods return a discriminated result (never throw) so there is no shared
// runtime error class to import — keeps each impl standalone-loadable by `node --test`.

export type ProviderName = 'iapp' | 'selfhost'

export type ProviderErrorCode =
  | 'NOT_CONFIGURED'  // env/credentials missing → real call disabled (stub)
  | 'NOT_IMPLEMENTED' // adapter not built yet (awaiting API docs / self-host)
  | 'PROVIDER_ERROR'  // real provider returned an error (once implemented)

export type ProviderErrorInfo = { code: ProviderErrorCode; message: string }

// ---- STT ----
export type TranscribeInput = {
  audioRef: string          // reference to self-hosted audio (never inline bytes — data residency)
  languageHint?: string     // e.g. 'th'
}
export type TranscribeResult =
  | { ok: true; text: string; confidence: number; provider: ProviderName }
  | { ok: false; error: ProviderErrorInfo; provider: ProviderName }

export interface SttProvider {
  readonly name: ProviderName
  transcribe(input: TranscribeInput): Promise<TranscribeResult>
}

// ---- TTS ----
export type SynthesizeInput = {
  text: string
  voice?: string
}
export type SynthesizeResult =
  | { ok: true; audioRef: string; provider: ProviderName } // returns a ref, not audio bytes
  | { ok: false; error: ProviderErrorInfo; provider: ProviderName }

export interface TtsProvider {
  readonly name: ProviderName
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>
}
