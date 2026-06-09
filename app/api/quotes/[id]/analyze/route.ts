// app/api/quotes/[id]/analyze/route.ts — AI Vision + Stock Match
// Phase 1A · Day 2 — 2026-06-09
//
// Flow:
//   1. Read quote by id
//   2. Fetch each photo URL → base64
//   3. Send to Sonnet 4.6 Vision → identify Mercedes part
//   4. Fetch Google Sheet stock CSV → fuzzy match
//   5. Update quote with ai_* + matched_* fields
//
// Trigger:
//   - Auto-called from /api/quotes/create (fire-and-forget)
//   - Or manually: POST /api/quotes/{id}/analyze (admin)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60  // Vision + stock fetch

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const STOCK_CSV_URL = process.env.STOCK_SHEET_CSV_URL || ''
const ANALYZE_SECRET = process.env.QUOTE_ANALYZE_SECRET || ''

const SONNET_MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `คุณเป็นผู้เชี่ยวชาญอะไหล่ Mercedes-Benz classic (W123, W124, W126, W140, W201, W202, W210, R107, R129)

หน้าที่: ดูรูปอะไหล่ที่ลูกค้าส่งมา + รุ่นรถที่บอก → ระบุว่าเป็นอะไหล่ชิ้นอะไร

ตอบเป็น JSON เท่านั้น (ไม่มี markdown):
{
  "part_name_thai": "ชื่อภาษาไทย เช่น ไฟท้ายฝั่งซ้าย, กันชนหน้า, กระจังหน้า",
  "part_name_en": "english name if applicable",
  "confidence": 0-100,
  "oem_guess": "OEM number ถ้าเดาได้ เช่น 1408201661 หรือ null",
  "vehicle_match": "รุ่นที่เห็นในรูปตรงกับที่ลูกค้าบอกไหม (yes/no/uncertain)",
  "condition_notes": "สภาพอะไหล่ที่เห็นจากรูป (สั้นๆ เช่น สภาพดี ไม่มีตำหนิ / มีรอยขีดข่วน / มีสนิม)",
  "additional_questions": "คำถามที่ควรถามลูกค้าเพิ่ม (สั้นๆ ถ้ามี)"
}

หลักการ:
- ถ้ารูปไม่ชัดหรือเดาไม่ได้ → confidence ต่ำ + บอกเหตุผล
- เน้นความถูกต้อง ไม่ต้องเดามั่ว
- ใช้ศัพท์ที่ทีมช่างไทยเข้าใจ`

interface ClaudeResponse {
  part_name_thai: string
  part_name_en?: string
  confidence: number
  oem_guess: string | null
  vehicle_match: string
  condition_notes: string
  additional_questions?: string
}

// ============================================================
// Helpers
// ============================================================

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mediaType = res.headers.get('content-type') || 'image/jpeg'
    const base64 = Buffer.from(buf).toString('base64')
    return { data: base64, mediaType }
  } catch (e) {
    console.error('[analyze] fetchImage error:', e)
    return null
  }
}

async function callSonnetVision(
  photos: { data: string; mediaType: string }[],
  vehicleModel: string,
  vehicleYear: number | null,
  partDescription: string | null
): Promise<ClaudeResponse | null> {
  if (!ANTHROPIC_API_KEY) {
    console.error('[analyze] ANTHROPIC_API_KEY missing')
    return null
  }

  const userMessage = [
    { type: 'text' as const, text: `รถลูกค้า: ${vehicleModel}${vehicleYear ? ` ปี ${vehicleYear}` : ''}\nรายละเอียดเพิ่ม: ${partDescription || '(ไม่ระบุ)'}\n\nวิเคราะห์รูปนี้:` },
    ...photos.map((p) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: p.mediaType,
        data: p.data,
      },
    })),
  ]

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const errTxt = await res.text()
      console.error('[analyze] Sonnet error:', res.status, errTxt.slice(0, 500))
      return null
    }

    const data = await res.json()
    const textBlock = data.content?.find((c: any) => c.type === 'text')
    if (!textBlock?.text) return null

    // Extract JSON (strip ```json fences if any)
    let jsonStr = textBlock.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(json)?\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(jsonStr) as ClaudeResponse
    return parsed
  } catch (e) {
    console.error('[analyze] Sonnet call error:', e)
    return null
  }
}

