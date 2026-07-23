// app/ops-x7k2m9/documents/page.tsx — docbrief: Smart Document Intake (V1 · Phase 1)
// pattern เดิม: svc() + authed() (cookie ops_admin) + server actions · owner-only · ไม่แตะโมดูลอื่น
// scope V1: บิลซื้อจาก vendor (invoice/receipt/tax invoice) · flow: intake → extract → validate → review → export staging
// รอบนี้ทำเฉพาะ intake: upload → dedup(sha256) → เก็บ original → queued (ยังไม่ extract)
// ตรรกะ intake อยู่ที่ lib/docbrief-intake.ts (แยกไว้เพื่อทดสอบได้)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { intakeFile } from '@/lib/docbrief-intake'
import { extractDocument } from '@/lib/docbrief-extract'
import { validateDocument, exportKey, canExport } from '@/lib/docbrief-validate'
import { exportDocument } from '@/lib/docbrief-export'
import { getVendorSuggestions } from '@/lib/docbrief-vendors'
import DocumentsClient from './DocumentsClient'

export const dynamic = 'force-dynamic'
// vision extraction ใช้เวลาได้หลายสิบวินาที
export const maxDuration = 120
const COOKIE = 'ops_admin'
const PATH = '/ops-x7k2m9/documents'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false
  return (await cookies()).get(COOKIE)?.value === secret
}

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('pw') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    // secure: true บังคับ HTTPS — บน localhost (http) เบราว์เซอร์จะทิ้ง cookie ทิ้ง
    // จึงเปิดเฉพาะ production · prod ยังปลอดภัยเหมือนเดิม
    ;(await cookies()).set(COOKIE, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    })
  }
  revalidatePath(PATH)
}

async function uploadDocuments(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const files = formData.getAll('file').filter((f): f is File => f instanceof File && f.size > 0)
  const db = svc()
  for (const f of files) {
    await intakeFile(db, { name: f.name, type: f.type, buffer: Buffer.from(await f.arrayBuffer()) })
  }
  revalidatePath(PATH)
}

// Phase 2 (Parse) — อ่านข้อมูลจากบิลด้วย Claude vision · owner กดเอง = คุมต้นทุนชัดเจน
async function extractDocuments(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const ids = formData.getAll('id').map(String).filter(Boolean)
  const db = svc()
  for (const id of ids) await extractDocument(db, id)
  revalidatePath(PATH)
}

// ===== Phase 3 (Validate + Review) — owner แก้/ยืนยัน/ปฏิเสธ =====
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

// บันทึกการแก้ไขของคน (ยังไม่ยืนยัน) — validate ใหม่ทุกครั้ง
async function saveReview(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  const db = svc()

  const { data: before } = await db.from('doc_documents')
    .select('state, vendor_name, vendor_tax_id, doc_no, doc_date, subtotal, vat, grand_total, currency, confidence')
    .eq('id', id).single()
  if (!before || before.state !== 'pending_review') return

  const fields = {
    vendor_name: str(formData, 'vendor_name'),
    vendor_tax_id: str(formData, 'vendor_tax_id'),
    doc_no: str(formData, 'doc_no'),
    doc_date: str(formData, 'doc_date'),
    subtotal: num(formData, 'subtotal'),
    vat: num(formData, 'vat'),
    grand_total: num(formData, 'grand_total'),
    currency: str(formData, 'currency') || 'THB',
    confidence: before.confidence as Record<string, number> | null,
  }

  // เก็บว่าคนแก้ field ไหนบ้าง (§9 audit)
  const changed: Record<string, { from: unknown; to: unknown }> = {}
  for (const k of Object.keys(fields) as (keyof typeof fields)[]) {
    if (k === 'confidence') continue
    const b = (before as Record<string, unknown>)[k] ?? null
    const a = fields[k] ?? null
    if (String(b) !== String(a)) changed[k] = { from: b, to: a }
  }

  const { flags } = validateDocument(fields)
  await db.from('doc_documents').update({ ...fields, review_flags: flags, updated_at: new Date().toISOString() }).eq('id', id)
  if (Object.keys(changed).length) {
    await db.from('doc_audit').insert({
      document_id: id, actor: 'owner', action: 'field.corrected', metadata: { changed, flags },
    })
  }
  revalidatePath(PATH)
}

// ยืนยัน — owner เท่านั้น (§8) · คำนวณ export_key จากค่าที่คนยืนยันแล้ว (§5)
async function confirmDocument(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  const db = svc()

  const { data: d } = await db.from('doc_documents')
    .select('state, vendor_name, vendor_tax_id, doc_no, doc_date, subtotal, vat, grand_total, currency')
    .eq('id', id).single()
  if (!d || d.state !== 'pending_review') return

  const fields = { ...d, confidence: null } as Parameters<typeof canExport>[0]
  const gate = canExport(fields)
  if (!gate.ok) return // UI กันไว้อยู่แล้ว แต่กันซ้ำฝั่ง server

  const key = exportKey(fields)
  // §4.6 duplicate ระดับเนื้อหา — review only ไม่ auto-block
  const { data: dup } = await db.from('doc_exports').select('id').eq('export_key', key).limit(1).maybeSingle()

  await db.from('doc_documents').update({ state: 'confirmed', updated_at: new Date().toISOString() }).eq('id', id)
  await db.from('doc_audit').insert({
    document_id: id, actor: 'owner', action: 'document.confirmed',
    from_state: 'pending_review', to_state: 'confirmed',
    metadata: { export_key: key, snapshot: d, possible_duplicate: !!dup },
  })
  revalidatePath(PATH)
}

