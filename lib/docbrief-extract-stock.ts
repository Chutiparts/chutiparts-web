// lib/docbrief-extract-stock.ts — Profile A (Stock intake): อ่าน "ใบส่งของ" แตกเป็นรายการทีละบรรทัด
//
// ต่างจาก Profile B (docbrief-extract.ts) ที่ดึง "ยอดรวมทั้งใบ" — ตัวนี้ดึง "รายการทีละบรรทัด"
// เพื่อเอาเข้าสต็อก · ใช้ pattern เดียวกัน (fetch ตรง, structured output, cost cap)
//
// หลักการเชื่อถือ (บทเรียนจาก Profile B §9):
//   - ตัวเลข (จำนวน/ราคา) เชื่อได้ถ้าบวกคูณลงตัว → ใช้ arithmetic เป็นสัญญาณหลัก
//   - ชื่ออะไหล่ลายมือ โมเดลเดาพลาดได้ → ต้องผ่านตา owner เสมอ (ห้ามเข้าสต็อกอัตโนมัติ)
import type { SupabaseClient } from '@supabase/supabase-js'
import { DOC_BUCKET } from './docbrief-intake'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 8000

// cost cap เดียวกับ Profile B (ปรับผ่าน env ชุดเดียวกัน)
const HARD_CAP_THB = Number(process.env.DOCBRIEF_HARD_CAP_THB || 4)
const THB_PER_USD = Number(process.env.THB_PER_USD || 35)
const USD_IN_PER_TOKEN = 5 / 1_000_000
const USD_OUT_PER_TOKEN = 25 / 1_000_000

// tolerance การคูณต่อบรรทัด (บาท) — เผื่อปัดเศษ
const LINE_ARITH_TOL = 1.0

const SYSTEM_PROMPT = `คุณคือผู้ช่วยคีย์ "ใบส่งของ" (delivery bill / 送貨單) ของร้านอะไหล่รถยนต์ในไทย

หน้าที่: อ่านตารางรายการสินค้าในใบส่งของ แล้วดึง "ทุกบรรทัดที่มีของ" ออกมาทีละรายการ

โครงตารางทั่วไป (ซ้าย→ขวา): จำนวน | รายการ/ชื่อสินค้า | หน่วยละ(ราคา/ชิ้น) | จำนวนเงิน(รวมบรรทัด)

กฎเหล็ก:
- ดึงเฉพาะบรรทัดที่ "มีของจริง" — ข้ามบรรทัดว่าง
- ห้ามเดา ห้ามเติมของที่ไม่มีในเอกสาร ถ้าอ่านช่องไหนไม่ออกให้ใส่ null (null ดีกว่าเดาผิด)
- ตัวเลข: ตัด comma/฿/บาท ออก คืนเป็นเลขล้วน (15,000 → 15000)
- part_name: คัดลอกตามที่เขียนเป๊ะ ๆ รวมรุ่นรถถ้ามี (เช่น "กระจังหน้า W140")
- car_model: ถ้าเห็นรหัสรุ่น (W140, W124, W126 ...) ในบรรทัด ให้แยกออกมาด้วย ถ้าไม่มีใส่ null
- ลายมือ: อ่านเท่าที่มั่นใจ ให้ confidence ต่ำถ้าเดา — อย่าแต่งชื่อให้สวยเกินจริง
- header: date_raw = วันที่ตามที่เขียน, date_iso = ค.ศ. YYYY-MM-DD (พ.ศ.−543), grand_total = ยอดรวมล่างสุด
- ห้ามคำนวณ amount แทนเอกสาร — ถ้าช่องจำนวนเงินว่าง ให้ amount = null (ระบบจะคำนวณเองทีหลัง)`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['vendor_name', 'date_raw', 'date_iso', 'grand_total', 'lines', 'notes'],
  properties: {
    vendor_name: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'ชื่อผู้ขาย/ผู้ส่งของ ถ้าอ่านออก' },
    date_raw: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'วันที่ตามที่เขียนเป๊ะ ๆ' },
    date_iso: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'วันที่เป็น ค.ศ. YYYY-MM-DD' },
    grand_total: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'ยอดรวมทั้งใบ (ช่อง TOTAL)' },
    lines: {
      type: 'array',
      description: 'รายการสินค้าทีละบรรทัด เรียงตามที่ปรากฏในใบ',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['qty', 'part_name', 'unit_price', 'amount', 'car_model', 'confidence'],
        properties: {
          qty: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'จำนวน' },
          part_name: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'ชื่ออะไหล่ตามที่เขียน' },
          unit_price: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'ราคาต่อชิ้น (หน่วยละ)' },
          amount: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'จำนวนเงินรวมบรรทัด' },
          car_model: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'รหัสรุ่นรถถ้ามี' },
          confidence: { type: 'number', description: 'ความมั่นใจในการอ่านบรรทัดนี้ 0..1' },
        },
      },
    },
    notes: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'สิ่งผิดปกติที่คนควรรู้' },
  },
} as const

