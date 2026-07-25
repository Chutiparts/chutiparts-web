// app/ops-x7k2m9/trash/page.tsx — ถังทิ้ง / กู้คืน (blueprint §11)
// เอกสารที่ถูกทิ้ง (deleted_at != null) · กู้คืนได้ · ไม่มีปุ่มลบถาวร (§18)
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { opsAuthed } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'
import { restoreDocument } from '@/lib/docbrief-trash'

export const dynamic = 'force-dynamic'
const PATH = '/ops-x7k2m9/trash'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function restore(formData: FormData) {
  'use server'
  if (!(await opsAuthed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  await restoreDocument(svc(), id)
  revalidatePath(PATH)
}

const fmt = (iso: string) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

export default async function TrashPage() {
  if (!(await opsAuthed())) return <OpsGate title="🗑 ถังทิ้ง" />

  const db = svc()
  const { data } = await db.from('doc_documents')
    .select('id, profile, state, vendor_name, original_filename, grand_total, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(300)
  const docs = data ?? []

  return (
    <section style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>DOCBRIEF · TRASH</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>🗑 ถังทิ้ง</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        เอกสารที่ทิ้งไว้ — <b>กู้คืนได้ทุกใบ</b> · ไฟล์ต้นฉบับและประวัติยังอยู่ครบ ไม่ได้ลบจริง
      </p>

      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af', fontSize: 15 }}>ถังทิ้งว่าง</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', background: '#fff' }}>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: '#f3f4f6', color: '#374151', whiteSpace: 'nowrap' }}>
                {d.profile === 'stock' ? '📦 สต็อก' : '📄 บัญชี'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.vendor_name || d.original_filename}
                  {d.grand_total != null && <span style={{ fontWeight: 400, color: '#6b7280' }}> · {d.grand_total.toLocaleString()} ฿</span>}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>ทิ้งเมื่อ {d.deleted_at ? fmt(d.deleted_at) : '-'}</div>
              </div>
              <form action={restore}>
                <input type="hidden" name="id" value={d.id} />
                <button type="submit" style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #166534', background: '#fff', color: '#166534', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>↩ กู้คืน</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
