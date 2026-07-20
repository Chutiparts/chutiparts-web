// TARGET PATH: lib/ai-tools.ts
// MCP Lite / AI Tool Layer — Phase 1 shared helpers (READ-ONLY)
// - token auth (Bearer) + kill switch (AI_TOOL_ENABLED=false)
// - audit log to ai_tool_calls: token HASH prefix only (never raw token) + sanitized params (no PII)
// - PII mask helpers (phone/email/line) — customer contact masked by default
// NOTE: additive · does not touch existing UI/logic · no write to business tables

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'

// service-role client (server-only) — same env convention as existing /api/leads route
export function aiSupa(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// short, non-reversible id for a token — safe to store/log
export function tokenId(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12)
}

export type AuthOk = { ok: true; tid: string }
export type AuthErr = { ok: false; res: NextResponse }

// checkAuth: enforces kill switch + bearer token. Returns tid (hash prefix) on success.
export function checkAuth(req: NextRequest): AuthOk | AuthErr {
  if (process.env.AI_TOOL_ENABLED === 'false') {
    return { ok: false, res: NextResponse.json({ v: 1, enabled: false, error: 'disabled' }, { status: 503 }) }
  }
  const expected = process.env.AI_TOOL_TOKEN
  if (!expected) {
    return { ok: false, res: NextResponse.json({ v: 1, error: 'server_misconfig' }, { status: 500 }) }
  }
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  const got = m ? m[1] : ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  const same = a.length === b.length && timingSafeEqual(a, b)
  if (!same) {
    return { ok: false, res: NextResponse.json({ v: 1, error: 'unauthorized' }, { status: 401 }) }
  }
  return { ok: true, tid: tokenId(expected) }
}

// only these param keys may enter the audit log — anything else (incl. any customer field) is dropped
const SAFE_PARAM_KEYS = new Set(['q', 'model', 'top', 'owner', 'max_age'])
export function sanitizeParams(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p || {})) {
    if (!SAFE_PARAM_KEYS.has(k)) continue
    if (typeof v === 'string') out[k] = v.slice(0, 80)
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v
  }
  return out
}

// best-effort audit — NEVER throws (must not break the read), NEVER stores raw token or PII
export async function audit(
  supa: SupabaseClient | null,
  tid: string,
  tool: string,
  params: Record<string, unknown>,
  resultCount: number,
): Promise<void> {
  try {
    if (!supa) return
    await supa.from('ai_tool_calls').insert({
      tool,
      token_id: tid,
      params: sanitizeParams(params),
      result_count: resultCount,
    })
  } catch (e) {
    console.error('[ai-tools] audit failed:', (e as Error)?.message)
  }
}

// ---- PII masking (customer contact hidden by default) ----
export function maskPhone(v?: string | null): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (s.length <= 4) return '***'
  return s.slice(0, 3) + '****' + s.slice(-2)
}
export function maskEmail(v?: string | null): string | null {
  if (!v) return null
  const s = String(v).trim()
  const at = s.indexOf('@')
  if (at <= 1) return '***'
  return s[0] + '***' + s.slice(at)
}
// a single masked contact hint for a lead — never returns a full phone/email/line
export function contactMasked(l: any): string | null {
  if (l?.line_id) return 'LINE ' + String(l.line_id).slice(0, 2) + '***'
  if (l?.phone) return maskPhone(l.phone)
  if (l?.email) return maskEmail(l.email)
  return null
}

// ---- small shared utils ----
export const norm = (v: unknown): string => String(v ?? '').trim().toLowerCase()
export function daysSince(d?: string | null): number {
  if (!d) return 0
  const t = new Date(d).getTime()
  if (isNaN(t)) return 0
  return Math.floor((Date.now() - t) / 86400000)
}
export const noStore = { 'Cache-Control': 'no-store' as const }
