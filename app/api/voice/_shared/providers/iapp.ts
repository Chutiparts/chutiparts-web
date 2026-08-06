// app/api/voice/_shared/providers/iapp.ts
// iApp Technology cloud STT/TTS adapter (pilot provider).
//
// ⚠️ SKELETON — the real HTTP calls are NOT implemented and NOT guessed. iApp's endpoint,
//    auth scheme, and response shapes are unknown until Owner provides the API docs + key.
//    Behaviour today (no network, ever):
//      - no IAPP_API_KEY   → NOT_CONFIGURED  (real call gated off, like SABAI_STUB_MODE)
//      - key present        → NOT_IMPLEMENTED (adapter pending API docs)
//    When implementing: guard the fetch behind `isConfigured()`, POST audioRef/text to the
//    iApp endpoint with the documented auth header, and map the response to the result type.
import type {
  SttProvider, TtsProvider, TranscribeInput, TranscribeResult, SynthesizeInput, SynthesizeResult,
} from './types'

export const IAPP_API_KEY_ENV = 'IAPP_API_KEY'
// TODO(iApp): set once docs arrive — e.g. process.env.IAPP_API_BASE || 'https://api.iapp.co.th'
export const IAPP_API_BASE_ENV = 'IAPP_API_BASE'

export function isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!(env[IAPP_API_KEY_ENV] && String(env[IAPP_API_KEY_ENV]).trim())
}

export class IappStt implements SttProvider {
  readonly name = 'iapp' as const
  async transcribe(_input: TranscribeInput): Promise<TranscribeResult> {
    if (!isConfigured()) {
      return { ok: false, provider: 'iapp', error: { code: 'NOT_CONFIGURED', message: `${IAPP_API_KEY_ENV} not set — iApp STT disabled (stub)` } }
    }
    // TODO(iApp): POST audio (via _input.audioRef) to iApp STT endpoint with auth; parse text + confidence.
    // Not implemented to avoid guessing the API. Never reaches network until filled in.
    return { ok: false, provider: 'iapp', error: { code: 'NOT_IMPLEMENTED', message: 'iApp STT adapter pending API docs' } }
  }
}

export class IappTts implements TtsProvider {
  readonly name = 'iapp' as const
  async synthesize(_input: SynthesizeInput): Promise<SynthesizeResult> {
    if (!isConfigured()) {
      return { ok: false, provider: 'iapp', error: { code: 'NOT_CONFIGURED', message: `${IAPP_API_KEY_ENV} not set — iApp TTS disabled (stub)` } }
    }
    // TODO(iApp): POST text to iApp TTS endpoint with auth; store audio self-host; return audioRef.
    return { ok: false, provider: 'iapp', error: { code: 'NOT_IMPLEMENTED', message: 'iApp TTS adapter pending API docs' } }
  }
}
