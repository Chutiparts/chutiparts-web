// app/api/vin-check/route.ts — POST endpoint V4
// Phase 2 — 2026-05-31
// V4: Handles multipart form data with optional Data Card image upload

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    // V4: Parse multipart form data instead of JSON
    const formData = await request.formData()

    const name = String(formData.get('name') || '').trim()
    const contact = String(formData.get('contact') || '').trim()
    const vin = String(formData.get('vin') || '').toUpperCase().trim()
    const car_model = String(formData.get('car_model') || '').trim() || null
    const car_year_raw = formData.get('car_year')
    const car_year = car_year_raw ? parseInt(String(car_year_raw), 10) || null : null
    const questions = String(formData.get('questions') || '').trim() || null
    const dataCardFile = formData.get('data_card') as File | null

    // Validation
    if (!name || !contact || !vin) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (vin.length !== 17) {
      return NextResponse.json(
        { error: 'VIN must be exactly 17 characters' },
        { status: 400 }
      )
    }

    // V4: Upload Data Card to Supabase Storage if provided
    let dataCardUrl: string | null = null
    if (dataCardFile && dataCardFile.size > 0) {
      try {
        // Validate size (10MB)
        if (dataCardFile.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'Data Card image too large (max 10MB)' },
            { status: 400 }
          )
        }

        // Validate type
        if (!dataCardFile.type.startsWith('image/')) {
          return NextResponse.json(
            { error: 'Data Card must be an image' },
            { status: 400 }
          )
        }

        // Generate unique filename
        const timestamp = Date.now()
        const extension = dataCardFile.name.split('.').pop() || 'jpg'
        const filename = `${vin}-${timestamp}.${extension}`

        // Upload to Storage
        const arrayBuffer = await dataCardFile.arrayBuffer()
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('vin-datacards')
          .upload(filename, arrayBuffer, {
            contentType: dataCardFile.type,
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Data Card upload error:', uploadError)
          // Continue without datacard rather than failing entire submission
        } else {
          // Get public URL
          const { data: { publicUrl } } = supabase
            .storage
            .from('vin-datacards')
            .getPublicUrl(filename)

          dataCardUrl = publicUrl
        }
      } catch (uploadErr) {
        console.error('Data Card processing error:', uploadErr)
        // Continue without datacard
      }
    }

    // Insert into vin_check_requests
    const { data: inserted, error } = await supabase
      .from('vin_check_requests')
      .insert({
        name: name.slice(0, 200),
        contact: contact.slice(0, 200),
        vin: vin.slice(0, 17),
        car_model: car_model?.slice(0, 50) || null,
        car_year,
        questions: questions?.slice(0, 2000) || null,
        status: 'pending',
        data_card_url: dataCardUrl,
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
      has_data_card: !!dataCardUrl,
    })
  } catch (e) {
    console.error('VIN check error:', e)
    return NextResponse.json(
      { error: 'Server error', message: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }
}
