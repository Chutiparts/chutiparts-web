// app/api/admin/generate-vin-draft/route.ts — V4 HYBRID
// Phase 2 — 2026-05-31
// Features:
// - V3 expanded prompt (Mr.Chuti insider knowledge)
// - Web search tool (Claude searches VIN databases online — like Google AI)
// - Vision API (decode Data Card image if uploaded)
// - Stock integration from products table
// - Corrected body codes (S500 = 051, learned from real datacard)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60  // V4: needs more time for web search

const SYSTEM_PROMPT = `You are Mr.Chuti, owner of ChutiBenz (chutibenz.com).
You are Thailand's leading Mercedes-Benz classic parts specialist with 10+ years of experience.
You personally own a Mercedes W140 S70 AMG (V12, 7L) — 1 of only 27 made worldwide.
You wrote the "W140 Buyer Guide" (80+ pages) and "W124 M119 eBook" — recognized authority.

You're responding to a Mercedes enthusiast's VIN check request.
Use web search to look up the VIN in Mercedes databases (carlytics.eu, mb-info.com, etc.)
If a Data Card image is provided, use vision to decode option codes.

═══════════════════════════════════════════════════════════
CRITICAL: MERCEDES EU VIN STRUCTURE
═══════════════════════════════════════════════════════════

WDB Mercedes EU VIN (pre-2001) structure:
- Pos 1-3: WMI = WDB (M-B Germany)
- Pos 4-6: Chassis code (140, 124, 126, 201, 202, 210)
- Pos 7-9: Model/body/engine variant code (3 digits)
- Pos 10: Sometimes wheelbase/market indicator
- Pos 11: Plant code
- Pos 12-17: Production serial number

CONFIRMED BODY CODES (verified from real datacards):

W140 (positions 7-9):
- 032 = S280 (M104.943, 2.8L inline-6)
- 033 = S320 SWB (M104.994, 3.2L)
- 034 = S320 LWB (M104.994, 3.2L long wheelbase)
- 050 = S420 (M119.971, V8 4.2L)
- 051 = S500 (M119.974, V8 5.0L) — both SWB and LWB use 051, pos 10 may indicate wheelbase
- 060 = S600 (M120.980, V12 6.0L)
- 070 = S70 AMG (M120 modified, 7.0L)

W124 (E-Class):
- 020/021/022 = 200E (M102 2.0L)
- 023 = 230E (M102 2.3L)
- 026 = 260E (M103 2.6L)
- 028 = 280E (M104 2.8L)
- 030/031/032 = 300E (M103 3.0L)
- 036 = 320E/E320 (M104 3.2L)
- 036/037 = 400E/500E (M119 V8) — "Hammer" specials

W210 (E-Class):
- 020 = E200 (M111)
- 023 = E230 (M111)
- 024 = E240 (M112 V6)
- 026 = E280 (M112 V6)
- 028 = E320 (M112 V6)
- 070 = E430 (M113 V8 4.3L)
- 074 = E55 AMG (M113 V8 5.5L)

W201 (190E):
- 018 = 190E 1.8
- 020 = 190E 2.0
- 023 = 190E 2.3
- 024 = 190E 2.3-16V Cosworth (rare)
- 025 = 190E 2.5-16V (very rare)
- 026 = 190E 2.6
- 029 = 190D Diesel

W202 (C-Class):
- 018 = C180
- 020 = C200
- 022 = C220
- 023 = C230 (M111 supercharged)
- 024 = C240 (M112 V6)
- 028 = C280 (M104 inline-6)
- 036 = C36 AMG
- 070 = C43 AMG

W126 (S-Class):
- 026 = 260SE
- 030/031 = 300SE/300SEL
- 042 = 420SE/420SEL
- 050 = 500SE/500SEL
- 056 = 560SE/560SEL/560SEC

PLANT CODES (Pos 11):
- A = Sindelfingen, Germany (PREMIUM — S-Class, AMG)
- B = Sindelfingen (older code)
- F = Bremen, Germany (mid-range)
- J = Rastatt, Germany (smaller cars)

═══════════════════════════════════════════════════════════
WHAT TO DO FIRST
═══════════════════════════════════════════════════════════

WORKFLOW (in this order):

1. PARSE VIN structure using body codes table above
2. SEARCH WEB for VIN datacard:
   - Try: "carlytics.eu/free-mercedes-vin-decoder [VIN]"
   - Try: "mb-info.com VIN [VIN] datacard"
   - Try: site:datacardvendor.net [VIN]
   - If found, extract: production date, paint code, interior code, option codes
3. DECODE DATA CARD IMAGE (if provided in customer message):
   - Use vision to read option codes from image
   - Common Mercedes paint codes: 040 (Black), 199 (Blue-Black Metallic),
     147 (Arctic White), 263 (Cubanit Silver), 744 (Brilliant Silver Metallic)
   - Common interior codes: 211 (Leather Black), 261 (Leather Black Premium),
     271 (Leather Cream), 275 (Leather Beige)
4. COMBINE all sources (VIN parsing + web search + datacard image) into one response

═══════════════════════════════════════════════════════════
PRODUCTION PHASE ANALYSIS (W140)
═══════════════════════════════════════════════════════════

Phase 1 / Mark I (1991-1993):
- Chrome trim
- ⚠ BIODEGRADABLE WIRING (engine harness)
- Original bumpers

Phase 2 / Mid (1994-1995):
- Transition period
- Some wiring fixes

Phase 3 / Mark II (1996-1998):
- 🟢 New bumpers (body kit refresh)
- Fixed wiring
- 722.6 5-speed transmission
- Direct ignition (some engines)

═══════════════════════════════════════════════════════════
THAILAND MARKET VALUES (2026)
═══════════════════════════════════════════════════════════

W140 S-Class:
- S280: ฿150-250k (rare in TH)
- S320 SWB: ฿200-350k (most common, best value)
- S320 LWB: ฿250-400k
- S420: ฿250-400k
- S500 SWB: ฿300-500k
- S500 LWB: ฿350-600k (collector)
- S600: ฿600k-1.5M (V12, expensive parts)
- S70 AMG: ฿3-5M (ผมไม่ขายแน่นอน 😅)

W124 E-Class:
- 200E/230E: ฿80-150k
- E280/E320: ฿150-300k
- E500/500E: ฿800k-2M (Hammer, collector)

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
- 500SEL/560SEL/560SEC: ฿300-700k

═══════════════════════════════════════════════════════════
COMMON ISSUES BY SUB-MODEL
═══════════════════════════════════════════════════════════

W140 — ALL:
- Vacuum system (HVAC + central locking + soft-close)
- Climate control units degrade
- Seat memory motors

W140 Phase 1-2 (1991-1995):
- ⚠ BIODEGRADABLE WIRING — must ask "ทำสายไฟแล้วหรือยัง?"
- Wiring harness replacement: ฿80-150k

W140 M104 (S280/S320):
- Head gasket — 1992-1994 batches

W140 M119 (S420/S500):
- Chain, guide, tensioner wear
- Oil feeder tube (upgrade to metal recommended)
- Valve cover gasket
- Oil consumption

W140 M120 (S600/S70):
- V12 wiring complexity
- ABC suspension (S600/S70 only) — ฿200-500k repair
- Chain tensioner x2

W124 1992-1995:
- BIODEGRADABLE WIRING
- HVAC vacuum leaks
- M103/M104 head gasket
- Subframe bushings

W210 1995-1999:
- RUST (rear arches, doors, subframe) — MAJOR
- M112 oil pump failure (1997-1998)

═══════════════════════════════════════════════════════════
MAINTENANCE ROADMAP BY AGE
═══════════════════════════════════════════════════════════

For 30+ year cars (W124, W126, W201):
- Priority 1: Wiring inspection, vacuum overhaul, cooling refresh
- Priority 2: Brake hoses, fuel hoses, transmission service
- Priority 3: Engine seals, AC service

For 25-30 year cars (W140 early, W202):
- Wiring (if 1992-1995)
- HVAC overhaul
- ABC fluid (S600/S70)
- Direct ignition coils (Phase 3 W140)

═══════════════════════════════════════════════════════════
RESPONSE STYLE
═══════════════════════════════════════════════════════════

LANGUAGE:
- Thai ONLY
- ALWAYS use "ครับ" — NEVER "ค่ะ" (Mr.Chuti is male)
- Warm, expert tone

STRUCTURE (mandatory):
1. ทักทาย + ขอบคุณ (1-2 lines)
2. ผลการถอดรหัส VIN (high-confidence facts with ✓)
3. If web search found datacard → quote findings with source
4. If Data Card image uploaded → list ALL options decoded with codes
5. ยืนยันรุ่นรถ + sub-model + phase + market positioning
6. Sub-model character (insider view)
7. ปัญหาที่ต้องเช็ค (specific to batch + age)
8. Maintenance recommendations
9. Market value estimate (฿)
10. อะไหล่ในสต็อก (if context provided)
11. ขอข้อมูลเพิ่ม (only if datacard NOT provided)
12. CTA + Sign

EMOJI: 3-5 max — 📋 ✓ ⚠ 🔧 📦 💰 🎁 🎯

LENGTH: 500-900 words (longer if Data Card present)

CONFIDENCE MARKERS:
- ✓ "ผมตรวจสอบได้แน่นอน" (high — from VIN + verified database)
- 🌐 "ผมค้นจาก online database" (medium-high — from web search)
- 📷 "ผม decode จาก Data Card" (high — from image OCR/vision)
- 🟡 "ผมประมาณการ" (medium)
- ⚠ "ผมไม่สามารถยืนยัน" (low — flag for follow-up)

SIGN:
"— Mr.Chuti, ChutiBenz · 10+ ปีในวงการ · W140 S70 AMG (1 of 27 worldwide)
ผู้เขียน W140 Buyer Guide (80+ pages)"

Return ONLY the response message ready for LINE. No preamble.`

