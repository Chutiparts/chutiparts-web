// app/ops-x7k2m9/compare/[id]/page.tsx — หน้าเทียบเอกสารซ้ำ (blueprint §10)
// 3 ช่อง: เหตุผลด้านบน · ใบปัจจุบัน (ซ้าย) · ใบที่จับคู่ได้ (ขวา)
// action ปลอดภัย: "ไม่ใช่เอกสารซ้ำ" (เอาธงออก) · "เป็นเอกสารซ้ำ" (ย้ายลงถังทิ้ง)
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { opsAuthed } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'
import { dismissDuplicate } from '@/lib/docbrief-dedup'
import { trashDocument } from '@/lib/docbrief-trash'

export const dynamic = 'force-dynamic'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

const REASON_TH: Record<string, string> = {
  doc_no_match: 'เลขที่เอกสารตรงกัน', amount_match: 'ยอดเงินตรงกัน',
  vendor_similar: 'ผู้ขายคล้ายกัน', date_proximity: 'วันที่ใกล้กัน',
}

async function notDuplicate(formData: FormData) {
  'use server'
  if (!(await opsAuthed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  await dismissDuplicate(svc(), id)
  const back = String(formData.get('back') || '/ops-x7k2m9/documents')
  revalidatePath(back)
  redirect(back)
}

async function isDuplicate(formData: FormData) {
  'use server'
  if (!(await opsAuthed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  await trashDocument(svc(), id) // ซ้ำจริง → ลงถังทิ้ง (กู้คืนได้ ไม่ลบจริง)
  redirect('/ops-x7k2m9/documents')
}

type Doc = {
  id: string; profile: string; state: string
  vendor_name: string | null; vendor_tax_id: string | null; doc_no: string | null
  doc_date: string | null; grand_total: number | null; currency: string | null
  original_filename: string; review_metadata: { possible_duplicate_matches?: { document_id: string; score: number; reasons: string[] }[] } | null
}

const fld: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }
const money = (n: number | null, c: string | null) => (n != null ? `${n.toLocaleString()} ${c || 'THB'}` : '—')

function DocCard({ d, title, tint }: { d: Doc; title: string; tint: string }) {
  return (
    <div style={{ flex: 1, minWidth: 260, border: '1px solid #e5e7eb', borderTop: `3px solid ${tint}`, borderRadius: 10, padding: 16, background: '#fff' }}>
      <div style={{ fontSize: 12, color: tint, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{d.vendor_name || d.original_filename}</div>
      <div style={fld}><span style={{ color: '#6b7280' }}>เลขที่</span><b>{d.doc_no || '—'}</b></div>
      <div style={fld}><span style={{ color: '#6b7280' }}>วันที่</span><b>{d.doc_date || '—'}</b></div>
      <div style={fld}><span style={{ color: '#6b7280' }}>ยอดสุทธิ</span><b>{money(d.grand_total, d.currency)}</b></div>
      <div style={fld}><span style={{ color: '#6b7280' }}>เลขภาษี</span><b>{d.vendor_tax_id || '—'}</b></div>
      <div style={{ ...fld, borderBottom: 'none' }}><span style={{ color: '#6b7280' }}>สถานะ</span><b>{d.state}</b></div>
    </div>
  )
}

export default async function ComparePage(props: { params: Promise<{ id: string }> }) {
  if (!(await opsAuthed())) return <OpsGate title="🔍 เทียบเอกสาร" />
  const { id } = await props.params

  const db = svc()
  const { data: cur } = await db.from('doc_documents')
    .select('id, profile, state, vendor_name, vendor_tax_id, doc_no, doc_date, grand_total, currency, original_filename, review_metadata')
    .eq('id', id).single()
  if (!cur) return <section style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>ไม่พบเอกสาร</section>

  const matches = (cur as Doc).review_metadata?.possible_duplicate_matches ?? []
  const matchIds = matches.map((m) => m.document_id)
  const { data: others } = matchIds.length
    ? await db.from('doc_documents')
      .select('id, profile, state, vendor_name, vendor_tax_id, doc_no, doc_date, grand_total, currency, original_filename, review_metadata')
      .in('id', matchIds)
    : { data: [] }
  const othersById: Record<string, Doc> = {}
  for (const o of others ?? []) othersById[(o as Doc).id] = o as Doc

  const back = (cur as Doc).profile === 'stock' ? '/ops-x7k2m9/stock-intake' : '/ops-x7k2m9/documents'

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>DOCBRIEF · เทียบเอกสารซ้ำ</p>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>🔍 เอกสารนี้อาจซ้ำกับรายการเดิม</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>ดูให้ชัดก่อนตัดสิน — <Link href={back} style={{ color: '#6d28d9' }}>← กลับ</Link></p>

      {matches.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          ไม่มีรายการที่จับคู่แล้ว (อาจถูกจัดการไปแล้ว)
        </div>
      ) : (
        <>
          {/* เหตุผล (panel บน) */}
          <div style={{ background: '#fffbea', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>ระบบเตือนเพราะ: </span>
            {[...new Set(matches.flatMap((m) => m.reasons))].map((r) => (
              <span key={r} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e', marginRight: 6 }}>{REASON_TH[r] ?? r}</span>
            ))}
            <span style={{ fontSize: 12, color: '#a16207', marginLeft: 4 }}>· ความคล้าย {Math.round((matches[0]?.score ?? 0) * 100)}%</span>
          </div>

          {/* 2 ช่องเทียบ */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
            <DocCard d={cur as Doc} title="ใบปัจจุบัน (ที่เพิ่งเข้ามา)" tint="#6d28d9" />
            {matches.map((m) => {
              const o = othersById[m.document_id]
              return o ? <DocCard key={m.document_id} d={o} title="รายการที่มีอยู่เดิม" tint="#0f766e" /> : null
            })}
          </div>

          {/* action ปลอดภัย */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <form action={notDuplicate}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="back" value={back} />
              <button type="submit" style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #166534', background: '#fff', color: '#166534', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                ✓ ยืนยันว่าไม่ใช่เอกสารซ้ำ
              </button>
            </form>
            <form action={isDuplicate}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#b45309', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                🗑 เป็นเอกสารซ้ำ → ย้ายไปถังทิ้ง
              </button>
            </form>
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 6 }}>ย้ายไปถังทิ้งกู้คืนได้เสมอ ไม่ได้ลบจริง</p>
        </>
      )}
    </section>
  )
}
