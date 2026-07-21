// TARGET PATH: lib/ai-tools.ts
// MCP Lite / AI Tool Layer — shared helpers (READ-ONLY)
// Phase 1: token auth (Bearer) + kill switch (AI_TOOL_ENABLED=false) + audit (ai_tool_calls, token hash + sanitized params) + PII mask
// Phase 2 (hardening): rate-limit (weighted/cost-aware) + cache/snapshot + fallback (serve snapshot on limit/slow/error · never hang)
// NOTE: additive · does not touch business tables (read-only) · no new menu

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'

// service-role client (server-only)
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

// checkAuth: kill switch + bearer token. Returns tid (hash prefix) on success.
export function checkAuth(req: NextRequest): AuthOk | AuthErr {
  if (process.env.AI_TOOL_ENABLED === 'false') {
    return { ok: false, res: NextResponse.json({ v: 1, enabled: false, error: 'disabled' }, { status: 503, headers: noStore }) }
  }
  const expected = process.env.AI_TOOL_TOKEN
  if (!expected) {
    return { ok: false, res: NextResponse.json({ v: 1, error: 'server_misconfig' }, { status: 500, headers: noStore }) }
  }
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  const got = m ? m[1] : ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  const same = a.length === b.length && timingSafeEqual(a, b)
  if (!same) {
    return { ok: false, res: NextResponse.json({ v: 1, error: 'unauthorized' }, { status: 401, headers: noStore }) }
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

// best-effort audit — NEVER throws · NEVER stores raw token or PII · weight = cost-aware usage
export async function audit(
  supa: SupabaseClient | null,
  tid: string,
  tool: string,
  params: Record<string, unknown>,
  resultCount: number,
  weight = 1,
): Promise<void> {
  try {
    if (!supa) return
    await supa.from('ai_tool_calls').insert({
      tool,
      token_id: tid,
      params: sanitizeParams(params),
      result_count: resultCount,
      weight,
    })
  } catch (e) {
    console.error('[ai-tools] audit failed:', (e as Error)?.message)
  }
}

// ================= Phase 2 · Hardening config (default · เก็บ metrics แล้วปรับ · ห้ามขยาย budget/ปิด limit โดยไม่มีตัวเลขจริง) =================
export const RL_WINDOW_SEC = 60      // sliding window
export const RL_BUDGET = 30          // weight-units ต่อ token ต่อ window
export const CACHE_TTL_SEC = 30      // cache สด
export const SNAPSHOT_KEEP_SEC = 600 // snapshot ใช้ fallback ได้ 10 นาที
export const UPSTREAM_TIMEOUT_MS = 8000

// weight ต่อ endpoint (หนัก = แพงกว่า) · v1 single-token · role-ready ผ่าน tid (ขยาย per-role เมื่อมี token แยก)
export const TOOL_WEIGHT: Record<string, number> = {
  'health': 1, 'data-health': 1,
  'parts/search': 2, 'tasks/open': 2, 'leads/follow': 2,
  'daily-brief': 3,
}

export const noStore = { 'Cache-Control': 'no-store' as const }
const jstore = (body: unknown, status = 200) => NextResponse.json(body as any, { status, headers: noStore })

// ---- rate/budget guard: นับ weighted usage ต่อ token ใน window (reuse ai_tool_calls) ----
export async function rateGuard(supa: SupabaseClient, tid: string, addWeight: number): Promise<{ limited: boolean; used: number }> {
  try {
    const since = new Date(Date.now() - RL_WINDOW_SEC * 1000).toISOString()
    const { data } = await supa.from('ai_tool_calls').select('weight').eq('token_id', tid).gte('created_at', since).limit(500)
    const used = (data || []).reduce((a: number, r: any) => a + (Number(r.weight) || 1), 0)
    return { limited: used + addWeight > RL_BUDGET, used }
  } catch {
    // count query ล่ม (infra) = fail-open (ไม่ล็อกทั้งระบบ) · downstream ยังมี timeout+snapshot คุ้มอยู่ · ไม่ใช่การ "ปิด limit" โดยตั้งใจ
    return { limited: false, used: 0 }
  }
}

// ---- cache / snapshot store ----
function buildCacheKey(tool: string, sp: URLSearchParams, keyParams: string[]): string {
  const parts = keyParams.map((k) => `${k}=${(sp.get(k) || '').trim().toLowerCase().slice(0, 80)}`)
  return `${tool}?${parts.join('&')}`
}
export async function cacheGet(supa: SupabaseClient, key: string): Promise<{ payload: any; as_of: string; fresh: boolean } | null> {
  try {
    const { data } = await supa.from('ai_cache').select('payload, as_of, expires_at').eq('cache_key', key).limit(1)
    if (!data || !data.length) return null
    const row: any = data[0]
    return { payload: row.payload, as_of: row.as_of, fresh: new Date(row.expires_at).getTime() > Date.now() }
  } catch { return null }
}
export async function cacheSet(supa: SupabaseClient, key: string, payload: any): Promise<void> {
  try {
    const now = new Date()
    await supa.from('ai_cache').upsert({
      cache_key: key,
      payload,
      as_of: now.toISOString(),
      expires_at: new Date(now.getTime() + CACHE_TTL_SEC * 1000).toISOString(),
    }, { onConflict: 'cache_key' })
  } catch { /* best-effort */ }
}
const withinSnapshot = (as_of: string) => Date.now() - new Date(as_of).getTime() <= SNAPSHOT_KEEP_SEC * 1000

// ---- timeout wrapper ----
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
}

// ================= handleAiRead: auth → cache → rate → timeout → snapshot fallback → envelope =================
export type AiReadOpts = {
  tool: string                                   // เช่น 'parts/search' (ต้องตรงกับ key ใน TOOL_WEIGHT)
  keyParams: string[]                            // param ที่ใช้ทำ cache key
  fetch: (supa: SupabaseClient, sp: URLSearchParams) => Promise<{ data: any; resultCount?: number }>
}

export async function handleAiRead(req: NextRequest, opts: AiReadOpts): Promise<NextResponse> {
  const auth = checkAuth(req)
  if (!auth.ok) return auth.res
  const tid = auth.tid
  const weight = TOOL_WEIGHT[opts.tool] ?? 2

  const supa = aiSupa()
  if (!supa) return jstore({ v: 1, error: 'server_misconfig' }, 500)

  const { searchParams } = new URL(req.url)
  const key = buildCacheKey(opts.tool, searchParams, opts.keyParams)
  const pObj = Object.fromEntries(opts.keyParams.map((k) => [k, searchParams.get(k) || '']))

  // 1) cache สด → คืนทันที (ถูก · ไม่ยิง DB ธุรกิจ · ไม่กิน budget) + audit เบา (weight 0)
  const cached = await cacheGet(supa, key)
  if (cached && cached.fresh) {
    audit(supa, tid, opts.tool, pObj, -1, 0)
    return jstore({ v: 1, data: cached.payload, as_of: cached.as_of, stale: false, cached: true })
  }

  // 2) rate/budget guard
  const rl = await rateGuard(supa, tid, weight)
  if (rl.limited) {
    if (cached && withinSnapshot(cached.as_of)) {
      return jstore({ v: 1, data: cached.payload, as_of: cached.as_of, stale: true, cached: true, reason: 'rate_limited', retry_after: RL_WINDOW_SEC })
    }
    return jstore({ v: 1, error: 'rate_limited', stale: true, retry_after: RL_WINDOW_SEC }, 429)
  }

  // 3) fetch + timeout
  try {
    const out = await withTimeout(opts.fetch(supa, searchParams), UPSTREAM_TIMEOUT_MS)
    const as_of = new Date().toISOString()
    await cacheSet(supa, key, out.data)
    audit(supa, tid, opts.tool, pObj, out.resultCount ?? -1, weight)
    return jstore({ v: 1, data: out.data, as_of, stale: false, cached: false })
  } catch (e) {
    // upstream ช้า/error → snapshot fallback (บอกเวลาชัด) · ไม่ปล่อยหน้าแตก/หมุน
    const reason = (e as Error)?.message === 'timeout' ? 'upstream_slow' : 'error'
    if (cached && withinSnapshot(cached.as_of)) {
      return jstore({ v: 1, data: cached.payload, as_of: cached.as_of, stale: true, cached: true, reason })
    }
    return jstore({ v: 1, error: reason, stale: true, retry_after: 15 }, 503)
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
