// lib/docbrief-export.ts — docbrief Phase 4 (Export): ส่งเอกสารที่ยืนยันแล้วไป Google Sheet
// สเปก: docbrief-final-spec-v1.md §4.4 (Sheet = final destination · ไม่แตะ ledger)
//       phase-0-decision-doc.md §5 (idempotency key) · §10 (schema คอลัมน์) · §12 (retry)
//
// วิธีเชื่อม: Apps Script Web App (ไม่เพิ่ม dependency · ไม่ต้องทำ service account)
//   env: DOCBRIEF_SHEET_WEBHOOK_URL · DOCBRIEF_SHEET_SECRET
import { createHmac } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { exportKey, canExport, type DocFields } from './docbrief-validate'

export type ExportOutcome =
  | { status: 'exported'; row?: string }
  | { status: 'already_exported'; row?: string }
  | { status: 'failed'; message: string }

const TARGET = 'google_sheet'

/**
 * Export เอกสาร 1 ใบ
 * ลำดับสำคัญ: จอง export_key ใน DB ก่อน → ค่อยยิง Sheet
 * เพราะ unique constraint บน export_key คือตัวกันซ้ำจริง (ไม่ใช่การเช็คก่อนเขียน ซึ่ง race ได้)
 */
export async function exportDocument(
  db: SupabaseClient,
  documentId: string,
  actor = 'owner',
): Promise<ExportOutcome> {
  const webhook = process.env.DOCBRIEF_SHEET_WEBHOOK_URL
  const secret = process.env.DOCBRIEF_SHEET_SECRET
  if (!webhook || !secret) {
    return { status: 'failed', message: 'ยังไม่ได้ตั้งค่า DOCBRIEF_SHEET_WEBHOOK_URL / DOCBRIEF_SHEET_SECRET' }
  }

  const { data: doc } = await db.from('doc_documents')
    .select('id, state, vendor_name, vendor_tax_id, doc_no, doc_date, subtotal, vat, grand_total, currency, source, file_hash')
    .eq('id', documentId).single()
  if (!doc) return { status: 'failed', message: 'ไม่พบเอกสาร' }
  if (doc.state !== 'confirmed') {
    return { status: 'failed', message: `ต้องยืนยันก่อนถึงจะส่งออกได้ (สถานะ: ${doc.state})` }
  }

  const fields = doc as unknown as DocFields
  const gate = canExport(fields)
  if (!gate.ok) return { status: 'failed', message: gate.reason! }

  const key = exportKey(fields)
  const audit = (action: string, from: string | null, to: string | null, metadata?: unknown) =>
    db.from('doc_audit').insert({
      document_id: documentId, actor, action, from_state: from, to_state: to, metadata: metadata ?? null,
    })

  // ---- 1) จอง export_key (unique constraint กันซ้ำ §5) ----
  const claim = await db.from('doc_exports').insert({
    document_id: documentId, export_key: key, target: TARGET, status: 'pending', exported_by: actor,
  }).select('id').single()

  if (claim.error) {
    // ชนคีย์ = เคยส่งออกไปแล้ว → ไม่ยิงซ้ำ (idempotent)
    const { data: prev } = await db.from('doc_exports')
      .select('id, status, row_ref').eq('export_key', key).maybeSingle()
    if (prev) {
      if (prev.status === 'success') {
        await db.from('doc_documents').update({ state: 'exported', updated_at: new Date().toISOString() }).eq('id', documentId)
        await audit('export.skipped_duplicate', 'confirmed', 'exported', { export_key: key, row_ref: prev.row_ref })
        return { status: 'already_exported', row: prev.row_ref ?? undefined }
      }
      // เคยจองแต่ยังไม่สำเร็จ → ลองยิงใหม่ด้วย record เดิม
      return await push(db, documentId, prev.id, key, fields, doc, webhook, secret, audit)
    }
    return { status: 'failed', message: `จอง export key ไม่สำเร็จ: ${claim.error.message}` }
  }

  return await push(db, documentId, claim.data.id, key, fields, doc, webhook, secret, audit)
}

async function push(
  db: SupabaseClient,
  documentId: string,
  exportRowId: string,
  key: string,
  f: DocFields,
  doc: Record<string, unknown>,
  webhook: string,
  secret: string,
  audit: (a: string, from: string | null, to: string | null, m?: unknown) => unknown,
): Promise<ExportOutcome> {
  // confirmed → exporting
  await db.from('doc_documents').update({ state: 'exporting', updated_at: new Date().toISOString() }).eq('id', documentId)
  await audit('state.transition', 'confirmed', 'exporting', { export_key: key })

  // ---- §10 คอลัมน์ตายตัว A–N ----
  const row = {
    export_key: key,
    doc_id: documentId,
    vendor_name: f.vendor_name ?? '',
    vendor_tax_id: f.vendor_tax_id ?? '',
    doc_no: f.doc_no ?? '',
    doc_date: f.doc_date ?? '',
    subtotal: f.subtotal ?? '',
    vat: f.vat ?? '',
    grand_total: f.grand_total ?? '',
    currency: f.currency ?? 'THB',
    source: (doc.source as string) ?? 'upload',
    confirmed_by: 'owner',
    confirmed_at: new Date().toISOString(),
    exported_at: new Date().toISOString(),
  }

  const fail = async (msg: string) => {
    await db.from('doc_exports').update({ status: 'failed', error_message: msg }).eq('id', exportRowId)
    await db.from('doc_documents').update({
      state: 'failed', error_category: 'export_failed', error_message: msg, updated_at: new Date().toISOString(),
    }).eq('id', documentId)
    await audit('export.failed', 'exporting', 'failed', { export_key: key, message: msg })
    return { status: 'failed' as const, message: msg }
  }

  // ส่งแบบ HMAC — รหัสลับไม่ถูกส่งผ่านเน็ต ส่งแค่ลายเซ็นที่คำนวณจากรหัส
  // เซ็นบน payload string ตัวเดิมที่ส่งไป เพื่อให้ 2 ฝั่งเห็น byte เดียวกันแน่นอน
  const ts = Date.now()
  const payload = JSON.stringify(row)
  const sig = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex')

  let res: Response
  try {
    res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts, sig, payload }),
    })
  } catch (e) {
    return fail(`ต่อ Google Sheet ไม่ได้: ${e instanceof Error ? e.message : String(e)}`)
  }

  const text = await res.text()
  if (!res.ok) return fail(`Sheet ตอบ ${res.status}: ${text.slice(0, 200)}`)

  let out: { ok?: boolean; row?: string; error?: string }
  try { out = JSON.parse(text) } catch { return fail(`Sheet ตอบไม่ใช่ JSON: ${text.slice(0, 150)}`) }
  if (!out.ok) return fail(`Sheet ปฏิเสธ: ${out.error ?? 'ไม่ทราบสาเหตุ'}`)

  // ---- สำเร็จ ----
  await db.from('doc_exports').update({
    status: 'success', row_ref: out.row ?? null, exported_at: new Date().toISOString(),
  }).eq('id', exportRowId)
  await db.from('doc_documents').update({ state: 'exported', updated_at: new Date().toISOString() }).eq('id', documentId)
  await audit('document.exported', 'exporting', 'exported', { export_key: key, row_ref: out.row, target: TARGET })

  return { status: 'exported', row: out.row }
}
