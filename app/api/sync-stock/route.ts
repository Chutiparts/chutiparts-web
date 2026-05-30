/**
 * /api/sync-stock — Sync Google Sheet V10 (🌐 Web Catalog) → A's Supabase products
 *
 * Deploy target: chutiparts-web/app/api/sync-stock/route.ts
 * Spec: docs/deploy-drafts/DEPLOY-003-SPEC.md
 * Unblocked by: CR-001 (2026-05-29)
 *
 * STRATEGY (2-step, slug-preserving):
 *   1. Lookup existing rows by part_number → map part_number → {id, slug}
 *   2. For each V10 row: existing → preserve slug; new → generate slug
 *   3. Upsert with onConflict='slug' (existing UNIQUE constraint)
 *
 * Red lines (preserved):
 *   - ห้ามแตะ cart, ห้ามแตะ B (datacard-ops)
 *   - ห้าม leak ต้นทุน (col 8 EXCLUDED from upsert)
 *   - Audit-first: ทุก sync เขียน stock_sync_log row
 *   - ห้าม run without CRON_SECRET → 401
 *   - Preserve existing image_url / views_count / location / condition
 *
 * Owner manual trigger:
 *   curl -X POST https://chutibenz.com/api/sync-stock \
 *        -H "Authorization: Bearer ${CRON_SECRET}"
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ─────────────────────────────────────────────────────────────────────────────
// V10 Web Catalog column positions (0-indexed, verified per audit 2026-05-30)
// ─────────────────────────────────────────────────────────────────────────────
const COL = {
  SKU: 0,
  NAME: 1,
  CATEGORY: 2,
  CHASSIS: 3,
  YEAR_FROM: 4,
  YEAR_TO: 5,
  OEM: 6,
  IMPORT_FROM: 7,
  COST: 8, // ⚠ EXCLUDED — red line
  PRICE: 9,
  STOCK: 10,
  STATUS_LABEL: 11, // not stored
  HAS_DEFECT: 12,
  DEFECT_NOTE: 13,
  PUBLISH: 14,
} as const

const PUBLISH_VALUE = 'published'
const MIN_COLS_EXPECTED = 15

// ─────────────────────────────────────────────────────────────────────────────
// CSV parser
// ─────────────────────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\r') {
        // skip
      } else if (c === '\n') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
      } else {
        field += c
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Field helpers
// ─────────────────────────────────────────────────────────────────────────────
const trim = (s: string | undefined): string => (s ?? '').trim()

function toInt(raw: string): number | null {
  const t = trim(raw).replace(/,/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function toBoolThai(raw: string): boolean {
  const t = trim(raw).toLowerCase()
  return t === 'มี' || t === 'true' || t === 'yes' || t === 'ใช่' || t === '1'
}

/**
 * Generate slug matching A's existing convention:
 *   `{sku}-{slugified-name}`
 * Examples (verified against existing data):
 *   - "ไฟท้าย W140 ซ้าย" + "140-001" → "140-001-ไฟท้าย-w140-ซ้าย"
 *   - 'ล้อ ST2 18"' + "124-001" → "124-001-ล้อ-st2-18"
 */
