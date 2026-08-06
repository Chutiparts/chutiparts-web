// app/api/voice/_shared/guardrails.ts
// PURE guardrail logic (no I/O) so it is unit-testable with `node --test` (brief §4,§7.1).
import type { DecisionStatus, ConsentRow } from './types'
import type { Intent } from './schema'

// STT confidence gate for auto-routing to review (brief §3.3 / §6).
export const STT_CONFIDENCE_THRESHOLD = 0.85

export type CallResultRouting = 'review' | 'inbox'

// Human-in-loop routing: a clear intent with high confidence → pending_review;
// anything else (unclear intent OR low confidence) → need_human_followup (Inbox).
// NEVER returns anything that implies an auto-commit — both branches are human-review records.
export function routeCallResult(input: { intent: Intent; stt_confidence: number }): {
  routing: CallResultRouting
  decisionStatus: DecisionStatus
} {
  const clearIntent = input.intent === 'confirmed' || input.intent === 'declined' || input.intent === 'reschedule'
  const confident = Number(input.stt_confidence) >= STT_CONFIDENCE_THRESHOLD
  if (clearIntent && confident) return { routing: 'review', decisionStatus: 'pending_review' }
  return { routing: 'inbox', decisionStatus: 'need_human_followup' }
}

// Result of the consent lookup, kept explicit so "table unavailable" is a distinct
// state from "no consent row" — both must reject, but we log them differently.
export type ConsentLookup =
  | { ok: true; latest: ConsentRow | null }
  | { ok: false; reason: 'unavailable' }

// Consent-first gate (brief §2.1 / §4). FAIL-CLOSED: the ONLY path that allows a
// call is an explicit granted=true from a readable table. Unavailable → reject.
// Missing/empty → reject. "not-granted last" → reject.
export function consentAllows(lookup: ConsentLookup): boolean {
  return lookup.ok === true && lookup.latest?.granted === true
}

// Pick the newest consent row by captured_at (append-only log; "latest" wins, brief §3.4).
export function latestConsent(rows: ConsentRow[]): ConsentRow | null {
  let best: ConsentRow | null = null
  for (const r of rows) {
    if (!r || typeof r.captured_at !== 'string') continue
    if (!best || r.captured_at > best.captured_at) best = r
  }
  return best
}

// Idempotency decision (brief §3.2 / §3.3): if a prior row exists, reuse it; never insert twice.
export function reuseIfExists<T>(existing: T | null | undefined): { reuse: boolean; row: T | null } {
  return existing ? { reuse: true, row: existing } : { reuse: false, row: null }
}
