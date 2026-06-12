// app/ops-x7k2m9/leads/export/route.ts
// ดาวน์โหลด CSV ของ lead ทั้งหมด — ป้องกันด้วย cookie เดียวกับหน้า admin (path /ops-x7k2m9)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COOKIE = 'ops_admin'

const COLS = [
  'id', 'created_at', 'status', 'topic', 'name', 'phone', 'line_id', 'email',
  'car_model', 'part_number', 'budget', 'detail', 'callback_time',
  'source', 'referrer', 'consent',
]

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v).replace(/"/g, '""')
  return /[",\n]/.test(s) ? `"${s}"` : s
}

export async function GET() {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret || (await cookies()).get(COOKIE)?.value !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  const supa = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await supa.from('contact_leads').select('*').order('created_at', { ascending: false }).limit(5000)
  if (error) return NextResponse.json({ ok: false, error: 'fetch_failed' }, { status: 500 })

  const rows = data ?? []
  const header = COLS.join(',')
  const body = rows.map((r: any) => COLS.map((c) => csvCell(r[c])).join(',')).join('\n')
  const csv = '﻿' + header + '\n' + body // BOM กัน Excel อ่านภาษาไทยเพี้ยน

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${stamp}.csv"`,
    },
  })
}
