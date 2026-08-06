// app/api/voice/_shared/schema.ts
// Input validation for the 4 voice endpoints + the runtime enum arrays (single
// source of truth for the union types in types.ts).
//
// NOTE ON ZOD: the brief names Zod, but adding the dependency means editing
// package.json / lockfile — outside this slice's allowed scope (`app/api/voice/**`
// + README.voice.md) and against its "zero new dependency" intent. So this is a
// tiny self-contained validator with a Zod-like `safeParse` contract. Swapping in
// real Zod later is a drop-in at THIS file only (routes just call `parseX`).
//
// IMPORTS: only `import type` from ./types (erased at runtime) so `node --test` can
// load this module standalone — no runtime relative import to resolve.
import type { TriggerCallBody, CallResultBody, ConsentBody } from './types'

// ---- runtime enum arrays (source of truth; types.ts derives its unions from these) ----
export const INTENT_TYPES = ['arrival_notify', 'order_confirm'] as const
export const CALL_STATUSES = ['queued', 'dialing', 'completed', 'failed', 'cancelled'] as const
export const OUTCOMES = ['answered', 'no_answer', 'busy', 'failed'] as const
export const INTENTS = ['confirmed', 'declined', 'reschedule', 'unclear'] as const
export const CONSENT_METHODS = ['ivr', 'agent', 'web'] as const
// Catch #2 single seam: to trigger off stock arrival instead, widen this array + its check.
export const TRIGGER_SOURCES = ['orders_ready_for_pickup'] as const

export type IntentType = (typeof INTENT_TYPES)[number]
export type CallStatus = (typeof CALL_STATUSES)[number]
export type Outcome = (typeof OUTCOMES)[number]
export type Intent = (typeof INTENTS)[number]
export type ConsentMethod = (typeof CONSENT_METHODS)[number]
export type TriggerSource = (typeof TRIGGER_SOURCES)[number]

export type ParseResult<T> = { ok: true; data: T } | { ok: false; message: string; details: { issues: string[] } }

const fail = (issues: string[]): ParseResult<never> => ({ ok: false, message: 'validation failed', details: { issues } })
const okr = <T>(data: T): ParseResult<T> => ({ ok: true, data })

// ---- primitive checks (collect all issues, don't throw) ----
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const nonEmptyStr = (v: unknown) => typeof v === 'string' && v.trim() !== ''
const inSet = <T extends string>(v: unknown, set: readonly T[]) => typeof v === 'string' && (set as readonly string[]).includes(v)

function reqStr(body: Record<string, unknown>, k: string, issues: string[], max = 500): string {
  const v = body[k]
  if (!nonEmptyStr(v)) { issues.push(`${k}: required non-empty string`); return '' }
  return (v as string).trim().slice(0, max)
}
function optStr(body: Record<string, unknown>, k: string, max = 500): string | null {
  const v = body[k]
  return nonEmptyStr(v) ? (v as string).trim().slice(0, max) : null
}

// ---- POST /trigger-call ----
export function parseTriggerCall(input: unknown): ParseResult<TriggerCallBody> {
  if (!isObj(input)) return fail(['body: expected object'])
  const issues: string[] = []
  const idempotency_key = reqStr(input, 'idempotency_key', issues, 200)
  const contact_lead_id = reqStr(input, 'contact_lead_id', issues, 100)
  const business_id = reqStr(input, 'business_id', issues, 100)
  if (!inSet(input.intent_type, INTENT_TYPES)) issues.push(`intent_type: one of ${INTENT_TYPES.join('|')}`)
  if (!inSet(input.trigger_source, TRIGGER_SOURCES)) issues.push(`trigger_source: must be ${TRIGGER_SOURCES.join('|')} (Catch #2)`)
  if ('customer_id' in input) issues.push('customer_id: forbidden — use contact_lead_id (Catch #1)')
  if ('stock_movement_id' in input) issues.push('stock_movement_id: forbidden — use order_id (Catch #2)')
  if (issues.length) return fail(issues)
  return okr({
    idempotency_key, contact_lead_id, business_id,
    intent_type: input.intent_type as TriggerCallBody['intent_type'],
    trigger_source: input.trigger_source as TriggerCallBody['trigger_source'],
    order_id: optStr(input, 'order_id', 100),
    requested_by: optStr(input, 'requested_by', 150),
  })
}

