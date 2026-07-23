// app/ops-x7k2m9/documents/page.tsx — docbrief: Smart Document Intake (V1 · Phase 1)
// pattern เดิม: svc() + authed() (cookie ops_admin) + server actions · owner-only · ไม่แตะโมดูลอื่น
// scope V1: บิลซื้อจาก vendor (invoice/receipt/tax invoice) · flow: intake → extract → validate → review → export staging
// รอบนี้ทำเฉพาะ intake: upload → dedup(sha256) → เก็บ original → queued (ยังไม่ extract)
// ตรรกะ intake อยู่ที่ lib/docbrief-intake.ts (แยกไว้เพื่อทดสอบได้)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { intakeFile } from '@/lib/docbrief-intake'
import DocumentsClient from './DocumentsClient'

export const dynamic = 'force-dynamic'
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
    ;(await cookies()).set(COOKIE, secret, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
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

  const { data } = await svc().from('doc_documents')
    .select('id, state, original_filename, mime_type, file_size, page_count, error_message, duplicate_of, created_at')
    .order('created_at', { ascending: false }).limit(200)

  return <DocumentsClient docs={data || []} uploadDocuments={uploadDocuments} />
}