// ============================================================
// Stock match — simple keyword + chassis search
// ============================================================

interface StockRow {
  sku: string
  name: string
  category: string
  chassis: string
  oem: string
  price: number
  status_label: string
}

async function fetchStock(): Promise<StockRow[]> {
  if (!STOCK_CSV_URL) return []

  try {
    const res = await fetch(STOCK_CSV_URL, { cache: 'no-store' })
    if (!res.ok) return []
    const csv = await res.text()
    const lines = csv.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return []

    const rows: StockRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i])
      if (cols.length < 12) continue
      const sku = (cols[0] || '').trim()
      const name = (cols[1] || '').trim()
      const category = (cols[2] || '').trim()
      const chassis = (cols[3] || '').trim()
      const oem = (cols[6] || '').trim()
      const price = parseFloat((cols[9] || '').replace(/[^0-9.]/g, '')) || 0
      const status_label = (cols[11] || '').trim()
      if (!sku || !name) continue
      rows.push({ sku, name, category, chassis, oem, price, status_label })
    }
    return rows
  } catch (e) {
    console.error('[analyze] Stock fetch error:', e)
    return []
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"' && line[i + 1] === '"') {
      cur += '"'
      i++
    } else if (c === '"') {
      inQ = !inQ
    } else if (c === ',' && !inQ) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

function scoreMatch(stock: StockRow, ai: ClaudeResponse, requestedChassis: string): number {
  let score = 0

  // OEM exact match — high signal
  if (ai.oem_guess && stock.oem) {
    const aiOem = ai.oem_guess.replace(/\s+/g, '').toLowerCase()
    const stockOem = stock.oem.replace(/\s+/g, '').toLowerCase()
    if (aiOem === stockOem) score += 60
    else if (stockOem.includes(aiOem) || aiOem.includes(stockOem)) score += 30
  }

  // Chassis match — required
  const reqChassis = requestedChassis.toUpperCase()
  const stockChassis = stock.chassis.toUpperCase()
  if (stockChassis.includes(reqChassis) || reqChassis.includes(stockChassis)) {
    score += 30
  } else if (reqChassis) {
    // chassis mismatch is a strong negative
    return 0
  }

  // Part name keyword overlap (Thai)
  const aiName = ai.part_name_thai.toLowerCase()
  const stockName = stock.name.toLowerCase()

  // Common Mercedes part keywords (Thai)
  const keywords = [
    'ไฟท้าย', 'ไฟหน้า', 'ไฟเลี้ยว', 'ไฟเบรค',
    'กันชนหน้า', 'กันชนหลัง', 'กันชน',
    'กระจังหน้า', 'กระจัง',
    'กระจกมองข้าง', 'กระจกหน้า', 'กระจกหลัง', 'กระจกประตู',
    'ประตู', 'ฝากระโปรง', 'ฝาท้าย',
    'ล้อ', 'ฝาครอบล้อ', 'แม็ก',
    'แอร์', 'พัดลม', 'หม้อน้ำ',
    'ปั๊ม', 'มอเตอร์', 'คอม',
    'ไส้กรอง', 'ผ้าเบรค', 'ปะเก็น',
    'เบาะ', 'พรม', 'หลังคา',
  ]
  for (const kw of keywords) {
    if (aiName.includes(kw) && stockName.includes(kw)) {
      score += 15
      break // count once
    }
  }

  // Available status bonus
  if (/(พร้อมขาย|available|in stock|มีของ)/i.test(stock.status_label)) {
    score += 5
  }

  return Math.min(100, score)
}

function findBestStockMatch(stocks: StockRow[], ai: ClaudeResponse, chassis: string): {
  sku: string | null
  price: number | null
  confidence: number
} {
  if (stocks.length === 0 || !ai) return { sku: null, price: null, confidence: 0 }

  let best: { stock: StockRow; score: number } | null = null
  for (const s of stocks) {
    const score = scoreMatch(s, ai, chassis)
    if (score === 0) continue
    if (!best || score > best.score) best = { stock: s, score }
  }

  if (!best || best.score < 25) return { sku: null, price: null, confidence: 0 }

  return {
    sku: best.stock.sku,
    price: best.stock.price > 0 ? best.stock.price : null,
    confidence: best.score,
  }
}