// ---- POST /call-result ----
export function parseCallResult(input: unknown): ParseResult<CallResultBody> {
  if (!isObj(input)) return fail(['body: expected object'])
  const issues: string[] = []
  const voice_call_log_id = reqStr(input, 'voice_call_log_id', issues, 100)
  const contact_lead_id = reqStr(input, 'contact_lead_id', issues, 100)
  if (!inSet(input.outcome, OUTCOMES)) issues.push(`outcome: one of ${OUTCOMES.join('|')}`)
  if (!inSet(input.intent, INTENTS)) issues.push(`intent: one of ${INTENTS.join('|')}`)
  const conf = Number(input.stt_confidence)
  if (!Number.isFinite(conf) || conf < 0 || conf > 1) issues.push('stt_confidence: number in [0,1]')
  const dur = input.duration_sec == null ? null : Number(input.duration_sec)
  if (dur != null && (!Number.isFinite(dur) || dur < 0)) issues.push('duration_sec: number >= 0')
  const cost = input.cost_thb == null ? null : Number(input.cost_thb)
  if (cost != null && (!Number.isFinite(cost) || cost < 0)) issues.push('cost_thb: number >= 0')
  if ('customer_id' in input) issues.push('customer_id: forbidden — use contact_lead_id (Catch #1)')
  if ('stock_movement_id' in input) issues.push('stock_movement_id: forbidden — use order_id (Catch #2)')
  if (issues.length) return fail(issues)
  return okr({
    voice_call_log_id, contact_lead_id,
    call_queue_id: optStr(input, 'call_queue_id', 100),
    order_id: optStr(input, 'order_id', 100),
    outcome: input.outcome as CallResultBody['outcome'],
    intent: input.intent as CallResultBody['intent'],
    stt_confidence: conf,
    transcript_ref: optStr(input, 'transcript_ref', 500),
    duration_sec: dur,
    cost_thb: cost,
  })
}

// ---- POST /consent ----
export function parseConsent(input: unknown): ParseResult<ConsentBody> {
  if (!isObj(input)) return fail(['body: expected object'])
  const issues: string[] = []
  const contact_lead_id = reqStr(input, 'contact_lead_id', issues, 100)
  const consent_text_version = reqStr(input, 'consent_text_version', issues, 50)
  const captured_at = reqStr(input, 'captured_at', issues, 40)
  if (captured_at && Number.isNaN(Date.parse(captured_at))) issues.push('captured_at: must be an ISO timestamp')
  if (input.channel !== 'voice') issues.push("channel: must be 'voice'")
  if (typeof input.granted !== 'boolean') issues.push('granted: required boolean')
  if (!inSet(input.method, CONSENT_METHODS)) issues.push(`method: one of ${CONSENT_METHODS.join('|')}`)
  if ('customer_id' in input) issues.push('customer_id: forbidden — use contact_lead_id (Catch #1)')
  if (issues.length) return fail(issues)
  return okr({
    contact_lead_id, consent_text_version, captured_at,
    channel: 'voice',
    granted: input.granted as boolean,
    method: input.method as ConsentBody['method'],
  })
}

// ---- GET query: contact_lead_id (shared by /context and /consent GET) ----
export function parseContactLeadQuery(sp: URLSearchParams): ParseResult<{ contact_lead_id: string; order_id: string | null }> {
  const id = (sp.get('contact_lead_id') || '').trim()
  if (!id) return fail(['contact_lead_id: required query param'])
  if (sp.get('customer_id')) return fail(['customer_id: forbidden — use contact_lead_id (Catch #1)'])
  const order_id = (sp.get('order_id') || '').trim() || null
  return okr({ contact_lead_id: id.slice(0, 100), order_id: order_id ? order_id.slice(0, 100) : null })
}
