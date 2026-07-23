// app/api/quotes/[id]/update/route.ts — Status + note update
// Phase 1A · Day 3 — 2026-06-09

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { opsAuthed } from '@/lib/ops-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const VALID_STATUS = ['new', 'reviewing', 'quoted', 'waiting_customer', 'won', 'lost', 'archived']

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  // 2026-07-23: เดิมกันด้วย referer อย่างเดียว ซึ่งปลอมได้ง่ายมาก (แค่ใส่ header เอง)
  // ตอนนี้ต้องมี cookie owner จริง ๆ เท่านั้นถึงจะเปลี่ยนสถานะใบเสนอราคาได้
  if (!(await opsAuthed())) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'ต้องเข้าสู่ระบบ' } },
      { status: 401 }
    )
  }

  if (!/^[0-9a-f-]{32,36}$/i.test(id)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } },
      { status: 400 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } },
      { status: 400 }
    )
  }

  const { status, owner_note, reason, followup_hours } = body

  if (status && !VALID_STATUS.includes(status)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: `Invalid status` } },
      { status: 400 }
    )
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Build update
  const updateData: any = {
    last_action_at: new Date().toISOString(),
  }
  if (typeof status === 'string') updateData.status = status
  if (typeof owner_note === 'string') updateData.owner_note = owner_note
  if (followup_hours === null) updateData.next_followup_at = null
  else if (typeof followup_hours === 'number' && followup_hours > 0) {
    updateData.next_followup_at = new Date(Date.now() + followup_hours * 3600 * 1000).toISOString()
  }

  const { error: updErr } = await supabase
    .from('quotes')
    .update(updateData)
    .eq('id', id)

  if (updErr) {
    console.error('[quotes/update]', updErr)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Update failed' } },
      { status: 500 }
    )
  }

  // If reason provided + status changed, write history reason
  if (status && reason) {
    // The trigger already wrote a row; update its reason
    const { error: histErr } = await supabase
      .from('quote_status_history')
      .update({ reason, changed_by: 'owner' })
      .eq('quote_id', id)
      .eq('to_status', status)
      .order('changed_at', { ascending: false })
      .limit(1)
    if (histErr) console.warn('[quotes/update] history update:', histErr)
  }

  return NextResponse.json({ ok: true })
}