function generateSlug(name: string, sku: string): string {
  const slugName = name
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/\s+/g, '-')
    // keep ASCII alphanum, dash, and Thai range U+0E00..U+0E7F
    .replace(/[^a-z0-9฀-๿-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `${sku}-${slugName}`
}

function composeDescription(importFrom: string, hasDefect: boolean, defectNote: string): string | null {
  const parts: string[] = []
  if (importFrom) parts.push(`นำเข้าจาก${importFrom}`)
  if (hasDefect && defectNote) parts.push(`ตำหนิ: ${defectNote}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

// SKU sanity for data row detection
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

// ─────────────────────────────────────────────────────────────────────────────
// Log context type
// ─────────────────────────────────────────────────────────────────────────────
type LogContext = {
  ok: boolean
  error?: string | null
  message?: string | null
  candidates: number
  plannedInserts?: number
  plannedUpdates?: number
  upserted?: number
  errored?: number
  errorDetails?: unknown[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  // Env var names match Vercel project (chutiparts-web) actual config:
  //   - NEXT_PUBLIC_SUPABASE_URL  (already used by client; safe to reuse server-side)
  //   - SUPABASE_SECRET_KEY        (service-role key; server-only)
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SECRET_KEY
  const sheetUrl = process.env.STOCK_SHEET_CSV_URL
  const cronSecret = process.env.CRON_SECRET

  if (!supaUrl || !supaKey || !sheetUrl || !cronSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_env',
        missing: {
          NEXT_PUBLIC_SUPABASE_URL: !supaUrl,
          SUPABASE_SECRET_KEY: !supaKey,
          STOCK_SHEET_CSV_URL: !sheetUrl,
          CRON_SECRET: !cronSecret,
        },
      },
      { status: 500 },
    )
  }

  // Authn — Vercel cron + manual trigger same header
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const triggeredBy =
    (req.headers.get('user-agent') ?? '').toLowerCase().includes('vercel') ||
    req.headers.has('x-vercel-cron')
      ? 'cron'
      : 'manual'

  // Fetch CSV
  let csvText: string
  try {
    const r = await fetch(sheetUrl, { cache: 'no-store' })
    if (!r.ok) throw new Error(`sheet_http_${r.status}`)
    csvText = await r.text()
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: 'sheet_fetch_failed',
        message: e instanceof Error ? e.message : 'unknown',
      },
      { status: 502 },
    )
  }

  // Parse CSV — find first data row by SKU pattern detection
  const rows = parseCsv(csvText)
  let dataStartIdx = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const c0 = trim(rows[i][0])
    if (SKU_PATTERN.test(c0) && c0.length >= 3 && c0.length <= 32) {
      dataStartIdx = i
      break
    }
  }
  if (dataStartIdx === -1) {
    return NextResponse.json(
      { ok: false, error: 'no_data_rows', rows_total: rows.length },
      { status: 502 },
    )
  }

  const dataRows = rows.slice(dataStartIdx)

  // Build candidate records (published + valid)
  type Candidate = {
    sku: string
    fields: Record<string, unknown>
  }
  const candidates: Candidate[] = []
  const skipped: { sku: string; reason: string }[] = []

  for (const r of dataRows) {
    if (r.length < MIN_COLS_EXPECTED) {
      if (r.every((c) => trim(c) === '')) continue
      skipped.push({
        sku: trim(r[COL.SKU]) || '(short-row)',
        reason: `too_few_columns:${r.length}`,
      })
      continue
    }

    const sku = trim(r[COL.SKU])
    if (!sku) continue

    const publishStatus = trim(r[COL.PUBLISH]).toLowerCase()
    if (publishStatus !== PUBLISH_VALUE) {
      skipped.push({ sku, reason: `publish:${publishStatus || 'empty'}` })
      continue
    }

    const name = trim(r[COL.NAME])
    if (!name) {
      skipped.push({ sku, reason: 'missing:name' })
      continue
    }

    const price = toInt(r[COL.PRICE])
    if (price == null) {
      skipped.push({ sku, reason: 'missing:price' })
      continue
    }

    const chassis = trim(r[COL.CHASSIS])
    const hasDefect = toBoolThai(r[COL.HAS_DEFECT])
    const defectNote = trim(r[COL.DEFECT_NOTE])
    const importFrom = trim(r[COL.IMPORT_FROM])
    const description = composeDescription(importFrom, hasDefect, defectNote)
    const yearFrom = toInt(r[COL.YEAR_FROM])
    const yearTo = toInt(r[COL.YEAR_TO])
    const stock = toInt(r[COL.STOCK]) ?? 0
    const oem = trim(r[COL.OEM])
    const category = trim(r[COL.CATEGORY])

    const fields: Record<string, unknown> = {
      part_number: sku,
      name,
      price,
      stock,
      is_published: true,
      // pass-through category with V10 prefix (per Q1 = ก)
      ...(category && { category }),
      ...(chassis && { compatible_models: [chassis] }),
      ...(oem && { oem_number: oem }),
      ...(yearFrom != null && { year_from: yearFrom }),
      ...(yearTo != null && { year_to: yearTo }),
      ...(description && { description }),
      // OMITTED (preserve existing or DB default):
      //   image_url, condition, currency, views_count, location, slug (added per-row)
    }

    candidates.push({ sku, fields })
  }

  // Step 1: Lookup existing rows by part_number → map to {id, slug}
  const supa = createClient(supaUrl, supaKey, {
    auth: { persistSession: false },
  })

  // Closure for logging + response (carries supa client without typing headaches)
  const logAndRespond = async (ctx: LogContext): Promise<NextResponse> => {
    const durationMs = Date.now() - startedAt
    const logRow = {
      source_url: sheetUrl,
      rows_fetched: dataRows.length,
      rows_published: ctx.candidates,
      rows_inserted: ctx.plannedInserts ?? 0,
      rows_updated: ctx.plannedUpdates ?? 0,
      rows_upserted: ctx.upserted ?? 0,
      rows_errored: ctx.errored ?? 0,
      duration_ms: durationMs,
      error_details:
        ctx.errorDetails && ctx.errorDetails.length > 0 ? ctx.errorDetails : null,
      triggered_by: triggeredBy,
    }
    const { error: logErr } = await supa.from('stock_sync_log').insert(logRow as never)
    if (logErr) {
      console.error('[sync-stock] failed to write sync_log:', logErr.message)
    }
    return NextResponse.json(
      {
        ok: ctx.ok,
        ...(ctx.error && { error: ctx.error }),
        ...(ctx.message && { message: ctx.message }),
        triggered_by: triggeredBy,
        rows_fetched: dataRows.length,
        rows_published: ctx.candidates,
        planned_inserts: ctx.plannedInserts ?? 0,
        planned_updates: ctx.plannedUpdates ?? 0,
        rows_upserted: ctx.upserted ?? 0,
        rows_errored: ctx.errored ?? 0,
        duration_ms: durationMs,
        skipped_rows: skipped.slice(0, 50),
        ...(ctx.errorDetails &&
          ctx.errorDetails.length > 0 && { error_details: ctx.errorDetails }),
      },
      { status: ctx.ok ? 200 : ctx.error === 'lookup_failed' ? 500 : 200 },
    )
  }

  let existingBySku = new Map<string, { id: string; slug: string }>()
  if (candidates.length > 0) {
    const skus = candidates.map((c) => c.sku)
    const { data: existing, error: lookupErr } = await supa
      .from('products')
      .select('id, slug, part_number')
      .in('part_number', skus)

    if (lookupErr) {
      return await logAndRespond({
        ok: false,
        error: 'lookup_failed',
        message: lookupErr.message,
        candidates: candidates.length,
      })
    }

    existingBySku = new Map(
      (existing ?? [])
        .filter((r) => r.part_number)
        .map((r) => [r.part_number as string, { id: r.id as string, slug: r.slug as string }]),
    )
  }

  // Step 2: Build upsert payload with slug preservation
  let plannedInserts = 0
  let plannedUpdates = 0
  const upsertPayload = candidates.map(({ sku, fields }) => {
    const existing = existingBySku.get(sku)
    if (existing) {
      plannedUpdates++
      return { ...fields, slug: existing.slug }
    }
    plannedInserts++
    return { ...fields, slug: generateSlug(fields.name as string, sku) }
  })

  // Step 3: Upsert by slug (UNIQUE constraint already exists)
  let upserted = 0
  let errored = 0
  const errorDetails: unknown[] = []

  if (upsertPayload.length > 0) {
    const { data, error } = await supa
      .from('products')
      .upsert(upsertPayload, { onConflict: 'slug' })
      .select('id, slug')

    if (error) {
      errored = upsertPayload.length
      errorDetails.push({ phase: 'upsert', message: error.message, code: error.code })
    } else {
      upserted = data?.length ?? upsertPayload.length
    }
  }

  return await logAndRespond({
    ok: errored === 0,
    candidates: candidates.length,
    plannedInserts,
    plannedUpdates,
    upserted,
    errored,
    errorDetails,
  })
}
