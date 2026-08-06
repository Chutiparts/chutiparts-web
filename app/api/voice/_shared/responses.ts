// app/api/voice/_shared/responses.ts
// Standard success/error envelope + HTTP mapping (brief §3).
import { NextResponse } from 'next/server'
import type { Envelope, ErrorCode } from './types'

const ERROR_HTTP: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  CONSENT_REQUIRED: 409,
  NOT_FOUND: 404,
  INTENT_UNCLEAR: 200, // carried as a success flag, not an error envelope
  INTERNAL: 500,
}

export function ok<T>(data: T, init?: number): NextResponse {
  const body: Envelope<T> = { ok: true, data }
  return NextResponse.json(body, { status: init ?? 200 })
}

export function fail(code: ErrorCode, message: string, details?: unknown): NextResponse {
  const body: Envelope<never> = { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } }
  return NextResponse.json(body, { status: ERROR_HTTP[code] })
}

// used by the no-auto-commit test as a documented boundary
export { ERROR_HTTP }
