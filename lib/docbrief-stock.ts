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

// ── Auto-SKU (สเปกจาก owner 2026-07-24) ────────────────────────────────
// รูปแบบจริงในระบบ: {chassis}-{NNN} เช่น 140-032 (chassis = รุ่นตัดตัว W ออก)
// นับต่อจากเลขสูงสุดของรุ่นนั้นใน stock_records + doc_line_items (กันชนกับใบที่ยังไม่ยืนยัน)

/** ดึงเลข chassis 3 หลักจากรุ่น/ชื่อ เช่น "W140" → "140", "กระจังหน้า W140" → "140" */
function chassisOf(carModel: string | null, partName: string | null): string | null {
  for (const s of [carModel, partName]) {
    const m = s && /w?\s*([12]\d{2})\b/i.exec(s)
    if (m) return m[1]
  }
  return null
}

/** เลขรันสูงสุดของ chassis นั้น จากทั้ง stock_records และ doc_line_items */
async function maxRunning(db: SupabaseClient, chassis: string): Promise<number> {
  let max = 0
  const scan = (rows: { sku: string | null }[] | null) => {
    for (const r of rows ?? []) {
      const m = r.sku && new RegExp(`^${chassis}-(\\d+)$`).exec(r.sku.trim())
      if (m) max = Math.max(max, Number(m[1]))
    }
  }
  const [stock, lines] = await Promise.all([
    db.from('stock_records').select('sku').ilike('sku', `${chassis}-%`),
    db.from('doc_line_items').select('sku').ilike('sku', `${chassis}-%`),
  ])
  scan(stock.data as { sku: string | null }[] | null)
  scan(lines.data as { sku: string | null }[] | null)
  return max
}

/**
 * เติม SKU อัตโนมัติให้บรรทัดที่ยังว่าง — เรียงต่อจากเลขสูงสุดจริงต่อรุ่น
 * ไม่ทับ SKU ที่ owner กรอกเองไว้แล้ว
 */
