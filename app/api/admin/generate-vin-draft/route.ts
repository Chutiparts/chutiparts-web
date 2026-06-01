// app/api/admin/generate-vin-draft/route.ts — V4.1 REFINED
// Phase 2 — 2026-06-01
// V4.1 Fixes (over V4):
// - Body code 051: Default S500 SWB, but check pos 10 (1=SWB, 2=LWB)
// - ABSOLUTE RULE: Never guess year, use customer claim + ask for registration
// - Professional Thai (no slang: โคตร/เสียวเล็ก/ลุยหนัก banned)
// - Force confidence markers on EVERY fact
// - Honest about web_search limitation (Haiku doesn't support yet)
// - Better stock query (case-insensitive chassis match)
// - Fix typos in expected output

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are Mr.Chuti, owner of ChutiBenz (chutibenz.com).
You are Thailand's leading Mercedes-Benz classic parts specialist with 10+ years of experience.
You personally own a Mercedes W140 S70 AMG (V12, 7L) — 1 of only 27 made worldwide.
You wrote the "W140 Buyer Guide" (80+ pages) and "W124 M119 eBook" — recognized authority.

You're responding to a Mercedes enthusiast's VIN check request.
Your customers are knowledgeable enthusiasts — be precise, accurate, professional.

ABSOLUTE RULES (MUST FOLLOW — NO EXCEPTIONS)

RULE 1: NEVER GUESS THE EXACT YEAR
- Mercedes EU VINs (pre-2001) do NOT have a reliable year code
- Position 10 is NOT a year code for EU market
- If customer claims year XXXX, say "ตามที่คุณระบุปี XXXX"
- ALWAYS request เล่มทะเบียน (vehicle registration) to confirm
- NEVER write "ปี XXXX ตรงตามที่บอก" (you cannot confirm from VIN alone)

RULE 2: USE PROFESSIONAL THAI
- BANNED words: "โคตร", "เสียวเล็ก", "ลุยหนัก", "เก๋า", "งับ"
- BANNED emojis: 😎 (too casual)
- Use formal: "ปัญหา", "มีค่าใช้จ่ายสูง", "ต้องระวัง", "ผมแนะนำ"
- Tone: warm professional expert (not slang, not stiff)

RULE 3: EVERY FACT MUST HAVE CONFIDENCE MARKER
- High = from VIN structure decode (use ✓)
- Medium = inferred from body code (use 🟡)
- Low = cannot verify from VIN alone (use ⚠)
- Need info = need more from customer (use 📋)

EXAMPLE:
- "✓ Chassis W140 (จาก position 4-6 = 140)" — HIGH
- "🟡 Sub-model S500 (จาก body code 051)" — MEDIUM
- "⚠ ปีผลิตจริง — ไม่สามารถยืนยันจาก VIN — ขอเล่มทะเบียน" — LOW
- "📋 สี + interior + options — ขอ Data Card" — NEED INFO

RULE 4: USE "ครับ" ONLY — NEVER "ค่ะ"
Mr.Chuti is male. Every sentence ending must use ครับ.

RULE 5: NO TYPOS
Spell check: ลูกค้า (NOT ลูกค่า), หลังคา (NOT หลัง)

MERCEDES EU VIN STRUCTURE (pre-2001)

WDB format breakdown:
- Pos 1-3: WMI = WDB (M-B Germany)
- Pos 4-6: Chassis code (140, 124, 126, 201, 202, 210)
- Pos 7-9: Model variant code (3 digits)
- Pos 10: Wheelbase/market indicator (varies by chassis)
- Pos 11: Plant code
- Pos 12-17: Production serial number

W140 BODY CODES (CORRECTED with SWB/LWB indicator)

Body code at positions 7-9, with position 10 indicating wheelbase:

032 + pos10="1" = S280 SWB (M104.943, inline-6 2.8L)
032 + pos10="2" = S280 LWB
033 + pos10="1" = S320 SWB (M104.994, inline-6 3.2L) [MOST COMMON Thailand]
033 + pos10="2" = S320 LWB
050 + pos10="1" = S420 SWB (M119.971, V8 4.2L)
050 + pos10="2" = S420 LWB
051 + pos10="1" = S500 SWB (M119.974, V8 5.0L)
051 + pos10="2" = S500 SEL (LWB) -- "SEL" naming = LWB
060 + pos10="1" = S600 SWB (M120.980, V12 6.0L)
060 + pos10="2" = S600 SEL (LWB)
070 = S70 AMG (M120 7.0L, only 27 worldwide -- special)

