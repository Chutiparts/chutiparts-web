// app/api/voice/_shared/providers/index.ts
// Factory — ONE config value picks the provider; callers never know which vendor (spec §3.4/§196).
//   SABAI_STT_PROVIDER = iapp | selfhost   (default iapp)
//   SABAI_TTS_PROVIDER = iapp | selfhost   (default iapp)
//
// Thin glue: `resolveProviderName` (tested in select.ts) + the impls (tested in *.test.ts).
// Not standalone `node --test`-loaded because it value-imports the impls; its two branches
// are the composition of already-tested parts.
import type { SttProvider, TtsProvider } from './types'
import { resolveProviderName, DEFAULT_STT_PROVIDER, DEFAULT_TTS_PROVIDER } from './select'
import { IappStt, IappTts } from './iapp'
import { SelfhostStt, SelfhostTts } from './selfhost'

export function getSttProvider(env: NodeJS.ProcessEnv = process.env): SttProvider {
  const name = resolveProviderName(env.SABAI_STT_PROVIDER, DEFAULT_STT_PROVIDER)
  return name === 'selfhost' ? new SelfhostStt() : new IappStt()
}

export function getTtsProvider(env: NodeJS.ProcessEnv = process.env): TtsProvider {
  const name = resolveProviderName(env.SABAI_TTS_PROVIDER, DEFAULT_TTS_PROVIDER)
  return name === 'selfhost' ? new SelfhostTts() : new IappTts()
}

export type { SttProvider, TtsProvider } from './types'
