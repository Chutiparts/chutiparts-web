// app/api/voice/call-result/route.ts — POST /api/voice/call-result (brief §3.3)
// Orchestrator posts the outcome AFTER hangup. Writes voice_call_logs (cost EVERY
// call) + one ops_decisions row for human review. NEVER writes orders/sales_records/
// stock_movements (no money/stock auto-commit — pilot guardrail §4). Idempotent on
// voice_call_log_id (1 call = 1 result).
import { type NextRequest } from 'next/server'
import { ok, fail } from '../_shared/responses'
import { parseCallResult } from '../_shared/schema'
import { svc, SABAI_STUB_MODE } from '../_shared/db'
import { routeCallResult } from '../_shared/guardrails'
import type { DecisionStatus } from '../_shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const routedOf = (status: DecisionStatus): 'review' | 'inbox' => (status === 'pending_review' ? 'review' : 'inbox')

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return fail('VALIDATION_FAILED', 'invalid JSON body') }

  const parsed = parseCallResult(body)
  if (!parsed.ok) return fail('VALIDATION_FAILED', parsed.message, parsed.details)
  const b = parsed.data

  // human-in-loop routing (pure) — both branches are review records, never auto-commit
  const { decisionStatus } = routeCallResult({ intent: b.intent, stt_confidence: b.stt_confidence })

  const supa = svc()

  if (supa) {
    // idempotency on voice_call_log_id: if this call's log already exists, return its decision
    const { data: prior } = await supa.from('voice_call_logs').select('id').eq('id', b.voice_call_log_id).maybeSingle()
    if (prior) {
      const { data: dec } = await supa
        .from('ops_decisions').select('id, status').eq('voice_call_log_id', b.voice_call_log_id).maybeSingle()
      if (dec) return ok({ decision_id: dec.id, routed_to: routedOf((dec.status as DecisionStatus) ?? decisionStatus) })
      // log exists but decision missing (partial prior write) — fall through to (re)create the decision only
    } else {
      // 1) cost log EVERY call — id IS the supplied voice_call_log_id (natural idempotency)
      const { error: logErr } = await supa.from('voice_call_logs').insert({
        id: b.voice_call_log_id,
        call_queue_id: b.call_queue_id,
        contact_lead_id: b.contact_lead_id,
        order_id: b.order_id,
        outcome: b.outcome,
        intent: b.intent === 'unclear' ? null : b.intent,
        stt_confidence: b.stt_confidence,
        transcript_ref: b.transcript_ref, // reference only — never inline audio/transcript (data residency)
        duration_sec: b.duration_sec,
        cost_thb: b.cost_thb,
      })
      if (logErr && !SABAI_STUB_MODE) return fail('INTERNAL', 'voice_call_logs write failed', { db: logErr.message })
    }

    // 2) human-review decision (NO orders/sales/stock write)
    // ops_decisions.status is added by the migration slice (nullable text, no CHECK) alongside
    // source + voice_call_log_id — voice always sets pending_review | need_human_followup.
    const topic = `เสียง: ${b.intent}${b.order_id ? ` · ออเดอร์ ${String(b.order_id).slice(0, 8)}` : ''}`
    const reason = `outcome=${b.outcome} · confidence=${b.stt_confidence} → ${decisionStatus}`
    const { data: dec, error: decErr } = await supa.from('ops_decisions').insert({
      source: 'voice',
      voice_call_log_id: b.voice_call_log_id,
      status: decisionStatus,
      topic,
      reason,
    }).select('id').single()
    if (!decErr && dec) return ok({ decision_id: dec.id, routed_to: routedOf(decisionStatus) })
    if (!SABAI_STUB_MODE) return fail('INTERNAL', 'ops_decisions write failed', { db: decErr?.message })
  }

  // stub fallback (DB unavailable) — schema-valid mock; routing still computed for real
  return ok({ decision_id: `stub-${b.voice_call_log_id}`, routed_to: routedOf(decisionStatus) })
}