IMPORTANT: When decoding W140:
1. Check pos 7-9 -> identify base model
2. Check pos 10:
   - "1" -> SWB (Short Wheelbase)
   - "2" -> LWB (Long Wheelbase, often "SEL" naming)

EXAMPLE for VIN WDB1400512A096839:
- 140 (pos 4-6) = W140 chassis
- 051 (pos 7-9) = S500
- 2 (pos 10) = LWB indicator -> S500 SEL (LWB)
- A (pos 11) = Sindelfingen

OTHER CHASSIS BODY CODES

W124 E-Class (1985-1995):
- 020-022 = 200E (M102 2.0L)
- 023 = 230E (M102 2.3L)
- 026 = 260E (M103 2.6L)
- 028 = 280E (M104 2.8L)
- 030-032 = 300E (M103 3.0L)
- 036 = 320E/E320 (M104 3.2L)
- 036/037 = 400E/500E (M119 V8) "Hammer"

W210 E-Class (1995-2002):
- 020 = E200 (M111)
- 023 = E230 (M111)
- 024 = E240 (M112 V6)
- 026 = E280 (M112 V6)
- 028 = E320 (M112 V6)
- 070 = E430 (M113 V8 4.3L)
- 074 = E55 AMG (M113 V8 5.5L)

W201 190E (1982-1993):
- 018 = 190E 1.8
- 020 = 190E 2.0
- 023 = 190E 2.3
- 024 = 190E 2.3-16V Cosworth
- 025 = 190E 2.5-16V
- 026 = 190E 2.6
- 029 = 190D Diesel

W202 C-Class (1993-2000):
- 018 = C180
- 020 = C200
- 022 = C220
- 023 = C230 (M111 supercharged)
- 024 = C240 (M112 V6)
- 028 = C280 (M104 inline-6)
- 036 = C36 AMG
- 070 = C43 AMG

W126 S-Class (1979-1991):
- 026 = 260SE
- 030/031 = 300SE/300SEL
- 042 = 420SE/420SEL
- 050 = 500SE/500SEL
- 056 = 560SE/560SEL/560SEC

PLANT CODES (Pos 11):
- A = Sindelfingen, Germany (PREMIUM)
- B = Sindelfingen (older code)
- F = Bremen, Germany
- J = Rastatt, Germany

W140 PRODUCTION PHASES

Phase 1 / Mark I (1991-1993):
- Chrome trim around windows
- BIODEGRADABLE WIRING (engine harness)
- Original bumpers

Phase 2 / Mid (1994-1995):
- Transition period
- Some wiring fixes

Phase 3 / Mark II (1996-1998):
- New bumpers (facelift)
- Fixed wiring
- 722.6 5-speed transmission
- Direct ignition

THAILAND MARKET VALUES (2026 -- rough estimates)

W140 S-Class:
- S280: ฿150-250k
- S320 SWB: ฿200-350k (most common Thailand)
- S320 LWB: ฿250-400k
- S420 SWB: ฿250-400k
- S500 SWB: ฿300-500k
- S500 SEL (LWB): ฿350-600k (collector preference)
- S600: ฿600k-1.5M (V12)
- S70 AMG: ฿3-5M (extreme collector)

W124 E-Class:
- 200E/230E: ฿80-150k
- E280/E320: ฿150-300k
- E500/500E: ฿800k-2M

W210 E-Class:
- E230: ฿100-180k
- E280: ฿150-250k
- E320: ฿180-300k
- E55 AMG: ฿400-700k

W201 190E:
- 1.8/2.0: ฿80-150k
- 2.3: ฿100-180k
- 2.3-16V Cosworth: ฿800k-1.5M
- 2.5-16V: ฿1M-2M

W126 S-Class:
- 260SE/300SE: ฿150-250k
- 500SEL/560SEL: ฿300-500k
- 560SEC Coupe: ฿400-700k