// ============================================================
// Route handler
// ============================================================

async function runAnalyze(quoteId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) Read quote
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('id, vehicle_model, vehicle_year, part_description, photo_urls, ai_analyzed_at')
    .eq('id', quoteId)
    .single()

  if (qErr || !quote) {
    return { ok: false, error: 'Quote not found' }
  }

  // 2) Skip if already analyzed (idempotent)
  if (quote.ai_analyzed_at) {
    return { ok: true, skipped: 'already_analyzed' }
  }

  const photoUrls: string[] = Array.isArray(quote.photo_urls) ? quote.photo_urls : []
  if (photoUrls.length === 0) {
    return { ok: false, error: 'No photos' }
  }

  // 3) Fetch images
  const images = await Promise.all(photoUrls.map(fetchImageAsBase64))
  const validImages = images.filter((x): x is { data: string; mediaType: string } => !!x)
  if (validImages.length === 0) {
    return { ok: false, error: 'Failed to fetch photos' }
  }

  // 4) Sonnet Vision
  const aiResult = await callSonnetVision(
    validImages,
    quote.vehicle_model,
    quote.vehicle_year,
    quote.part_description
  )

  if (!aiResult) {
    // Mark as analyzed (with no result) so we don't retry forever
    await supabase
      .from('quotes')
      .update({
        ai_analyzed_at: new Date().toISOString(),
        ai_part_guess: '(AI analysis failed)',
        ai_confidence: 0,
      })
      .eq('id', quoteId)
    return { ok: false, error: 'AI vision failed' }
  }

  // 5) Stock match
  const stocks = await fetchStock()
  const stockMatch = findBestStockMatch(stocks, aiResult, quote.vehicle_model)

  // 6) Update quote
  const updateData: any = {
    ai_part_guess: aiResult.part_name_thai,
    ai_confidence: aiResult.confidence,
    ai_oem_guess: aiResult.oem_guess || null,
    ai_analyzed_at: new Date().toISOString(),
  }

  if (stockMatch.sku) {
    updateData.matched_sku = stockMatch.sku
    updateData.matched_price = stockMatch.price
    updateData.match_confidence = stockMatch.confidence
    updateData.matched_at = new Date().toISOString()
  }

  // Append AI metadata to owner_note (for context)
  const noteAddon = [
    `🤖 AI: ${aiResult.part_name_thai} (${aiResult.confidence}%)`,
    aiResult.oem_guess ? `OEM guess: ${aiResult.oem_guess}` : '',
    aiResult.condition_notes ? `สภาพ: ${aiResult.condition_notes}` : '',
    aiResult.additional_questions ? `❓ ${aiResult.additional_questions}` : '',
    stockMatch.sku
      ? `📦 Stock match: ${stockMatch.sku} (฿${stockMatch.price?.toLocaleString() || '?'}) · ${stockMatch.confidence}%`
      : '📦 Stock match: ไม่พบสินค้าที่ตรง',
  ].filter(Boolean).join('\n')

  updateData.owner_note = noteAddon

  const { error: updErr } = await supabase
    .from('quotes')
    .update(updateData)
    .eq('id', quoteId)

  if (updErr) {
    console.error('[analyze] Update error:', updErr)
    return { ok: false, error: 'DB update failed' }
  }

  return {
    ok: true,
    ai: aiResult,
    stock_match: stockMatch,
  }
}

// ============================================================
// POST /api/quotes/[id]/analyze
// ============================================================

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  // Optional auth check (when called from create endpoint with secret)
  const auth = request.headers.get('authorization') || ''
  if (ANALYZE_SECRET && auth !== `Bearer ${ANALYZE_SECRET}`) {
    // Allow without secret if called from same origin (admin manual trigger)
    const referer = request.headers.get('referer') || ''
    const host = request.headers.get('host') || ''
    if (!referer.includes(host)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid secret' } },
        { status: 401 }
      )
    }
  }

  // Validate UUID
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid quote id' } },
      { status: 400 }
    )
  }

  const result = await runAnalyze(id)

  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

// Allow body-less trigger via GET too (for cron / debug)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return POST(request, context)
}
