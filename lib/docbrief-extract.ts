// lib/docbrief-extract.ts — docbrief Phase 2 (Parse): ดึงข้อมูลจากบิลด้วย Claude vision
// สเปก: phase-0-decision-doc.md §3 (field spec) · §6 (metrics/cost) · §7 (error taxonomy)
// pattern: เรียก Anthropic ผ่าน fetch ตรง เหมือน app/api/quotes/[id]/analyze/route.ts (ไม่เพิ่ม dependency)
import type { SupabaseClient } from '@supabase/supabase-js'
import { DOC_BUCKET } from './docbrief-intake'
import { validateDocument } from './docbrief-validate'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 8000

// §1 cost cap (บาท/ใบ) — ปรับได้ผ่าน env
const SOFT_CAP_THB = Number(process.env.DOCBRIEF_SOFT_CAP_THB || 2)
const HARD_CAP_THB = Number(process.env.DOCBRIEF_HARD_CAP_THB || 4)
const THB_PER_USD = Number(process.env.THB_PER_USD || 35)
// ราคา Opus 4.8: $5 / 1M input · $25 / 1M output
const USD_IN_PER_TOKEN = 5 / 1_000_000
const USD_OUT_PER_TOKEN = 25 / 1_000_000

const SYSTEM_PROMPT = `คุณคือผู้ช่วยคีย์ข้อมูลเอกสารการเงินของร้านอะไหล่รถยนต์ในประเทศไทย

หน้าที่: อ่าน "บิลซื้อจากผู้ขาย (vendor)" — ใบกำกับภาษี / ใบเสร็จ / invoice — แล้วดึงข้อมูลออกมาตามโครงสร้างที่กำหนด

กฎเหล็ก:
- ดึงเฉพาะสิ่งที่ "เห็นจริงในเอกสาร" เท่านั้น — ห้ามเดา ห้ามเติมเอง ห้ามคำนวณแทนถ้าเอกสารไม่ได้เขียนไว้
- ถ้าหาค่าไหนไม่เจอ หรือไม่มั่นใจว่าอ่านถูก ให้ใส่ null — การใส่ null ดีกว่าการเดาผิด
- ตัวเลขเงิน: ตัด "฿" "บาท" และ comma ออก คืนเป็นตัวเลขล้วน (เช่น 1,234.50 → 1234.50)
- วันที่: คืน doc_date_raw ตามที่พิมพ์ในเอกสารเป๊ะ ๆ (เช่น "31/12/2567") และคืน doc_date_iso เป็น ค.ศ. รูปแบบ YYYY-MM-DD (พ.ศ. ลบ 543)
- เลขผู้เสียภาษี: เอาเฉพาะตัวเลข 13 หลักของ "ผู้ขาย" (ไม่ใช่ของผู้ซื้อ/ร้านเรา) ถ้าแยกไม่ออกให้ใส่ null
- confidence: ให้คะแนน 0-1 ต่อ field ตามความมั่นใจในการอ่านจริง ๆ (อ่านชัด=สูง, เดา/เบลอ=ต่ำ)`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'vendor_name', 'vendor_tax_id', 'doc_no', 'doc_date_raw', 'doc_date_iso',
    'subtotal', 'vat', 'grand_total', 'currency', 'confidence', 'notes',
  ],
  properties: {
    vendor_name: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'ชื่อผู้ขาย/ร้านที่ออกบิล' },
    vendor_tax_id: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'เลขผู้เสียภาษี 13 หลักของผู้ขาย' },
    doc_no: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'เลขที่เอกสาร' },
    doc_date_raw: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'วันที่ตามที่พิมพ์ในเอกสารเป๊ะ ๆ' },
    doc_date_iso: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'วันที่แปลงเป็น ค.ศ. YYYY-MM-DD' },
    subtotal: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'ยอดก่อน VAT' },
    vat: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'ภาษีมูลค่าเพิ่ม' },
    grand_total: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'ยอดสุทธิ' },
    currency: { type: 'string', description: 'สกุลเงิน (THB ถ้าไม่ระบุ)' },
    confidence: {
      type: 'object',
      additionalProperties: false,
      required: ['vendor_name', 'vendor_tax_id', 'doc_no', 'doc_date', 'subtotal', 'vat', 'grand_total'],
      properties: {
        vendor_name: { type: 'number' }, vendor_tax_id: { type: 'number' },
        doc_no: { type: 'number' }, doc_date: { type: 'number' },
        subtotal: { type: 'number' }, vat: { type: 'number' }, grand_total: { type: 'number' },
      },
    },
    notes: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'สิ่งผิดปกติที่คนควรรู้ (เช่น เอกสารเบลอบางส่วน)' },
  },
} as const

export interface ExtractResult {
  ok: boolean
  errorCategory?: 'ocr_unreadable' | 'parse_error' | 'cost_limit'
  message?: string
  costThb?: number
}

// แปลง พ.ศ. → ค.ศ. ซ้ำอีกชั้นแบบ deterministic (§4.3) — ไม่เชื่อโมเดล 100%
function normalizeIsoDate(iso: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  let year = Number(m[1])
  if (year > 2400) year -= 543
  return `${String(year).padStart(4, '0')}-${m[2]}-${m[3]}`
}

