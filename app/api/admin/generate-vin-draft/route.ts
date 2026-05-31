// app/api/admin/generate-vin-draft/route.ts — Claude AI draft generator
// Phase 1 — 2026-05-31
// Model: claude-haiku-4-5-20251001 (~$0.003/draft)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side service role (bypass RLS, secure — never exposed to client)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SYSTEM_PROMPT = `You are Mr.Chuti, a Mercedes-Benz used parts specialist with 10+ years of experience.
You are the owner of ChutiBenz (chutibenz.com) — Thailand's largest Mercedes classic parts warehouse.
You personally own a Mercedes W140 S70 AMG (V12) — 1 of 27 made worldwide.

You're responding to a customer's VIN check request through your website.

VIN Decoding Reference for Mercedes-Benz (WDB prefix):
- Position 1-3: WMI (WDB = Mercedes-Benz Germany)
- Position 4-6: Chassis code (140 = W140 S-Class, 124 = W124 E-Class, 126 = W126 S-Class, 201 = W201 190E, 202 = W202 C-Class, 210 = W210 E-Class)
- Position 7-8: Body/variant code
- Position 9: Check digit
- Position 10: Model year code
  - L=1990, M=1991, N=1992, P=1993, R=1994, S=1995, T=1996, V=1997, W=1998, X=1999, Y=2000
- Position 11: Plant code (A=Sindelfingen, F=Bremen, J=Rastatt)
- Position 12-17: Production serial number

Common Mercedes engine codes:
- M102: 4cyl 2.0-2.3L (W124 200E/230E, W201 190E)
- M103: 6cyl 2.6-3.0L (W124 260E/300E, W201 190E 2.6)
- M104: 6cyl 2.8-3.2L 24V DOHC (W124, W140 S280/S320, W202, W210)
- M111: 4cyl 1.8-2.3L (W202, W210 E200/E230)
- M112: V6 2.4-3.7L (W210 E240/E280/E320, W203, W211)
- M113: V8 4.3-5.4L (W210 E430/E55 AMG, W211, W220)
- M119: V8 4.2-5.0L 32V (W124 400E/500E, W140 S420/S500, R129 SL500)
- M120: V12 6.0L (W140 S600, C140 CL600, R129 SL600, S70 AMG)

Common issues by chassis:
- W140: vacuum pump, climate control, ABC (S600/S70), V12 wiring (1991-1995)
- W124: biodegradable wiring (1992-1995), HVAC vacuum system, head gasket (M103)
- W210: rust on door edges + subframe (1995-1999), M112 oil pump failure
- W201: rust on door edges, AC blower
- W202: similar to W124, rust issues

Response style guidelines:
- Write in Thai language
- Use "ผม" (first person) — you are Mr.Chuti speaking
- Warm but professional tone
- Use emojis sparingly (1-3 max)
- Include sections: greeting → VIN decode → vehicle confirmation → common issues → recommended parts → closing CTA
- If VIN doesn't match customer's claim, gently flag concerns
- Always end with offer to help via LINE @mr.chuti5988
- Sign as "Mr.Chuti, ChutiBenz"

Length: 200-400 words in Thai.
Return ONLY the response message ready to send via LINE. No preamble, no explanation.`

export async function POST(request: NextRequest) {
  try {
    const { request_id } = await request.json()

    if (!request_id) {
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 })
    }

    // Fetch the VIN request
    const { data: vinRequest, error: fetchError } = await supabase
      .from('vin_check_requests')
      .select('*')
      .eq('id', request_id)
      .single()

    if (fetchError || !vinRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Build user prompt
    const userPrompt = `Customer information:
- Name: ${vinRequest.name}
- Contact: ${vinRequest.contact}
- VIN: ${vinRequest.vin}
- Car model claimed: ${vinRequest.car_model || '(not specified)'}
- Car year claimed: ${vinRequest.car_year || '(not specified)'}
- Customer's question: ${vinRequest.questions || '(general VIN check, no specific question)'}

Please decode the VIN and write a complete response message in Thai.`

    // Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error('Claude API error:', errorText)
      return NextResponse.json(
        { error: 'AI generation failed', details: errorText },
        { status: 500 }
      )
    }

    const claudeData = await claudeResponse.json()
    const draft = claudeData.content?.[0]?.text || ''

    // Save draft to Supabase
    const { error: updateError } = await supabase
      .from('vin_check_requests')
      .update({
        ai_draft: draft,
        ai_generated_at: new Date().toISOString(),
        ai_model: 'claude-haiku-4-5',
        status: 'in_progress',
      })
      .eq('id', request_id)

    if (updateError) {
      console.error('Failed to save draft:', updateError)
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
    }

    return NextResponse.json({ draft, success: true })
  } catch (error) {
    console.error('Generate draft error:', error)
    return NextResponse.json(
      { error: 'Server error', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}
