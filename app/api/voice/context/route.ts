// app/api/voice/context/route.ts — GET /api/voice/context (brief §3.1)
// Orchestrator pulls everything the AI needs to speak, BEFORE dialing.
// consent.granted is ALWAYS returned (orchestrator uses it as the dial gate, §4).
import { type NextRequest } from 'next/server'
import { ok, fail } from '../_shared/responses'
import { parseContactLeadQuery } from '../_shared/schema'
import { svc, getLatestConsent, SABAI_STUB_MODE, mockBusiness, mockOrder } from '../_shared/db'
import { consentAllows } from '../_shared/guardrails'
import type { ContextData } from '../_shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const parsed = parseContactLeadQuery(req.nextUrl.searchParams)
  if (!parsed.ok) return fail('VALIDATION_FAILED', parsed.message, parsed.details)
  const { contact_lead_id, order_id } = parsed.data

  const supa = svc()

  // --- customer identity (Catch #1: contact_leads is the customer) — REAL read ---
  let lead: any = null
  if (supa) {
    const { data } = await supa
      .from('contact_leads')
      .select('id, name, phone, line_id, business_id')
      .eq('id', contact_lead_id)
      .maybeSingle()
    lead = data
    if (!lead && !SABAI_STUB_MODE) return fail('NOT_FOUND', 'contact_lead_id not found')
    if (!lead && SABAI_STUB_MODE) lead = { id: contact_lead_id, name: null, phone: null, line_id: null, business_id: null }
  } else {
    if (!SABAI_STUB_MODE) return fail('INTERNAL', 'db unavailable')
    lead = { id: contact_lead_id, name: null, phone: null, line_id: null, business_id: null }
  }

  // --- consent (consent-first, fail-closed lookup) — REAL read, never mocked ---
  const consentLookup = await getLatestConsent(supa, contact_lead_id)
  const granted = consentAllows(consentLookup)
  const latest = consentLookup.ok ? consentLookup.latest : null

  // --- business (REAL read; mock the row in stub if absent — orchestrator boundary) ---
  let business: ContextData['business'] = null
  const businessId = lead.business_id ?? null
  if (supa && businessId) {
    const { data: biz } = await supa.from('businesses').select('id, name').eq('id', businessId).maybeSingle()
    business = biz ? { business_id: biz.id, name: biz.name || 'ChutiBenz', vertical: 'auto_parts' } : (SABAI_STUB_MODE ? mockBusiness(businessId) : null)
  } else if (SABAI_STUB_MODE) {
    business = mockBusiness(businessId)
  }

  // --- order (optional; REAL read; mock in stub if absent) ---
  let order: ContextData['order'] = null
  if (order_id) {
    if (supa) {
      const { data: o } = await supa.from('orders').select('id, status, item_count, items').eq('id', order_id).maybeSingle()
      if (o) {
        const itemsCount = Number(o.item_count ?? (Array.isArray(o.items) ? o.items.length : 0)) || 0
        order = { order_id: o.id, status: o.status || 'unknown', summary: `อะไหล่ ${itemsCount} รายการ`, items_count: itemsCount }
      } else if (SABAI_STUB_MODE) order = mockOrder(order_id)
    } else if (SABAI_STUB_MODE) order = mockOrder(order_id)
  }

  const data: ContextData = {
    customer: {
      contact_lead_id,
      display_name: lead.name ?? null,
      phone_e164: lead.phone ?? null, // TODO(orchestrator): normalize to strict E.164 before dialing
      business_id: businessId,
    },
    business,
    order,
    consent: {
      granted,
      captured_at: latest?.captured_at ?? null,
      consent_text_version: latest?.consent_text_version ?? null,
    },
    script_hint: order?.status === 'ready_for_pickup' ? 'arrival_ready_for_pickup' : 'arrival_notify',
  }
  return ok(data)
}