export async function assignSkusForDocument(
  db: SupabaseClient, documentId: string, actor = 'owner',
): Promise<{ ok: boolean; assigned: number }> {
  const { data: lines } = await db.from('doc_line_items')
    .select('id, line_no, car_model, part_name, sku').eq('document_id', documentId).order('line_no', { ascending: true })
  if (!lines?.length) return { ok: true, assigned: 0 }

  const next: Record<string, number> = {} // chassis → เลขถัดไปที่จะใช้
  let assigned = 0
  for (const l of lines) {
    if (l.sku && String(l.sku).trim()) continue // มีแล้ว ไม่ทับ
    const chassis = chassisOf(l.car_model, l.part_name)
    if (!chassis) continue // ไม่รู้รุ่น → ปล่อยว่างให้ owner กรอก
    if (next[chassis] === undefined) next[chassis] = (await maxRunning(db, chassis)) + 1
    const sku = `${chassis}-${String(next[chassis]).padStart(3, '0')}`
    next[chassis]++
    await db.from('doc_line_items').update({ sku, updated_at: new Date().toISOString() }).eq('id', l.id)
    assigned++
  }
  if (assigned) await audit(db, documentId, actor, 'sku.auto_assigned', null, null, { count: assigned })
  return { ok: true, assigned }
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

  // เติม SKU อัตโนมัติทันที (owner แก้ทับได้ในหน้าตรวจ)
  await assignSkusForDocument(db, documentId, actor)

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

// ── A3: ยืนยัน → เข้าสต็อกจริง (stock_records) ──────────────────────────
// ต้องครบทุกช่องจำเป็นก่อน: sku · part_name · qty · ต้นทุน · ราคาขาย · ที่เก็บ
// insert เพิ่มอย่างเดียว · ถ้า SKU ซ้ำของเดิม = บล็อก (กันเขียนทับ) ให้ owner จัดการ restock เอง
// idempotent: บรรทัดที่มี stock_record_id แล้วจะข้าม (กดซ้ำไม่เพิ่มซ้ำ)

const REQUIRED = ['sku', 'part_name', 'qty', 'unit_price', 'set_price', 'location'] as const

export interface ConfirmResult {
  ok: boolean
  message?: string
  inserted?: number
  problems?: { line_no: number; missing: string[] }[]
}

export async function confirmStockDocument(
  db: SupabaseClient, documentId: string, actor = 'owner',
): Promise<ConfirmResult> {
  const { data: doc } = await db.from('doc_documents')
    .select('state, profile, vendor_name, doc_date').eq('id', documentId).single()
  if (!doc || doc.profile !== 'stock') return { ok: false, message: 'ไม่พบเอกสารสต็อก' }
  if (doc.state !== 'pending_review') return { ok: false, message: `ยืนยันได้เฉพาะตอนรอตรวจ (${doc.state})` }

  const { data: lines } = await db.from('doc_line_items')
    .select('*').eq('document_id', documentId).order('line_no', { ascending: true })
  if (!lines?.length) return { ok: false, message: 'ไม่มีรายการ' }

  // 1) เช็กครบทุกช่องจำเป็น
  const problems: { line_no: number; missing: string[] }[] = []
  const FIELD_TH: Record<string, string> = {
    sku: 'SKU', part_name: 'ชื่อ', qty: 'จำนวน', unit_price: 'ต้นทุน', set_price: 'ราคาขาย', location: 'ที่เก็บ',
  }
  for (const l of lines) {
    const missing = REQUIRED.filter((f) => l[f] == null || String(l[f]).trim() === '').map((f) => FIELD_TH[f])
    if (missing.length) problems.push({ line_no: l.line_no, missing })
  }
  if (problems.length) return { ok: false, message: 'กรอกไม่ครบบางบรรทัด', problems }

  // 2) เช็ก SKU ซ้ำของเดิมใน stock_records (กันเขียนทับ)
  const skus = lines.map((l) => String(l.sku).trim())
  const { data: existing } = await db.from('stock_records').select('sku').in('sku', skus)
  const dup = new Set((existing ?? []).map((r) => r.sku))
  const dupLines = lines.filter((l) => dup.has(String(l.sku).trim()) && !l.stock_record_id)
  if (dupLines.length) {
    return {
      ok: false,
      message: `SKU ซ้ำของเดิม: ${dupLines.map((l) => l.sku).join(', ')} — ถ้าเป็นการเติมของเดิม ให้แก้จำนวนในสต็อกเอง หรือเปลี่ยน SKU เป็นเลขใหม่`,
    }
  }

  // 3) insert เข้า stock_records (ข้ามบรรทัดที่ทำไปแล้ว)
  let inserted = 0
  for (const l of lines) {
    if (l.stock_record_id) continue // ทำไปแล้ว — idempotent
    const { data: rec, error } = await db.from('stock_records').insert({
      sku: String(l.sku).trim(),
      part_name: l.part_name,
      car_model: l.car_model,
      qty: l.qty,
      cost: l.unit_price,
      set_price: l.set_price,
      location: l.location,
      status: 'in_stock',
      has_image: false,
      source: doc.vendor_name,
      date_in: doc.doc_date,
      note: [l.category, l.oem, l.condition, l.note].filter(Boolean).join(' · ') || null,
    }).select('id').single()
    if (error) {
      await audit(db, documentId, actor, 'stock.insert_failed', null, null, { line_no: l.line_no, error: error.message })
      return { ok: false, message: `บรรทัด ${l.line_no} เข้าสต็อกไม่สำเร็จ: ${error.message}`, inserted }
    }
    await db.from('doc_line_items').update({ stock_record_id: rec!.id, updated_at: new Date().toISOString() }).eq('id', l.id)
    inserted++
  }

  // 4) เอกสาร → exported
  await db.from('doc_documents').update({ state: 'exported', updated_at: new Date().toISOString() }).eq('id', documentId)
  await audit(db, documentId, actor, 'document.exported', 'pending_review', 'exported', { inserted, skus })

  return { ok: true, inserted }
}