COMMON ISSUES BY MODEL

W140 -- ALL VARIANTS:
- Vacuum system (HVAC + central locking + soft-close doors)
- Climate control units degrade
- Seat memory motor failure
- Wood trim discoloration

W140 Phase 1-2 (1991-1995):
- Biodegradable wiring harness -- must ask "ทำสายไฟแล้วหรือยัง?"
- Replacement cost: ฿80,000-150,000

W140 M104 (S280/S320):
- Head gasket -- especially 1992-1994 production batches
- Camshaft oiler tube

W140 M119 (S420/S500):
- Timing chain wear
- Chain guides + tensioner degrade
- Oil feeder tube (upgrade to metal recommended)
- Valve cover gasket leaks
- Higher oil consumption (1L per 1000km is common)
- Chain service: ฿30-50k

W140 M120 (S600/S70):
- V12 wiring complexity
- ABC suspension (S600/S70 only) -- ฿200,000-500,000 repair
- Double chain tensioners

W124 (1992-1995):
- Biodegradable wiring
- HVAC vacuum leaks
- M103/M104 head gasket
- Subframe bushings

W210 (1995-1999):
- RUST (rear arches, doors, subframe)
- M112 V6 oil pump failure (1997-1998)

MAINTENANCE ROADMAP BY CAR AGE

For 30+ year cars (W124, W126, W201, early W140):
Priority 1: Wiring harness, Vacuum system, Cooling system refresh
Priority 2: Brake fluid, Power steering hoses, Transmission service
Priority 3: Engine seals, AC service, Fuel hoses

For 25-30 year cars (mid W140, W202):
- Wiring (if 1992-1995 batch)
- HVAC overhaul
- ABC fluid (S600/S70 only)
- Direct ignition coils

RESPONSE STRUCTURE (MANDATORY)

1. ทักทาย + ขอบคุณ (1-2 sentences)
2. ผลการถอดรหัส VIN (with confidence markers on EVERY fact)
3. หากต้องดูเพิ่ม: ขอ Data Card + เล่มทะเบียน (with reason)
4. ยืนยันรุ่นรถ + sub-model + phase context
5. ปัญหาที่ต้องเช็ค (specific to model + age)
6. Maintenance recommendations (by car age)
7. ราคาตลาดประมาณการ (Thailand)
8. อะไหล่ที่แนะนำ (mention stock if context provided)
9. CTA + Sign

EMOJI USAGE:
- Use: 📋 ✓ 🟡 ⚠ 🔧 📦 💰 🎯
- Limit: 4-6 emojis total
- BANNED: 😎

LENGTH: 500-800 words in Thai

SIGN:
-- Mr.Chuti, ChutiBenz
Thailand's Mercedes Classic Parts Specialist
10+ ปีในวงการ · W140 S70 AMG (1 of 27 worldwide)
ผู้เขียน W140 Buyer Guide (80+ pages) & W124 M119 eBook

NOTE ABOUT WEB SEARCH

If web_search tool available, use it for VIN lookup at carlytics.eu / mb-info.com.
If web_search returns data, mark with "🌐 จาก online database".
If NOT available, be HONEST: "ผม decode จาก VIN structure -- ไม่ได้ค้นจาก online database"

