// app/ops-x7k2m9/stock-intake/page.tsx — Profile A: รับเข้าสต็อกจากใบส่งของ
// flow: อัปโหลดใบส่งของ → AI แตกรายการ → owner ตรวจ/แก้/เติม SKU-ราคา-ที่เก็บ → (A3) เข้าสต็อก
// pattern เดียวกับหน้า documents แต่เก็บ "รายการทีละบรรทัด" (doc_line_items)
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { opsAuthed, requirePerm, currentActor } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'
import { intakeFile, DOC_BUCKET } from '@/lib/docbrief-intake'
import { extractStockDocument, saveStockLine, assignSkusForDocument, confirmStockDocument, type LinePatch } from '@/lib/docbrief-stock'
import { trashDocument } from '@/lib/docbrief-trash'
import { checkExtractLimit, checkUploadLimit } from '@/lib/docbrief-ratelimit'
import { findSimilarNames } from '@/lib/docbrief-name-match'
import StockIntakeClient from './StockIntakeClient'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
const PATH = '/ops-x7k2m9/stock-intake'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function uploadBills(formData: FormData) {
  'use server'
  if (!(await requirePerm('upload'))) return
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
  const db = svc()
  const gate = await checkUploadLimit(db)
  if (!gate.ok) {
    await db.from('doc_audit').insert({
      document_id: null, actor: await currentActor(), action: 'ratelimit.blocked',
      metadata: { kind: 'upload', used: gate.used, limit: gate.limit },
    })
    revalidatePath(PATH)
    return
  }
  for (const f of files) {
    await intakeFile(db, { name: f.name, type: f.type, buffer: Buffer.from(await f.arrayBuffer()) }, await currentActor(), 'stock')
  }
  revalidatePath(PATH)
}

async function extractBills(formData: FormData) {
  'use server'
  if (!(await requirePerm('extract'))) return
  const ids = formData.getAll('id').map(String).filter(Boolean)
  const db = svc()
  for (const id of ids) {
    const gate = await checkExtractLimit(db)
    if (!gate.ok) {
      await db.from('doc_audit').insert({
        document_id: id, actor: await currentActor(), action: 'ratelimit.blocked',
        metadata: { kind: 'extract', used: gate.used, limit: gate.limit, message: gate.message },
      })
      break
    }
    await extractStockDocument(db, id)
  }
  revalidatePath(PATH)
}

const num = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').replace(/,/g, '').trim()
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim()
  return v === '' ? null : v
}

async function saveLine(formData: FormData) {
  'use server'
  if (!(await requirePerm('edit'))) return
  const documentId = String(formData.get('document_id') || '')
  const patch: LinePatch = {
    id: String(formData.get('id') || ''),
    part_name: str(formData, 'part_name'),
    qty: num(formData, 'qty'),
    unit_price: num(formData, 'unit_price'),
    sku: str(formData, 'sku'),
    set_price: num(formData, 'set_price'),
    location: str(formData, 'location'),
    category: str(formData, 'category'),
    oem: str(formData, 'oem'),
    condition: str(formData, 'condition'),
    note: str(formData, 'note'),
  }
  if (!documentId || !patch.id) return
  await saveStockLine(svc(), documentId, patch)
  revalidatePath(PATH)
}

async function autoSku(formData: FormData) {
  'use server'
  if (!(await requirePerm('edit'))) return
  const id = String(formData.get('id') || '')
  if (!id) return
  await assignSkusForDocument(svc(), id)
  revalidatePath(PATH)
}

async function confirmStock(_prev: { ok: boolean; message?: string } | null, formData: FormData): Promise<{ ok: boolean; message?: string }> {
  'use server'
  if (!(await requirePerm('confirm'))) return { ok: false, message: 'ต้องเข้าสู่ระบบ' }
  const id = String(formData.get('id') || '')
  if (!id) return { ok: false, message: 'ไม่พบเอกสาร' }
  const r = await confirmStockDocument(svc(), id)
  revalidatePath(PATH)
  if (r.ok) return { ok: true, message: `เข้าสต็อกแล้ว ${r.inserted} รายการ` }
  const detail = r.problems?.length
    ? r.problems.map((p) => `บรรทัด ${p.line_no}: ขาด ${p.missing.join(', ')}`).join(' · ')
    : r.message
  return { ok: false, message: detail }
}

