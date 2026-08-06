// app/api/voice/_shared/db.ts
// Supabase service-role client + consent lookup. DB is REAL even in stub mode —
// SABAI_STUB_MODE only stubs the orchestrator/telephony boundary (brief §1.3/§2.1).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { latestConsent, type ConsentLookup } from './guardrails'
import type { ConsentRow } from './types'

// Stub the ORCHESTRATOR/TELEPHONY edge only — never the database (brief §1.3).
// Default ON: true unless explicitly set to 'false'.
export const SABAI_STUB_MODE = process.env.SABAI_STUB_MODE !== 'false'

export function svc(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// Consent-first, FAIL-CLOSED lookup (brief §2.1/§3.4/§4).
// Any failure to read the table → { ok:false, reason:'unavailable' } so callers reject.
// Never fabricates a granted consent, even in stub mode.
export async function getLatestConsent(supa: SupabaseClient | null, contactLeadId: string): Promise<ConsentLookup> {
  if (!supa) return { ok: false, reason: 'unavailable' }
  try {
    const { data, error } = await supa
      .from('voice_consent_log')
      .select('contact_lead_id, granted, captured_at, consent_text_version')
      .eq('contact_lead_id', contactLeadId)
      .order('captured_at', { ascending: false })
      .limit(5)
    if (error) return { ok: false, reason: 'unavailable' } // table missing / RLS / transport → fail-closed
    return { ok: true, latest: latestConsent((data || []) as ConsentRow[]) }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

// ---- stub mocks for the orchestrator boundary (business/order rows only) ----
// Customer identity + consent are NEVER mocked (real tables); these fill gaps so
// curl works in stub mode when a business/order row is absent (brief §3.1).
export function mockBusiness(businessId: string | null) {
  return { business_id: businessId, name: 'ChutiBenz', vertical: 'auto_parts' as const }
}
export function mockOrder(orderId: string) {
  return { order_id: orderId, status: 'ready_for_pickup', summary: 'อะไหล่ (mock)', items_count: 0 }
}
