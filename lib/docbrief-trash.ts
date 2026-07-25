// lib/docbrief-trash.ts — Soft delete / กู้คืน (blueprint §11)
// ทิ้ง = ตั้ง deleted_at · กู้ = ล้างเป็น null · ไม่ลบไฟล์/audit/export จริง
// ทุก action ลง audit (§11 restore ต้องลง audit)
import type { SupabaseClient } from '@supabase/supabase-js'

async function audit(
  db: SupabaseClient, documentId: string, actor: string, action: string, metadata?: unknown,
) {
  await db.from('doc_audit').insert({
    document_id: documentId, actor, action, from_state: null, to_state: null, metadata: metadata ?? null,
  })
}

/** ทิ้งลงถัง (soft delete) — เก็บทุกอย่างไว้ กู้ได้ */
export async function trashDocument(
  db: SupabaseClient, documentId: string, actor = 'owner',
): Promise<{ ok: boolean; message?: string }> {
  const { data: doc } = await db.from('doc_documents').select('state, deleted_at').eq('id', documentId).single()
  if (!doc) return { ok: false, message: 'ไม่พบเอกสาร' }
  if (doc.deleted_at) return { ok: true } // อยู่ในถังแล้ว
  const { error } = await db.from('doc_documents')
    .update({ deleted_at: new Date().toISOString() }).eq('id', documentId)
  if (error) return { ok: false, message: error.message }
  await audit(db, documentId, actor, 'document.trashed', { prev_state: doc.state })
  return { ok: true }
}

/** กู้คืนจากถัง */
export async function restoreDocument(
  db: SupabaseClient, documentId: string, actor = 'owner',
): Promise<{ ok: boolean; message?: string }> {
  const { data: doc } = await db.from('doc_documents').select('deleted_at').eq('id', documentId).single()
  if (!doc) return { ok: false, message: 'ไม่พบเอกสาร' }
  if (!doc.deleted_at) return { ok: true } // ไม่ได้อยู่ในถัง
  const { error } = await db.from('doc_documents')
    .update({ deleted_at: null }).eq('id', documentId)
  if (error) return { ok: false, message: error.message }
  await audit(db, documentId, actor, 'document.restored', null)
  return { ok: true }
}