async function rejectBill(formData: FormData) {
  'use server'
  if (!(await requirePerm('reject'))) return
  const id = String(formData.get('id') || '')
  if (!id) return
  const db = svc()
  await db.from('doc_documents').update({ state: 'rejected', updated_at: new Date().toISOString() }).eq('id', id)
  await db.from('doc_audit').insert({ document_id: id, actor: await currentActor(), action: 'document.rejected', to_state: 'rejected' })
  revalidatePath(PATH)
}

async function trashBill(formData: FormData) {
  'use server'
  if (!(await requirePerm('trash'))) return
  const id = String(formData.get('id') || '')
  if (!id) return
  await trashDocument(svc(), id, await currentActor())
  revalidatePath(PATH)
}

async function getPreviewUrl(id: string): Promise<string | null> {
  'use server'
  if (!(await opsAuthed())) return null
  const db = svc()
  const { data: doc } = await db.from('doc_documents').select('storage_path').eq('id', id).single()
  if (!doc?.storage_path) return null
  const { data } = await db.storage.from(DOC_BUCKET).createSignedUrl(doc.storage_path, 600)
  return data?.signedUrl ?? null
}

export default async function StockIntakePage() {
  if (!(await opsAuthed())) return <OpsGate title="📦 รับเข้าสต็อก" />

  const db = svc()
  const { data: docs } = await db.from('doc_documents')
    .select('id, state, original_filename, vendor_name, doc_date, grand_total, review_flags, error_category, error_message, retry_count, created_at')
    .eq('profile', 'stock')
    .is('deleted_at', null)
    .not('state', 'in', '(rejected,duplicate)')
    .order('created_at', { ascending: false })
    .limit(200)

  const ids = (docs ?? []).map((d) => d.id)
  const { data: lines } = ids.length
    ? await db.from('doc_line_items').select('*').in('document_id', ids).order('line_no', { ascending: true })
    : { data: [] }

  const byDoc: Record<string, Record<string, unknown>[]> = {}
  for (const l of lines ?? []) {
    const row = l as Record<string, unknown>
    ;(byDoc[row.document_id as string] ??= []).push(row)
  }

  // B2 + bulk-intake: ดึง stock ครั้งเดียว → (1) เตือนชื่อคล้ายของเดิม (pending) (2) คลังชื่อ/ที่เก็บ ให้แตะเลือก
  // fail → คืนค่าว่าง (ห้ามทำหน้าล่ม) · nameOptions/locationOptions = active เท่านั้น (deleted_at null)
  const pendingIds = new Set((docs ?? []).filter((d) => d.state === 'pending_review').map((d) => d.id))
  const warnByLine: Record<string, { part_name: string; sku: string | null; similarity: number }[]> = {}
  let nameOptions: string[] = []
  let locationOptions: string[] = []
  if (ids.length) {
    try {
      const { data: stock } = await db.from('stock_records').select('sku, part_name, location, deleted_at').limit(5000)
      const existing = (stock ?? []) as { sku: string | null; part_name: string | null; location: string | null; deleted_at: string | null }[]
      const names = new Set<string>(); const locs = new Set<string>()
      for (const r of existing) {
        if (r.deleted_at) continue // แนะนำเฉพาะของ active
        const p = (r.part_name || '').trim(); if (p) names.add(p)
        const loc = (r.location || '').trim(); if (loc) locs.add(loc)
      }
      nameOptions = [...names].sort((a, b) => a.localeCompare(b, 'th')).slice(0, 800)
      locationOptions = [...locs].sort((a, b) => a.localeCompare(b, 'th'))
      // เตือนชื่อคล้าย เฉพาะบรรทัดในใบที่รอตรวจ (คงพฤติกรรมเดิม — เทียบกับทั้ง stock)
      if ((lines ?? []).some((l) => pendingIds.has((l as Record<string, unknown>).document_id as string))) {
        for (const l of lines ?? []) {
          const row = l as Record<string, unknown>
          if (!pendingIds.has(row.document_id as string)) continue
          const matches = findSimilarNames(row.part_name as string | null, existing).slice(0, 2)
          if (matches.length) warnByLine[row.id as string] = matches
        }
      }
    } catch { nameOptions = []; locationOptions = [] }
  }

  return (
    <StockIntakeClient
      docs={docs ?? []}
      linesByDoc={byDoc as never}
      warnByLine={warnByLine}
      nameOptions={nameOptions}
      locationOptions={locationOptions}
      uploadBills={uploadBills}
      extractBills={extractBills}
      saveLine={saveLine}
      autoSku={autoSku}
      confirmStock={confirmStock}
      rejectBill={rejectBill}
      trashBill={trashBill}
      getPreviewUrl={getPreviewUrl}
    />
  )
}