async function rejectDocument(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || '')
  const reason = String(formData.get('reason') || '').trim() || 'ไม่ระบุเหตุผล'
  if (!id) return
  const db = svc()
  const { data: d } = await db.from('doc_documents').select('state').eq('id', id).single()
  if (!d || d.state !== 'pending_review') return
  await db.from('doc_documents').update({ state: 'rejected', updated_at: new Date().toISOString() }).eq('id', id)
  await db.from('doc_audit').insert({
    document_id: id, actor: 'owner', action: 'document.rejected',
    from_state: 'pending_review', to_state: 'rejected', metadata: { reason },
  })
  revalidatePath(PATH)
}

// ===== ดูไฟล์ต้นฉบับตอนตรวจ — signed URL อายุสั้น สร้างตอนกดดูเท่านั้น =====
async function getPreviewUrl(id: string): Promise<string | null> {
  'use server'
  if (!(await authed())) return null
  const db = svc()
  const { data: d } = await db.from('doc_documents').select('storage_path').eq('id', id).single()
  if (!d?.storage_path) return null
  const { data } = await db.storage.from('doc-originals').createSignedUrl(d.storage_path, 600)
  return data?.signedUrl ?? null
}

// ===== §12 Retry — เอกสารที่ failed ต้องกลับเข้าคิวได้ (เพดาน 3 ครั้ง/ใบ) =====
const MAX_RETRY = 3
async function retryDocument(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  const db = svc()
  const { data: d } = await db.from('doc_documents')
    .select('state, error_category, retry_count, storage_path').eq('id', id).single()
  if (!d || d.state !== 'failed') return
  if ((d.retry_count ?? 0) >= MAX_RETRY) return
  // อัปโหลดไม่ผ่านตั้งแต่แรก = ไฟล์เสีย ต้องอัปใหม่ ลองซ้ำไม่ช่วย
  if (d.error_category === 'intake_error' || !d.storage_path) return

  // export พังหลังยืนยันแล้ว → กลับไป confirmed เพื่อกดส่งใหม่
  // อ่าน/แปลงพัง → กลับเข้าคิวเพื่ออ่านใหม่
  const back = d.error_category === 'export_failed' ? 'confirmed' : 'queued'
  await db.from('doc_documents').update({
    state: back, error_category: null, error_message: null,
    retry_count: (d.retry_count ?? 0) + 1, updated_at: new Date().toISOString(),
  }).eq('id', id)
  await db.from('doc_audit').insert({
    document_id: id, actor: 'owner', action: 'document.retried',
    from_state: 'failed', to_state: back,
    metadata: { attempt: (d.retry_count ?? 0) + 1, max: MAX_RETRY },
  })
  revalidatePath(PATH)
}

// ===== Phase 4 (Export) — ส่งไป Google Sheet · owner กดเอง =====
async function exportDocuments(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const ids = formData.getAll('id').map(String).filter(Boolean)
  const db = svc()
  for (const id of ids) await exportDocument(db, id)
  revalidatePath(PATH)
}

export default async function DocumentsPage() {
  if (!(await authed())) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#17301F' }}>
        <form action={loginOps} style={{ background: '#fff', padding: 28, borderRadius: 14, width: 320, boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#17301F', marginBottom: 4 }}>เอกสาร (docbrief)</div>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>ใส่รหัสผ่านทีมงาน</div>
          <input name="pw" type="password" placeholder="รหัสผ่าน" autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <button type="submit" style={{ width: '100%', background: '#17301F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  const db = svc()
  const vendors = await getVendorSuggestions(db)
  const { data } = await db.from('doc_documents')
    .select(`id, state, original_filename, mime_type, file_size, page_count, error_message, error_category,
             duplicate_of, created_at, retry_count, storage_path,
             vendor_name, vendor_tax_id, doc_no, doc_date, subtotal, vat, grand_total, currency, confidence, review_flags`)
    .order('created_at', { ascending: false }).limit(200)

  return (
    <DocumentsClient
      docs={data || []}
      uploadDocuments={uploadDocuments}
      extractDocuments={extractDocuments}
      saveReview={saveReview}
      confirmDocument={confirmDocument}
      rejectDocument={rejectDocument}
      exportDocuments={exportDocuments}
      getPreviewUrl={getPreviewUrl}
      retryDocument={retryDocument}
      maxRetry={MAX_RETRY}
      vendors={vendors}
      sheetConfigured={!!process.env.DOCBRIEF_SHEET_WEBHOOK_URL && !!process.env.DOCBRIEF_SHEET_SECRET}
    />
  )
}
