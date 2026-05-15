// app/api/intake-upload/route.ts — Photo upload endpoint for intake form
// POST file → returns public URL (or signed URL)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Validate type
    if (!file.type.match(/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime))$/)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const supabase = await createClient()
    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `intake/${filename}`

    const { error } = await supabase.storage
      .from('case-photos')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
      })

    if (error) {
      console.error('upload error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('case-photos')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl, path })
  } catch (err: any) {
    console.error('upload exception', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const config = {
  api: { bodyParser: false },
}
