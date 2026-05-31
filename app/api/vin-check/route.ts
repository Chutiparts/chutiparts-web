// app/api/vin-check/route.ts — POST endpoint รับ VIN form submission
// Phase 1 — 2026-05-31

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role to bypass RLS (server-side only — secure)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validation
    if (!data.name || !data.contact || !data.vin) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (typeof data.vin !== 'string' || data.vin.length !== 17) {
      return NextResponse.json(
        { error: 'VIN must be exactly 17 characters' },
        { status: 400 }
      )
    }

    // Insert into vin_check_requests
    const { data: inserted, error } = await supabase
      .from('vin_check_requests')
      .insert({
        name: String(data.name).trim().slice(0, 200),
        contact: String(data.contact).trim().slice(0, 200),
        vin: String(data.vin).toUpperCase().trim().slice(0, 17),
        car_model: data.car_model ? String(data.car_model).slice(0, 50) : null,
        car_year: data.car_year ? parseInt(String(data.car_year), 10) || null : null,
        questions: data.questions ? String(data.questions).slice(0, 2000) : null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.error('VIN check insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save request', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: inserted?.id,
    })
  } catch (e) {
    console.error('VIN check error:', e)
    return NextResponse.json(
      { error: 'Server error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }
}