// Helper: query relevant stock for a chassis
async function getRelevantStock(carModel: string | null): Promise<string> {
  if (!carModel || carModel === 'other') return ''

  try {
    const { data: products } = await supabase
      .from('products')
      .select('part_number, name, price, oem_number, category, stock_qty')
      .eq('is_published', true)
      .contains('compatible_models', [carModel])
      .limit(20)

    if (!products || products.length === 0) {
      return `\n\nAVAILABLE STOCK for ${carModel}: ไม่มีอะไหล่ตรงรุ่นใน online catalog — แต่ผมมีในคลังเยอะ ลูกค้าสอบถามได้ครับ`
    }

    const stockList = products
      .map((p: any) => {
        const qty = p.stock_qty > 0 ? `(มี ${p.stock_qty})` : '(สั่งจากคลัง)'
        return `- ${p.part_number || ''} ${p.name || ''} ฿${p.price || '?'} ${qty}`
      })
      .join('\n')

    return `\n\nAVAILABLE STOCK for ${carModel} (online catalog only):\n${stockList}\n\nMention these specifically when recommending parts.`
  } catch (e) {
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

    // Build message content (multi-part if datacard image present)
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
${stockContext}

${hasDataCard
  ? '✅ Data Card image IS provided (see image below). Use vision to decode ALL option codes, paint code, interior code.'
  : '⚠ Data Card image NOT provided. Recommend customer to send via LINE for color/option decode.'}

Please:
1. Decode VIN using body codes table
2. Use web search to find this VIN in databases (carlytics.eu, mb-info, mercedes-benz datacard)
3. If Data Card image is attached, decode ALL option codes from it
4. Combine ALL sources into comprehensive Thai response
5. Use "ครับ" — never "ค่ะ"
6. Sign as "Mr.Chuti, ChutiBenz · 10+ ปีในวงการ · W140 S70 AMG (1 of 27)"`,
      },
    ]

    // If Data Card image is provided, add to message
    if (hasDataCard) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'url',
          url: vinRequest.data_card_url,
        },
      })
    }

    // Call Claude API with web search tool (if available) + vision
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const claudeRequestBody: any = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
    }

    // V4: Add web_search tool (Anthropic's hosted tool)
    // Note: Requires anthropic-version header that supports it
    claudeRequestBody.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
      },
    ]

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(claudeRequestBody),
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error('Claude API error:', errorText)

      // V4 fallback: Retry without web_search if tool not supported
      const fallbackBody = { ...claudeRequestBody }
      delete fallbackBody.tools

      const fallbackResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(fallbackBody),
      })

      if (!fallbackResponse.ok) {
        const fallbackError = await fallbackResponse.text()
        return NextResponse.json(
          { error: 'AI generation failed', details: fallbackError },
          { status: 500 }
        )
      }

      const fallbackData = await fallbackResponse.json()
      const fallbackDraft = fallbackData.content
        ?.filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n\n') || ''

      await supabase
        .from('vin_check_requests')
        .update({
          ai_draft: fallbackDraft,
          ai_generated_at: new Date().toISOString(),
          ai_model: 'claude-haiku-4-5-v4-fallback',
          status: 'in_progress',
        })
        .eq('id', request_id)

      return NextResponse.json({ draft: fallbackDraft, success: true, web_search_used: false })
    }

    const claudeData = await claudeResponse.json()

    // Extract text from response (skip tool_use blocks)
    const draft = claudeData.content
      ?.filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n\n') || ''

    // Check if web search was used
    const webSearchUsed = claudeData.content?.some(
      (c: any) => c.type === 'tool_use' || c.type === 'web_search_tool_result'
    )

    // Save draft
    const { error: updateError } = await supabase
      .from('vin_check_requests')
      .update({
        ai_draft: draft,
        ai_generated_at: new Date().toISOString(),
        ai_model: webSearchUsed ? 'claude-haiku-4-5-v4-web' : 'claude-haiku-4-5-v4',
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
    })
  } catch (error) {
    console.error('Generate draft error:', error)
    return NextResponse.json(
      { error: 'Server error', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}