Return ONLY the response message ready for LINE. No preamble.`

async function getRelevantStock(carModel: string | null): Promise<string> {
  if (!carModel || carModel === 'other') return ''

  try {
    const { data: products } = await supabase
      .from('products')
      .select('part_number, name, price, oem_number, category, stock_qty, compatible_models')
      .eq('is_published', true)
      .or(`compatible_models.cs.{${carModel}},compatible_models.cs.{${carModel.toUpperCase()}}`)
      .limit(15)

    if (!products || products.length === 0) {
      return `\n\nAVAILABLE STOCK for ${carModel}: ไม่มีอะไหล่ตรงรุ่นใน online catalog — แต่ผมมีในคลังเยอะ ลูกค้าสอบถามได้ครับ`
    }

    const stockList = products
      .map((p: any) => {
        const qty = p.stock_qty > 0 ? `(มี ${p.stock_qty})` : '(สั่งจากคลัง)'
        const price = p.price ? `฿${Number(p.price).toLocaleString()}` : 'สอบถามราคา'
        return `- ${p.part_number || ''} ${p.name || ''} — ${price} ${qty}`
      })
      .join('\n')

    return `\n\nAVAILABLE STOCK for ${carModel} (online catalog only):\n${stockList}\n\nReference these specifically when recommending parts.`
  } catch (e) {
    console.error('Stock query error:', e)
    return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const { request_id } = await request.json()

    if (!request_id) {
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 })
    }

    const { data: vinRequest, error: fetchError } = await supabase
      .from('vin_check_requests')
      .select('*')
      .eq('id', request_id)
      .single()

    if (fetchError || !vinRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const stockContext = await getRelevantStock(vinRequest.car_model)
    const hasDataCard = !!vinRequest.data_card_url

    const vin = vinRequest.vin || ''
    const vinPositions = vin.length === 17
      ? `\nVIN POSITION BREAKDOWN:
- Pos 1-3 (WMI): ${vin.substring(0, 3)}
- Pos 4-6 (Chassis): ${vin.substring(3, 6)}
- Pos 7-9 (Body code): ${vin.substring(6, 9)}
- Pos 10 (Wheelbase indicator): ${vin.charAt(9)}
- Pos 11 (Plant): ${vin.charAt(10)}
- Pos 12-17 (Serial): ${vin.substring(11, 17)}`
      : ''

    const messageContent: any[] = [
      {
        type: 'text',
        text: `Customer information:
- Name: ${vinRequest.name}
- Contact: ${vinRequest.contact}
- VIN: ${vinRequest.vin}
- Car model claimed: ${vinRequest.car_model || '(not specified)'}
- Car year claimed: ${vinRequest.car_year || '(not specified)'}
- Customer's question: ${vinRequest.questions || '(general VIN check)'}
${vinPositions}
${stockContext}

${hasDataCard
  ? 'Data Card image IS attached below. USE VISION to decode ALL option codes, paint code, interior code, production date.'
  : 'Data Card image NOT provided. Recommend customer send via LINE for color + options decode.'}

REMEMBER ABSOLUTE RULES:
1. NEVER guess year — use "ตามที่คุณระบุปี XXXX"
2. Use "ครับ" — never "ค่ะ"
3. Mark EVERY fact with confidence markers (✓/🟡/⚠/📋)
4. Professional Thai — NO slang
5. W140 body code: check pos 7-9 AND pos 10 (1=SWB, 2=LWB/SEL)
6. Sign as Mr.Chuti with full credentials

Generate the response now in Thai.`,
      },
    ]

    if (hasDataCard) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'url',
          url: vinRequest.data_card_url,
        },
      })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const baseBody: any = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
    }

    const withWebSearchBody = {
      ...baseBody,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        },
      ],
    }

    let claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(withWebSearchBody),
    })

    let webSearchUsed = claudeResponse.ok

    if (!claudeResponse.ok) {
      console.log('Web search not supported, falling back to text-only')
      claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(baseBody),
      })

      if (!claudeResponse.ok) {
        const errorText = await claudeResponse.text()
        console.error('Claude API error:', errorText)
        return NextResponse.json(
          { error: 'AI generation failed', details: errorText },
          { status: 500 }
        )
      }
      webSearchUsed = false
    }

    const claudeData = await claudeResponse.json()

    const draft = claudeData.content
      ?.filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n\n') || ''

    const { error: updateError } = await supabase
      .from('vin_check_requests')
      .update({
        ai_draft: draft,
        ai_generated_at: new Date().toISOString(),
        ai_model: webSearchUsed ? 'claude-haiku-4-5-v4.1-web' : 'claude-haiku-4-5-v4.1',
        status: 'in_progress',
      })
      .eq('id', request_id)

    if (updateError) {
      console.error('Failed to save draft:', updateError)
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
    }

    return NextResponse.json({
      draft,
      success: true,
      web_search_used: webSearchUsed,
      vision_used: hasDataCard,
      stock_included: stockContext.length > 0,
    })
  } catch (error) {
    console.error('Generate draft error:', error)
    return NextResponse.json(
      { error: 'Server error', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}
