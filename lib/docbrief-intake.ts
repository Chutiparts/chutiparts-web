// lib/docbrief-intake.ts — docbrief intake flow (แยกจาก page เพื่อทดสอบได้)
// upload → validate → dedup(sha256) → เก็บ original → queued + audit ทุก transition
// สเปก: phase-0-decision-doc.md §2 (state machine) · §4.6 (dedup) · §9 (audit) · §11 (limits)
import type { SupabaseClient } from '@supabase/supabase-js'
import { sha256, extFor, validateFile } from './docbrief'

export const DOC_BUCKET = 'doc-originals'

export type IntakeOutcome =
  | { status: 'queued'; id: string }
  | { status: 'duplicate'; id: string; duplicateOf: string }
  | { status: 'rejected'; id: string | null; message: string }

async function audit(
  db: SupabaseClient, documentId: string | null, actor: string,
  action: string, fromState: string | null, toState: string | null, metadata?: unknown,
) {
  await db.from('doc_audit').insert({
    document_id: documentId, actor, action,
    from_state: fromState, to_state: toState, metadata: metadata ?? null,
  })
}

export async function intakeFile(
  db: SupabaseClient,
  file: { name: string; type: string; buffer: Buffer },
  actor = 'owner',
): Promise<IntakeOutcome> {
  const buf = file.buffer
  const size = buf.byteLength
  const mime = file.type
  const hash = sha256(buf)

  // 1) validate (§11) — สร้าง record ทุกครั้งแม้ไม่ผ่าน
  const v = validateFile(mime, size, buf)
  if (!v.ok) {
    const { data } = await db.from('doc_documents').insert({
      state: 'failed', file_hash: hash, original_filename: file.name, mime_type: mime,
      file_size: size, error_category: 'intake_error', error_message: v.message,
    }).select('id').single()
    await audit(db, data?.id ?? null, actor, 'document.rejected', null, 'failed', { reason: v.message })
    return { status: 'rejected', id: data?.id ?? null, message: v.message }
  }

  // 2) dedup ระดับไฟล์ (§4.6)
  const { data: dup } = await db.from('doc_documents')
    .select('id, storage_path').eq('file_hash', hash).neq('state', 'failed').limit(1).maybeSingle()

  if (dup) {
    const { data } = await db.from('doc_documents').insert({
      state: 'duplicate', file_hash: hash, original_filename: file.name, mime_type: mime,
      file_size: size, page_count: v.pageCount, storage_path: dup.storage_path, duplicate_of: dup.id,
    }).select('id').single()
    await audit(db, data?.id ?? null, actor, 'duplicate.detected', null, 'duplicate', { duplicate_of: dup.id })
    return { status: 'duplicate', id: data!.id, duplicateOf: dup.id }
  }

  // 3) เก็บ original ก่อน แล้วค่อยสร้าง record (ไฟล์ต้องไม่หาย)
  const storagePath = `originals/${hash}${extFor(mime)}`
  const up = await db.storage.from(DOC_BUCKET).upload(storagePath, buf, { contentType: mime, upsert: false })
  if (up.error && !/exists/i.test(up.error.message)) {
    const msg = `อัปโหลดไฟล์ไม่สำเร็จ: ${up.error.message}`
    const { data } = await db.from('doc_documents').insert({
      state: 'failed', file_hash: hash, original_filename: file.name, mime_type: mime,
      file_size: size, error_category: 'intake_error', error_message: msg,
    }).select('id').single()
    await audit(db, data?.id ?? null, actor, 'document.rejected', null, 'failed', { storage_error: up.error.message })
    return { status: 'rejected', id: data?.id ?? null, message: msg }
  }

  const { data: doc } = await db.from('doc_documents').insert({
    state: 'received', file_hash: hash, original_filename: file.name, mime_type: mime,
    file_size: size, page_count: v.pageCount, storage_path: storagePath,
  }).select('id').single()
  await audit(db, doc!.id, actor, 'document.received', null, 'received', { storage_path: storagePath, page_count: v.pageCount })

  // 4) received → queued (รอ extract ในเฟสถัดไป)
  await db.from('doc_documents').update({ state: 'queued', updated_at: new Date().toISOString() }).eq('id', doc!.id)
  await audit(db, doc!.id, actor, 'state.transition', 'received', 'queued')

  return { status: 'queued', id: doc!.id }
}