export interface StockLine {
  qty: number | null
  part_name: string | null
  unit_price: number | null
  amount: number | null
  car_model: string | null
  confidence: number
  arithmetic_ok: boolean
  review_flags: string[]
}

export interface StockExtraction {
  vendor_name: string | null
  date_raw: string | null
  date_iso: string | null
  grand_total: number | null
  lines: StockLine[]
  notes: string | null
  total_check_ok: boolean // ผลรวม amount ตรงกับ grand_total ไหม
}

export interface StockExtractResult {
  ok: boolean
  errorCategory?: 'ocr_unreadable' | 'parse_error' | 'cost_limit'
  message?: string
  costThb?: number
  data?: StockExtraction
}

function normalizeIsoDate(iso: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  let year = Number(m[1])
  if (year > 2400) year -= 543
  return `${String(year).padStart(4, '0')}-${m[2]}-${m[3]}`
}

// ประเมินบรรทัด: เช็กคูณ + ตั้งธงเตือน
function assessLine(raw: {
  qty: number | null; part_name: string | null; unit_price: number | null
  amount: number | null; car_model: string | null; confidence: number
}): StockLine {
  const flags: string[] = []
  let arithmeticOk = false

  if (raw.qty != null && raw.unit_price != null && raw.amount != null) {
    if (Math.abs(raw.qty * raw.unit_price - raw.amount) <= LINE_ARITH_TOL) arithmeticOk = true
    else flags.push('arithmetic_mismatch')
  }
  if (!raw.part_name || !raw.part_name.trim()) flags.push('name_missing')
  else if ((raw.confidence ?? 0) < 0.6) flags.push('name_uncertain')
  if (raw.qty == null) flags.push('qty_missing')
  if (raw.unit_price == null && raw.amount == null) flags.push('price_missing')

  return { ...raw, arithmetic_ok: arithmeticOk, review_flags: flags }
}

/**
 * อ่านใบส่งของ 1 ใบ → คืนรายการทีละบรรทัด (ยังไม่เขียน DB — A2 จะเอาไปทำต่อ)
 * รับ base64 + mime ตรง ๆ เพื่อให้ทดสอบนอก DB ได้ (ตัว orchestrator ค่อยดึงจาก storage)
 */
export async function extractStockBill(
  base64: string,
  mimeType: string,
): Promise<StockExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, errorCategory: 'parse_error', message: 'ANTHROPIC_API_KEY ไม่ได้ตั้งค่า' }

  const media = mimeType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }

  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: [media, { type: 'text', text: 'อ่านใบส่งของใบนี้ แตกรายการสินค้าทีละบรรทัดตามโครงสร้างที่กำหนด' }] }],
      }),
    })
  } catch (e) {
    return { ok: false, errorCategory: 'ocr_unreadable', message: `เรียก Claude ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (!res.ok) {
    const txt = await res.text()
    return { ok: false, errorCategory: 'ocr_unreadable', message: `Claude error ${res.status}: ${txt.slice(0, 300)}` }
  }

  const apiData = await res.json()
  if (apiData.stop_reason === 'refusal') {
    return { ok: false, errorCategory: 'parse_error', message: 'โมเดลปฏิเสธคำขอ' }
  }

  const usage = apiData.usage ?? {}
  const inTok = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
  const outTok = usage.output_tokens ?? 0
  const costThb = (inTok * USD_IN_PER_TOKEN + outTok * USD_OUT_PER_TOKEN) * THB_PER_USD

  if (costThb > HARD_CAP_THB) {
    return { ok: false, errorCategory: 'cost_limit', message: `ต้นทุนเกินเพดาน: ${costThb.toFixed(2)} บาท`, costThb }
  }

  const textBlock = apiData.content?.find((c: { type: string }) => c.type === 'text')
  if (!textBlock?.text) return { ok: false, errorCategory: 'parse_error', message: 'โมเดลไม่คืนข้อมูล', costThb }

  let parsed: {
    vendor_name: string | null; date_raw: string | null; date_iso: string | null
    grand_total: number | null; notes: string | null
    lines: Array<{ qty: number | null; part_name: string | null; unit_price: number | null; amount: number | null; car_model: string | null; confidence: number }>
  }
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    return { ok: false, errorCategory: 'parse_error', message: 'อ่าน JSON ไม่ได้', costThb }
  }

  const lines = (parsed.lines ?? []).map(assessLine)

  // เช็กผลรวม: Σ amount ≈ grand_total (สัญญาณว่าอ่านครบทุกบรรทัด)
  const sumAmount = lines.reduce((s, l) => s + (l.amount ?? 0), 0)
  const total_check_ok = parsed.grand_total != null && Math.abs(sumAmount - parsed.grand_total) <= LINE_ARITH_TOL

  return {
    ok: true,
    costThb,
    data: {
      vendor_name: parsed.vendor_name,
      date_raw: parsed.date_raw,
      date_iso: normalizeIsoDate(parsed.date_iso),
      grand_total: parsed.grand_total,
      lines,
      notes: parsed.notes,
      total_check_ok,
    },
  }
}
