// lib/docbrief-stock.ts — Profile A orchestrator: ใบส่งของ → doc_documents(profile=stock) + doc_line_items
//
// A2 = ถึงขั้น "รอตรวจ" (pending_review) พร้อมรายการทีละบรรทัดให้ owner แก้
// A3 (คนละไฟล์ทีหลัง) = ยืนยัน → เข้า stock_records + แถบรับเข้า
import type { SupabaseClient } from '@supabase/supabase-js'
import { DOC_BUCKET } from './docbrief-intake'
import { extractStockBill, type StockLine } from './docbrief-extract-stock'
import { guessCategory } from './docbrief-stock-categories'
import { checkPossibleDuplicate } from './docbrief-dedup'

// สภาพเริ่มต้นของอะไหล่นำเข้า (owner แก้เป็น A/B/C ได้ตอนตรวจ)
const DEFAULT_CONDITION = process.env.DOCBRIEF_DEFAULT_CONDITION || 'มือสอง-A'

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
 * เติมอัตโนมัติให้บรรทัดที่ยังว่าง: SKU (เรียงต่อจากเลขสูงสุดต่อรุ่น) +
 * หมวดหมู่ (จับคู่จากชื่อ) + สภาพ (default) — ไม่ทับค่าที่ owner กรอกเองแล้ว
 */
export async function assignSkusForDocument(
  db: SupabaseClient, documentId: string, actor = 'owner',
): Promise<{ ok: boolean; assigned: number }> {
  const { data: lines } = await db.from('doc_line_items')
    .select('id, line_no, car_model, part_name, sku, category, condition').eq('document_id', documentId).order('line_no', { ascending: true })
  if (!lines?.length) return { ok: true, assigned: 0 }

  const next: Record<string, number> = {} // chassis → เลขถัดไปที่จะใช้
  let assigned = 0
  for (const l of lines) {
    const patch: Record<string, unknown> = {}

    // SKU — เรียงต่อต่อรุ่น
    if (!l.sku || !String(l.sku).trim()) {
      const chassis = chassisOf(l.car_model, l.part_name)
      if (chassis) {
        if (next[chassis] === undefined) next[chassis] = (await maxRunning(db, chassis)) + 1
        patch.sku = `${chassis}-${String(next[chassis]).padStart(3, '0')}`
        next[chassis]++
      }
    }
    // หมวดหมู่ — จับคู่จากชื่ออะไหล่
    if (!l.category || !String(l.category).trim()) {
      const cat = guessCategory(l.part_name)
      if (cat) patch.category = cat
    }
    // สภาพ — ใส่ default ถ้ายังว่าง
    if (!l.condition || !String(l.condition).trim()) patch.condition = DEFAULT_CONDITION

    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString()
      await db.from('doc_line_items').update(patch).eq('id', l.id)
      assigned++
    }
  }
  if (assigned) await audit(db, documentId, actor, 'autofill.applied', null, null, { count: assigned })
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

  // ตรวจ "อาจซ้ำ" (blueprint §14)
  await checkPossibleDuplicate(db, documentId)

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