export async function extractDocument(
  db: SupabaseClient,
  documentId: string,
  actor = 'owner',
): Promise<ExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, errorCategory: 'parse_error', message: 'ANTHROPIC_API_KEY ไม่ได้ตั้งค่า' }

  const { data: doc } = await db.from('doc_documents')
    .select('id, state, mime_type, storage_path').eq('id', documentId).single()
  if (!doc) return { ok: false, errorCategory: 'parse_error', message: 'ไม่พบเอกสาร' }
  if (doc.state !== 'queued') {
    return { ok: false, errorCategory: 'parse_error', message: `สถานะไม่ใช่ queued (${doc.state})` }
  }

  const audit = (action: string, from: string | null, to: string | null, metadata?: unknown) =>
    db.from('doc_audit').insert({
      document_id: documentId, actor, action, from_state: from, to_state: to, metadata: metadata ?? null,
    })

  // queued → extracting
  await db.from('doc_documents').update({ state: 'extracting', updated_at: new Date().toISOString() }).eq('id', documentId)
  await audit('state.transition', 'queued', 'extracting')

  const fail = async (cat: ExtractResult['errorCategory'], msg: string) => {
    await db.from('doc_documents').update({
      state: 'failed', error_category: cat, error_message: msg, updated_at: new Date().toISOString(),
    }).eq('id', documentId)
    await audit('extraction.failed', 'extracting', 'failed', { reason: cat, message: msg })
    return { ok: false as const, errorCategory: cat, message: msg }
  }

  // ดึงไฟล์ต้นฉบับจาก storage
  const dl = await db.storage.from(DOC_BUCKET).download(doc.storage_path!)
  if (dl.error || !dl.data) return fail('parse_error', `อ่านไฟล์ต้นฉบับไม่ได้: ${dl.error?.message ?? 'unknown'}`)
  const base64 = Buffer.from(await dl.data.arrayBuffer()).toString('base64')

  // PDF ส่งเป็น document block · รูปส่งเป็น image block
  const media = doc.mime_type === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: doc.mime_type, data: base64 } }

  const started = Date.now()
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
        messages: [{ role: 'user', content: [media, { type: 'text', text: 'ดึงข้อมูลจากบิลใบนี้ตามโครงสร้างที่กำหนด' }] }],
      }),
    })
  } catch (e) {
    return fail('ocr_unreadable', `เรียก Claude ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
  }
  const latencyMs = Date.now() - started

  if (!res.ok) {
    const txt = await res.text()
    return fail('ocr_unreadable', `Claude error ${res.status}: ${txt.slice(0, 300)}`)
  }

  const data = await res.json()

  // §refusal — ต้องเช็คก่อนอ่าน content
  if (data.stop_reason === 'refusal') {
    return fail('parse_error', `โมเดลปฏิเสธคำขอ (${data.stop_details?.category ?? 'unknown'})`)
  }

  // บันทึก cost/metrics ก่อนเสมอ (ถึงจะ parse ไม่ผ่านก็จ่ายเงินไปแล้ว)
  const usage = data.usage ?? {}
  const inTok = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
  const outTok = usage.output_tokens ?? 0
  const costThb = (inTok * USD_IN_PER_TOKEN + outTok * USD_OUT_PER_TOKEN) * THB_PER_USD
  await db.from('doc_metrics').insert({
    document_id: documentId, model: data.model ?? MODEL,
    input_tokens: inTok, output_tokens: outTok,
    cost_thb: Number(costThb.toFixed(4)), latency_ms: latencyMs,
  })

  if (costThb > HARD_CAP_THB) {
    return fail('cost_limit', `ต้นทุนเกินเพดาน: ${costThb.toFixed(2)} บาท (จำกัด ${HARD_CAP_THB})`)
  }

  const textBlock = data.content?.find((c: { type: string }) => c.type === 'text')
  if (!textBlock?.text) return fail('parse_error', 'โมเดลไม่คืนข้อมูล')

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    return fail('parse_error', 'ผลลัพธ์ไม่ใช่ JSON ที่อ่านได้')
  }

  const fields = {
    vendor_name: (parsed.vendor_name as string) ?? null,
    vendor_tax_id: (parsed.vendor_tax_id as string) ?? null,
    doc_no: (parsed.doc_no as string) ?? null,
    doc_date: normalizeIsoDate((parsed.doc_date_iso as string) ?? null),
    subtotal: (parsed.subtotal as number) ?? null,
    vat: (parsed.vat as number) ?? null,
    grand_total: (parsed.grand_total as number) ?? null,
    currency: (parsed.currency as string) || 'THB',
    confidence: (parsed.confidence as Record<string, number>) ?? null,
  }

  // §4 Validate ทันทีหลัง extract — ตั้งธงให้คนดู (ไม่ตัดสินใจแทน)
  const { flags, issues } = validateDocument(fields)
  if (costThb > SOFT_CAP_THB) flags.push('cost_soft_cap')

  // extracting → pending_review (ทุกใบต้องผ่านคนตรวจ — ไม่มี auto-export §2)
  await db.from('doc_documents').update({
    state: 'pending_review',
    ...fields,
    raw_extraction: { ...parsed, _issues: issues },
    review_flags: flags,
    updated_at: new Date().toISOString(),
  }).eq('id', documentId)

  await audit('extraction.completed', 'extracting', 'pending_review', {
    cost_thb: Number(costThb.toFixed(4)), input_tokens: inTok, output_tokens: outTok,
    latency_ms: latencyMs, flags, issues,
  })

  return { ok: true, costThb }
}
