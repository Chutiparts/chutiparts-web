// app/api/voice/consent/route.ts — POST + GET /api/voice/consent (brief §3.4, PDPA ม.19)
// Append-only consent ledger. POST records a consent event; GET returns the latest.
// consent read/write hit REAL tables even in stub mode (brief §1.3).
import { type NextRequest } from 'next/server'
import { ok, fail } from '../_shared/responses'
import { parseConsent, parseContactLeadQuery } from '../_shared/schema'
import { svc, getLatestConsent, SABAI_STUB_MODE } from '../_shared/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST — record a consent event (append-only; never updates an old row, §3.4)
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return fail('VALIDATION_FAILED', 'invalid JSON body') }

  const parsed = parseConsent(body)
  if (!parsed.ok) return fail('VALIDATION_FAILED', parsed.message, parsed.details)
  const b = parsed.data

  const supa = svc()
  if (supa) {
    const { data, error } = await supa.from('voice_consent_log').insert({
      contact_lead_id: b.contact_lead_id,
      channel: b.channel,
      granted: b.granted,
      consent_text_version: b.consent_text_version,
      method: b.method,
      captured_at: b.captured_at,
    }).select('id').single()
    if (!error && data) return ok({ consent_id: data.id, granted: b.granted })
    if (!SABAI_STUB_MODE) return fail('INTERNAL', 'consent write failed', { db: error?.message })
  }
  // stub fallback (DB unavailable) — schema-valid mock
  return ok({ consent_id: `stub-${b.contact_lead_id}`, granted: b.granted })
}

// GET — latest consent for a contact_lead_id (used by /context and /trigger-call via getLatestConsent)
export async function GET(req: NextRequest) {
  const parsed = parseContactLeadQuery(req.nextUrl.searchParams)
  if (!parsed.ok) return fail('VALIDATION_FAILED', parsed.message, parsed.details)

  const supa = svc()
  const lookup = await getLatestConsent(supa, parsed.data.contact_lead_id)
  if (!lookup.ok) return fail('INTERNAL', 'consent log unreadable')
  const latest = lookup.latest
  return ok({
    granted: latest?.granted ?? false,
    captured_at: latest?.captured_at ?? null,
    consent_text_version: latest?.consent_text_version ?? null,
  })
}
