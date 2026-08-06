// app/api/voice/trigger-call/route.ts — POST /api/voice/trigger-call (brief §3.2)
// Enqueue an outbound call. Does NOT dial (just enqueues). Guardrails:
//  - consent-first, REAL + FAIL-CLOSED even in stub mode (reject if consent unreadable)
//  - idempotent on idempotency_key (no duplicate queued calls)
//  - trigger_source pinned to orders_ready_for_pickup (Catch #2, enforced in schema)
import { type NextRequest } from 'next/server'
import { ok, fail } from '../_shared/responses'
import { parseTriggerCall } from '../_shared/schema'
import { svc, getLatestConsent, SABAI_STUB_MODE } from '../_shared/db'
import { consentAllows, reuseIfExists } from '../_shared/guardrails'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return fail('VALIDATION_FAILED', 'invalid JSON body') }

  // 1) validate
  const parsed = parseTriggerCall(body)
  if (!parsed.ok) return fail('VALIDATION_FAILED', parsed.message, parsed.details)
  const b = parsed.data

  const supa = svc()

  // 2) idempotency: reuse an existing queued row for this key (never insert twice)
  if (supa) {
    const { data: existing, error } = await supa
      .from('call_queue')
      .select('id, status')
      .eq('idempotency_key', b.idempotency_key)
      .maybeSingle()
    if (!error) {
      const hit = reuseIfExists(existing)
      if (hit.reuse && hit.row) return ok({ call_queue_id: hit.row.id, status: hit.row.status })
    }
  }

  // 3) consent-first — REAL check, FAIL-CLOSED (unavailable/empty/not-granted → reject)
  const consent = await getLatestConsent(supa, b.contact_lead_id)
  if (!consentAllows(consent)) {
    const why = consent.ok ? 'no granted voice consent on file' : 'consent log unreadable — refusing (fail-closed)'
    return fail('CONSENT_REQUIRED', why)
  }

  // 4) enqueue (status=queued). Never dials here.
  if (supa) {
    const { data: inserted, error } = await supa
      .from('call_queue')
      .insert({
        idempotency_key: b.idempotency_key,
        contact_lead_id: b.contact_lead_id,
        order_id: b.order_id,
        business_id: b.business_id,
        intent_type: b.intent_type,
        trigger_source: b.trigger_source,
        status: 'queued',
        requested_by: b.requested_by,
      })
      .select('id, status')
      .single()
    if (!error && inserted) return ok({ call_queue_id: inserted.id, status: inserted.status })
    // Unique-violation race on idempotency_key → treat as idempotent hit
    const { data: raced } = await supa.from('call_queue').select('id, status').eq('idempotency_key', b.idempotency_key).maybeSingle()
    if (raced) return ok({ call_queue_id: raced.id, status: raced.status })
    if (!SABAI_STUB_MODE) return fail('INTERNAL', 'enqueue failed', { db: error?.message })
  }

  // stub fallback (DB unavailable but consent already enforced) — schema-valid mock id
  return ok({ call_queue_id: `stub-${b.idempotency_key}`, status: 'queued' })
}
