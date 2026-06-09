// app/api/quotes/create/route.ts — Handle Quote form submission
// Phase 1A — 2026-06-09

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30  // 30 sec for image uploads

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const MAX_FILES = 3
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const VALID_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function jsonError(message: string, status = 400, field?: string) {
  return NextResponse.json(
    { error: { code: 'VALIDATION_ERROR', message, details: field ? { field } : undefined } },
    { status }
  )
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Server not configured' } },
      { status: 500 }
    )
  }

  // Parse multipart form
  let form: FormData
  try {
    form = await request.formData()
  } catch (err) {
    return jsonError('Invalid form data', 400)
  }

  // Honeypot check
  if (form.get('website')) {
    // Silently succeed for bots (don't reveal the trap)
    return NextResponse.json({ quote_id: 'spam' }, { status: 201 })
  }

  // Extract fields
  const customer_name = String(form.get('customer_name') || '').trim()
  const customer_phone = String(form.get('customer_phone') || '').trim()
  const customer_line = String(form.get('customer_line') || '').trim() || null
  const vehicle_model = String(form.get('vehicle_model') || '').trim()
  const vehicle_year_raw = String(form.get('vehicle_year') || '').trim()
  const vehicle_year = vehicle_year_raw ? parseInt(vehicle_year_raw, 10) : null
  const part_description = String(form.get('part_description') || '').trim() || null

  // Validate
  if (!customer_name) return jsonError('Name required', 400, 'customer_name')
  if (!customer_phone) return jsonError('Phone required', 400, 'customer_phone')
  if (!vehicle_model) return jsonError('Vehicle model required', 400, 'vehicle_model')
  if (vehicle_year && (vehicle_year < 1970 || vehicle_year > 2030)) {
    return jsonError('Invalid year', 400, 'vehicle_year')
  }

  // Extract photos
  const photos = form.getAll('photos').filter((x): x is File => x instanceof File)
  if (photos.length === 0) return jsonError('At least 1 photo required', 400, 'photos')
  if (photos.length > MAX_FILES) return jsonError(`Max ${MAX_FILES} photos`, 400, 'photos')

  for (const p of photos) {
    if (p.size > MAX_SIZE) return jsonError(`Photo ${p.name} too large (max 5MB)`, 400, 'photos')
    if (!VALID_MIME.includes(p.type)) {
      return jsonError(`Photo ${p.name} invalid type (must be JPG/PNG/WebP/HEIC)`, 400, 'photos')
    }
  }

  // Init Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Upload photos to Storage
  const uploadedUrls: string[] = []
  const timestamp = Date.now()
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    const ext = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `${timestamp}-${i + 1}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `${new Date().toISOString().slice(0, 10)}/${filename}`

    const arrayBuffer = await photo.arrayBuffer()
    const { error: upErr } = await supabase.storage
      .from('quote-photos')
      .upload(path, arrayBuffer, {
        contentType: photo.type,
        upsert: false,
      })

    if (upErr) {
      console.error('[quotes/create] Storage upload error:', upErr)
      return NextResponse.json(
        { error: { code: 'STORAGE_ERROR', message: 'Failed to upload photo' } },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(path)
    uploadedUrls.push(urlData.publicUrl)
  }

  // Insert quote record
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    null
  const userAgent = request.headers.get('user-agent') || null

  const { data: quoteRow, error: dbErr } = await supabase
    .from('quotes')
    .insert({
      customer_name,
      customer_phone,
      customer_line,
      vehicle_model,
      vehicle_year,
      part_description,
      photo_urls: uploadedUrls,
      source_channel: 'web_quote',
      status: 'new',
      client_ip: clientIp,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (dbErr) {
    console.error('[quotes/create] DB insert error:', dbErr)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to save quote' } },
      { status: 500 }
    )
  }

  // Trigger background AI Vision analysis (fire and forget — Day 2)
  // Don't await — let it run in background
  if (process.env.QUOTE_ANALYZE_URL) {
    fetch(process.env.QUOTE_ANALYZE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.QUOTE_ANALYZE_SECRET || ''}`,
      },
      body: JSON.stringify({ quote_id: quoteRow.id }),
    }).catch((e) => console.error('[quotes/create] analyze trigger failed:', e))
  }

  return NextResponse.json(
    {
      quote_id: quoteRow.id,
      status: 'new',
      message: 'Quote submitted',
    },
    { status: 201 }
  )
}
