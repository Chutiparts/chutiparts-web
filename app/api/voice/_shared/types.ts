// app/api/voice/_shared/types.ts
// SabAI F1 voice — shared contract TYPES ONLY (no runtime values, so every importer
// can `import type` and Node's test runner erases it — see schema.ts for the runtime
// enum arrays, and README.voice.md "Testability & imports").
//
// 🔴 Catch #1 (no `customers` table): the customer is referenced ONLY by
//    `contact_lead_id` → contact_leads.id. Identity-model seam = `CustomerRef` here.
//    Never introduce `customer_id`.
// 🔴 Catch #2 (arrival trigger decoupled from receive-ledger): F1 triggers off
//    orders.status='ready_for_pickup'. Trigger-source seam = `TRIGGER_SOURCES` in
//    schema.ts. Payloads carry `order_id`, never `stock_movement_id`.
import type { IntentType, TriggerSource, Outcome, Intent, ConsentMethod } from './schema'

// ---- Catch #1: the single identity-model seam ----
export type CustomerRef = { contact_lead_id: string }

// ---- decision routing target (human-in-loop) — see guardrails.routeCallResult ----
export type DecisionStatus = 'pending_review' | 'need_human_followup'

// ---- error codes (brief §3) ----
export type ErrorCode =
  | 'VALIDATION_FAILED' // 400
  | 'CONSENT_REQUIRED'  // 409
  | 'NOT_FOUND'         // 404
  | 'INTENT_UNCLEAR'    // 200 + flag (not an error envelope)
  | 'INTERNAL'          // 500

// ---- response envelope (brief §3) ----
export type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; details?: unknown } }

// ---- request payloads ----
export type TriggerCallBody = CustomerRef & {
  idempotency_key: string
  order_id?: string | null
  business_id: string
  intent_type: IntentType
  trigger_source: TriggerSource
  requested_by?: string | null
}

export type CallResultBody = CustomerRef & {
  call_queue_id?: string | null
  voice_call_log_id: string
  order_id?: string | null
  outcome: Outcome
  intent: Intent
  stt_confidence: number
  transcript_ref?: string | null
  duration_sec?: number | null
  cost_thb?: number | null
}

export type ConsentBody = CustomerRef & {
  channel: 'voice'
  granted: boolean
  consent_text_version: string
  method: ConsentMethod
  captured_at: string
}

// ---- DB row shapes we read ----
export type ConsentRow = {
  contact_lead_id: string
  granted: boolean
  captured_at: string
  consent_text_version: string
}

// ---- response bodies ----
export type ContextData = {
  customer: { contact_lead_id: string; display_name: string | null; phone_e164: string | null; business_id: string | null }
  business: { business_id: string | null; name: string; vertical: string } | null
  order: { order_id: string; status: string; summary: string; items_count: number } | null
  consent: { granted: boolean; captured_at: string | null; consent_text_version: string | null }
  script_hint: string
}