// ── A3: ยืนยัน → เข้าสต็อกจริง (post-ledger cutover 2026-08-09) ──────────
// ต้องครบทุกช่องจำเป็นก่อน: sku · part_name · qty(int>0) · ต้นทุน · ราคาขาย · ที่เก็บ
// ทุกบรรทัดเข้าสต็อก "ผ่าน received movement เท่านั้น" (ห้ามเขียน qty ตรง) → trigger บวก qty:
//   • SKU ใหม่ → insert stock_records (qty=0) ก่อน แล้วค่อย received movement บวกขึ้น
//   • SKU เดิม → received movement เข้า row เดิมเลย
// idempotent (กันนับเบิ้ล 3 ชั้น):
//   1) บรรทัดที่มี stock_record_id แล้ว → ข้าม
//   2) received movement ผูก line_item_id + unique index ux_stock_movements_line
//      → retry/concurrent จะ 23505 = ถือว่า posted แล้ว (qty ไม่บวกซ้ำ · ลบ row เปล่าที่เพิ่งสร้างทิ้ง)
//   3) new-SKU สร้าง row qty=0 ก่อน movement → ถ้า crash ก่อน mark, retry จะเจอ row เดิมแล้ววิ่งเข้า
//      restock path → movement 23505 → ไม่บวกซ้ำ (นี่คือเหตุผลที่ new-SKU ต้องมี movement ด้วย)
// ambiguous: SKU เดิมที่มี active row ซ้ำหลายแถว → ไม่เดา · block เฉพาะเคสนั้น (ไม่แตะอะไรเลย)

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

  // 1b) qty ต้องเป็นจำนวนเต็ม > 0 (REQUIRED เช็กแค่ "มีค่า" → กัน "0"/"-5"/"abc" ที่ทำ movement เพี้ยน)
  const badQty = lines.filter((l) => !l.stock_record_id).filter((l) => {
    const n = Number(l.qty)
    return !Number.isFinite(n) || !Number.isInteger(n) || n <= 0
  })
  if (badQty.length) {
    return { ok: false, message: `จำนวนต้องเป็นเลขจำนวนเต็มมากกว่า 0 — บรรทัด ${badQty.map((l) => l.line_no).join(', ')}` }
  }

  // 2) หา active stock_records ที่มี SKU ตรง (deleted_at is null) → map: sku → [id,...]
  //    ใช้ตัดสินว่าแต่ละบรรทัดเป็น "ของใหม่" (0 แถว) หรือ "เติมของเดิม" (1 แถว) หรือ ambiguous (>1)
  const skus = lines.map((l) => String(l.sku).trim())
  const { data: existing } = await db.from('stock_records')
    .select('id, sku').in('sku', skus).is('deleted_at', null)
  const bySku = new Map<string, string[]>()
  for (const r of existing ?? []) {
    const k = String(r.sku).trim()
    const arr = bySku.get(k) ?? []
    arr.push(r.id as string)
    bySku.set(k, arr)
  }

  // 2a) preflight ambiguous — บรรทัดที่ยังไม่ post แต่ SKU มี active หลายแถว → block ทั้งใบ (ยังไม่แตะอะไรเลย)
  const ambiguous = [...new Set(
    lines.filter((l) => !l.stock_record_id && (bySku.get(String(l.sku).trim())?.length ?? 0) > 1)
      .map((l) => String(l.sku).trim()),
  )]
  if (ambiguous.length) {
    return {
      ok: false,
      message: `SKU มีหลายรายการ active เลือกไม่ได้ (แก้ให้เหลือรายการเดียว หรือเปลี่ยน SKU): ${ambiguous.join(', ')}`,
    }
  }

  // 3) โพสต์ทีละบรรทัด (ข้ามบรรทัดที่ทำไปแล้ว — idempotent) · ทุกบรรทัดเข้าสต็อกผ่าน received movement
  const nowIso = () => new Date().toISOString()
  const markPosted = (lineId: string, recId: string) =>
    db.from('doc_line_items').update({ stock_record_id: recId, updated_at: nowIso() }).eq('id', lineId)
  let inserted = 0   // นับรวมทุกบรรทัดที่ posted สำเร็จ (ใหม่ + เติมของเดิม)
  let restocked = 0  // เฉพาะเติมของเดิม (SKU เดิม)
  for (const l of lines) {
    if (l.stock_record_id) continue // ทำไปแล้ว — idempotent
    const sku = String(l.sku).trim()
    const qtyN = Number(l.qty) // ผ่าน preflight 1b แล้ว = จำนวนเต็ม > 0
    const existingId = (bySku.get(sku) ?? [])[0] ?? null

    // หาเป้าหมาย stock_records: ของเดิมใช้ id เดิม · ของใหม่สร้าง row qty=0 ก่อน (on-hand มาจาก movement)
    let targetId = existingId
    let createdNew = false
    if (!targetId) {
      const { data: rec, error } = await db.from('stock_records').insert({
        sku,
        part_name: l.part_name,
        car_model: l.car_model,
        qty: 0, // ← on-hand จะถูก trigger บวกจาก received movement ด้านล่าง (ไม่เขียน qty ตรง)
        cost: l.unit_price,
        set_price: l.set_price,
        location: l.location,
        status: 'in_stock',
        has_image: false,
        source: doc.vendor_name,
        date_in: doc.doc_date,
        note: [l.category, l.oem, l.condition, l.note].filter(Boolean).join(' · ') || null,
      }).select('id').single()
      if (error || !rec) {
        await audit(db, documentId, actor, 'stock.insert_failed', null, null, { line_no: l.line_no, sku, error: error?.message })
        return { ok: false, message: `บรรทัด ${l.line_no} เข้าสต็อกไม่สำเร็จ: ${error?.message ?? 'unknown'}`, inserted }
      }
      targetId = rec.id as string
      createdNew = true
    }

    // received movement → trigger บวก qty · ผูก line_item_id (unique) = กันนับเบิ้ล
    const { error: mvErr } = await db.from('stock_movements').insert({
      stock_record_id: targetId,
      qty_change: qtyN,
      movement_type: 'received',
      unit_cost: l.unit_price,
      document_id: documentId,
      line_item_id: l.id,
      actor,
      note: `รับเข้าจากบิล ${doc.vendor_name ?? doc.doc_date ?? documentId.slice(0, 8)}`,
    })
    if (mvErr) {
      // ux_stock_movements_line กัน post ซ้ำ → 23505 = บรรทัดนี้ถูกโพสต์ไปแล้ว (retry/concurrent)
      if ((mvErr as { code?: string }).code === '23505') {
        if (createdNew) {
          // row qty=0 ที่เพิ่งสร้างเป็น orphan (บรรทัดถูกโพสต์ที่อื่นแล้ว) → ลบทิ้ง กัน dup SKU
          await db.from('stock_records').delete().eq('id', targetId)
        } else {
          await markPosted(l.id, targetId)
        }
        continue
      }
      // movement fail อื่น ๆ: ลบ row เปล่าที่เพิ่งสร้าง (ถ้ามี) กันค้าง orphan qty=0 · retry ได้สะอาด
      if (createdNew) await db.from('stock_records').delete().eq('id', targetId)
      await audit(db, documentId, actor, 'stock.movement_failed', null, null, { line_no: l.line_no, sku, error: mvErr.message })
      return { ok: false, message: `บรรทัด ${l.line_no} รับเข้าไม่สำเร็จ: ${mvErr.message}`, inserted }
    }

    await markPosted(l.id, targetId)
    inserted++
    if (!createdNew) restocked++
    // ลงทะเบียน row ใหม่เข้า map ทันที → บรรทัดถัดไปในบิลเดียวกันที่ SKU เดียวกัน
    // จะวิ่งเข้า restock path (บวกเข้าแถวเดิม) แทนสร้าง dup row (กัน ambiguous ในอนาคต)
    else bySku.set(sku, [targetId])
  }

  // 4) เอกสาร → exported
  await db.from('doc_documents').update({ state: 'exported', updated_at: nowIso() }).eq('id', documentId)
  await audit(db, documentId, actor, 'document.exported', 'pending_review', 'exported', { inserted, restocked, created: inserted - restocked, skus })

  return { ok: true, inserted }
}
