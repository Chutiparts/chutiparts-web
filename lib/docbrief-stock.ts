// lib/docbrief-stock.ts — Profile A orchestrator: ใบส่งของ → doc_documents(profile=stock) + doc_line_items
//
// A2 = ถึงขั้น "รอตรวจ" (pending_review) พร้อมรายการทีละบรรทัดให้ owner แก้
// A3 (คนละไฟล์ทีหลัง) = ยืนยัน → เข้า stock_records + แถบรับเข้า
import type { SupabaseClient } from '@supabase/supabase-js'
import { DOC_BUCKET } from './docbrief-intake'
import { extractStockBill, type StockLine } from './docbrief-extract-stock'

const THB_PER_USD = Number(process.env.THB_PER_USD || 35)

async function audit(
  db: SupabaseClient, documentId: string | null, actor: string,
  action: string, from: string | null, to: string | null, metadata?: unknown,
) {
  await db.from('doc_audit').insert({
    document_id: documentId, actor, action, from_state: from, to_state: to, metadata: metadata ?? null,
  })
}

export interface StockExtractOutcome {
  ok: boolean
  message?: string
  lineCount?: number
  costThb?: number
}

/**
 * อ่านใบส่งของที่ queued อยู่ → เขียน doc_line_items → pending_review
 * โครงเลียน extractDocument (Profile B) แต่เก็บเป็นหลายบรรทัด
 */
export async function extractStockDocument(
  db: SupabaseClient,
  documentId: string,
  actor = 'owner',
): Promise<StockExtractOutcome> {
  const { data: doc } = await db.from('doc_documents')
    .select('id, state, profile, mime_type, storage_path').eq('id', documentId).single()
  if (!doc) return { ok: false, message: 'ไม่พบเอกสาร' }
  if (doc.profile !== 'stock') return { ok: false, message: 'เอกสารนี้ไม่ใช่ประเภทสต็อก' }
  if (doc.state !== 'queued') return { ok: false, message: `สถานะไม่ใช่ queued (${doc.state})` }

  await db.from('doc_documents').update({ state: 'extracting', updated_at: new Date().toISOString() }).eq('id', documentId)
  await audit(db, documentId, actor, 'state.transition', 'queued', 'extracting')

  const fail = async (cat: string, msg: string) => {
    await db.from('doc_documents').update({
      state: 'failed', error_category: cat, error_message: msg, updated_at: new Date().toISOString(),
    }).eq('id', documentId)
    await audit(db, documentId, actor, 'extraction.failed', 'extracting', 'failed', { reason: cat, message: msg })
    return { ok: false as const, message: msg }
  }

  const dl = await db.storage.from(DOC_BUCKET).download(doc.storage_path!)
  if (dl.error || !dl.data) return fail('parse_error', `อ่านไฟล์ต้นฉบับไม่ได้: ${dl.error?.message ?? 'unknown'}`)
  const base64 = Buffer.from(await dl.data.arrayBuffer()).toString('base64')

  const started = Date.now()
  const r = await extractStockBill(base64, doc.mime_type)
  const latencyMs = Date.now() - started

  // บันทึก cost เสมอ (จ่ายเงินไปแล้วถึงจะ fail)
  if (r.costThb != null) {
    await db.from('doc_metrics').insert({
      document_id: documentId, model: 'claude-opus-4-8',
      input_tokens: 0, output_tokens: 0,
      cost_thb: Number(r.costThb.toFixed(4)), latency_ms: latencyMs,
    })
  }

  if (!r.ok || !r.data) return fail(r.errorCategory ?? 'parse_error', r.message ?? 'อ่านไม่สำเร็จ')

  const ex = r.data
  if (ex.lines.length === 0) return fail('parse_error', 'ไม่พบรายการสินค้าในใบ')

  // ลบบรรทัดเดิม (กันซ้ำถ้า retry) แล้วเขียนใหม่
  await db.from('doc_line_items').delete().eq('document_id', documentId)
  const rows = ex.lines.map((l: StockLine, i: number) => ({
    document_id: documentId, line_no: i + 1,
    qty: l.qty, part_name: l.part_name, unit_price: l.unit_price, amount: l.amount,
    car_model: l.car_model, confidence: l.confidence,
    arithmetic_ok: l.arithmetic_ok, review_flags: l.review_flags,
  }))
  const ins = await db.from('doc_line_items').insert(rows)
  if (ins.error) return fail('parse_error', `บันทึกรายการไม่สำเร็จ: ${ins.error.message}`)

  // เก็บ header ลง doc_documents (ใช้ช่องเดิม: vendor_name, doc_date, grand_total)
  const docFlags: string[] = []
  if (!ex.total_check_ok) docFlags.push('total_mismatch')
  if (ex.lines.some((l) => l.review_flags.includes('name_uncertain') || l.review_flags.includes('name_missing'))) docFlags.push('name_review')

  await db.from('doc_documents').update({
    state: 'pending_review',
    vendor_name: ex.vendor_name, doc_date: ex.date_iso, grand_total: ex.grand_total,
    review_flags: docFlags, raw_extraction: ex as unknown as Record<string, unknown>,
    error_category: null, error_message: null, updated_at: new Date().toISOString(),
  }).eq('id', documentId)
  await audit(db, documentId, actor, 'state.transition', 'extracting', 'pending_review', {
    lines: ex.lines.length, total_check_ok: ex.total_check_ok, cost_thb: r.costThb,
  })

  return { ok: true, lineCount: ex.lines.length, costThb: r.costThb }
}

/** owner แก้บรรทัด (ชื่อ + เติม SKU/ราคาขาย/ที่เก็บ ฯลฯ) — A2 */
export interface LinePatch {
  id: string
  part_name?: string | null
  qty?: number | null
  unit_price?: number | null
  sku?: string | null
  set_price?: number | null
  location?: string | null
  category?: string | null
  oem?: string | null
  condition?: string | null
  note?: string | null
}

export async function saveStockLine(
  db: SupabaseClient, documentId: string, patch: LinePatch, actor = 'owner',
): Promise<{ ok: boolean; message?: string }> {
  const { data: doc } = await db.from('doc_documents').select('state, profile').eq('id', documentId).single()
  if (!doc || doc.profile !== 'stock') return { ok: false, message: 'ไม่พบเอกสารสต็อก' }
  if (doc.state !== 'pending_review') return { ok: false, message: 'แก้ได้เฉพาะตอนรอตรวจ' }

  const { id, ...fields } = patch
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) clean[k] = v
  if (Object.keys(clean).length === 0) return { ok: true }

  // ถ้าแก้ qty/unit_price → คำนวณ amount + arithmetic ใหม่
  if ('qty' in clean || 'unit_price' in clean) {
    const { data: cur } = await db.from('doc_line_items').select('qty, unit_price').eq('id', id).single()
    const q = (clean.qty ?? cur?.qty) as number | null
    const u = (clean.unit_price ?? cur?.unit_price) as number | null
    if (q != null && u != null) {
      clean.amount = Number((q * u).toFixed(2))
      clean.arithmetic_ok = true
    }
  }
  clean.updated_at = new Date().toISOString()

  const { error } = await db.from('doc_line_items').update(clean).eq('id', id).eq('document_id', documentId)
  if (error) return { ok: false, message: error.message }
  await audit(db, documentId, actor, 'line.edited', null, null, { line_id: id, fields: Object.keys(clean) })
  return { ok: true }
}
