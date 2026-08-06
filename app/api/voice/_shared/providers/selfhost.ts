// app/api/voice/_shared/providers/selfhost.ts
// Self-hosted STT/TTS (Typhoon / NECTEC) — the eventual target for data residency + cost.
// PLACEHOLDER only: not built yet. Always returns NOT_IMPLEMENTED; never touches network.
// Selectable now (SABAI_STT_PROVIDER=selfhost) so the wiring/config path is proven early.
import type {
  SttProvider, TtsProvider, TranscribeInput, TranscribeResult, SynthesizeInput, SynthesizeResult,
} from './types'

export class SelfhostStt implements SttProvider {
  readonly name = 'selfhost' as const
  async transcribe(_input: TranscribeInput): Promise<TranscribeResult> {
    // TODO(self-host): call Typhoon/NECTEC STT service (endpoint via env once deployed).
    return { ok: false, provider: 'selfhost', error: { code: 'NOT_IMPLEMENTED', message: 'self-host STT (Typhoon/NECTEC) not built yet' } }
  }
}

export class SelfhostTts implements TtsProvider {
  readonly name = 'selfhost' as const
  async synthesize(_input: SynthesizeInput): Promise<SynthesizeResult> {
    // TODO(self-host): call self-hosted TTS; store audio self-host; return audioRef.
    return { ok: false, provider: 'selfhost', error: { code: 'NOT_IMPLEMENTED', message: 'self-host TTS not built yet' } }
  }
}
