// app/ops-x7k2m9/repository/[id]/page.tsx — รายละเอียดเอกสาร + Activity Timeline (blueprint §5/§12)
// แสดง: ข้อมูลที่ดึงได้ · review flags · export status · ประวัติทุก event (actor/action/time)
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { opsAuthed } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'

export const dynamic = 'force-dynamic'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

const STATE_TH: Record<string, string> = {
  received: 'รับเข้า', queued: 'รออ่าน', extracting: 'กำลังอ่าน', pending_review: 'รอตรวจ',
  confirmed: 'ยืนยันแล้ว', exporting: 'กำลังส่ง', exported: 'ส่งออกแล้ว', rejected: 'ปฏิเสธ', failed: 'ไม่ผ่าน', duplicate: 'ซ้ำ',
}
// action → ข้อความไทย + ไอคอน + ชนิด actor
const ACTION_TH: Record<string, { th: string; icon: string }> = {
  'document.received': { th: 'รับเอกสารเข้า', icon: '📥' },
  'state.transition': { th: 'เปลี่ยนสถานะ', icon: '➡️' },
  'extraction.completed': { th: 'AI อ่านเสร็จ', icon: '🤖' },
  'extraction.failed': { th: 'อ่านไม่สำเร็จ', icon: '⚠️' },
  'field.corrected': { th: 'แก้ไขข้อมูล', icon: '✏️' },
  'line.edited': { th: 'แก้บรรทัด', icon: '✏️' },
  'sku.auto_assigned': { th: 'เติม SKU อัตโนมัติ', icon: '🔢' },
  'autofill.applied': { th: 'เติมข้อมูลอัตโนมัติ', icon: '🔢' },
  'document.confirmed': { th: 'ยืนยันเอกสาร', icon: '✅' },
  'document.exported': { th: 'ส่งออก', icon: '📊' },
  'export.failed': { th: 'ส่งออกไม่สำเร็จ', icon: '⚠️' },
  'document.rejected': { th: 'ปฏิเสธ', icon: '🚫' },
  'document.trashed': { th: 'ทิ้งลงถัง', icon: '🗑' },
  'document.restored': { th: 'กู้คืน', icon: '↩️' },
  'document.retried': { th: 'ลองใหม่', icon: '🔁' },
  'duplicate.detected': { th: 'พบว่าอาจซ้ำ', icon: '🔍' },
  'duplicate.dismissed': { th: 'ยืนยันว่าไม่ซ้ำ', icon: '✓' },
}
const fmt = (iso: string) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const money = (n: number | null) => (n != null ? n.toLocaleString() + ' ฿' : '—')
const fld: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }

export default async function RepoDetailPage(props: { params: Promise<{ id: string }> }) {
  if (!(await opsAuthed())) return <OpsGate title="🗂️ รายละเอียดเอกสาร" />
  const { id } = await props.params

  const db = svc()
  const [docRes, auditRes, expRes] = await Promise.all([
    db.from('doc_documents').select('*').eq('id', id).single(),
    db.from('doc_audit').select('actor, action, from_state, to_state, metadata, created_at').eq('document_id', id).order('created_at', { ascending: false }).limit(100),
    db.from('doc_exports').select('status, row_ref, exported_at, error_message').eq('document_id', id).order('id', { ascending: false }).limit(1),
  ])
  const d = docRes.data
  if (!d) return <section style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>ไม่พบเอกสาร · <Link href="/ops-x7k2m9/repository">← กลับ</Link></section>
  const audit = auditRes.data ?? []
  const exp = expRes.data?.[0]

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>DOCBRIEF · เอกสาร</p>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{d.vendor_name || d.original_filename}</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        {d.profile === 'stock' ? '📦 สต็อก' : '📄 บัญชี'} · สถานะ {STATE_TH[d.state] ?? d.state} · <Link href="/ops-x7k2m9/repository" style={{ color: '#6d28d9' }}>← กลับคลัง</Link>
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* ข้อมูล + export */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, marginBottom: 8 }}>ข้อมูลที่ดึงได้</div>
            <div style={fld}><span style={{ color: '#6b7280' }}>ไฟล์</span><b style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.original_filename}</b></div>
            <div style={fld}><span style={{ color: '#6b7280' }}>ผู้ขาย</span><b>{d.vendor_name || '—'}</b></div>
            <div style={fld}><span style={{ color: '#6b7280' }}>เลขที่</span><b>{d.doc_no || '—'}</b></div>
            <div style={fld}><span style={{ color: '#6b7280' }}>วันที่</span><b>{d.doc_date || '—'}</b></div>
            <div style={fld}><span style={{ color: '#6b7280' }}>ยอดสุทธิ</span><b>{money(d.grand_total)}</b></div>
            {d.source && <div style={fld}><span style={{ color: '#6b7280' }}>แหล่ง</span><b>{d.source}</b></div>}
            <div style={{ ...fld, borderBottom: 'none' }}><span style={{ color: '#6b7280' }}>เข้าระบบ</span><b>{fmt(d.created_at)}</b></div>
            {(d.review_flags?.length ?? 0) > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {d.review_flags.map((fl: string) => <span key={fl} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>{fl}</span>)}
              </div>
            )}
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, marginBottom: 8 }}>การส่งออก</div>
            {exp ? (
              <>
                <div style={fld}><span style={{ color: '#6b7280' }}>สถานะ</span><b style={{ color: exp.status === 'success' ? '#059669' : exp.status === 'failed' ? '#b91c1c' : '#6b7280' }}>{exp.status}</b></div>
                {exp.row_ref && <div style={fld}><span style={{ color: '#6b7280' }}>แถวใน Sheet</span><b>{exp.row_ref}</b></div>}
                {exp.exported_at && <div style={{ ...fld, borderBottom: 'none' }}><span style={{ color: '#6b7280' }}>เมื่อ</span><b>{fmt(exp.exported_at)}</b></div>}
                {exp.error_message && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{exp.error_message}</div>}
              </>
            ) : <div style={{ fontSize: 13, color: '#9ca3af' }}>ยังไม่ส่งออก</div>}
          </div>
        </div>

        {/* Activity timeline (§12) */}
        <div style={{ flex: '1 1 340px', minWidth: 300 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, marginBottom: 12 }}>ประวัติการทำงาน ({audit.length})</div>
            {audit.length === 0 ? <div style={{ fontSize: 13, color: '#9ca3af' }}>ยังไม่มีประวัติ</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {audit.map((e, i) => {
                  const a = ACTION_TH[e.action] ?? { th: e.action, icon: '•' }
                  const isSystem = e.actor === 'system'
                  const changed = (e.metadata as { changed?: Record<string, { from: unknown; to: unknown }> } | null)?.changed
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: 15 }}>{a.icon}</span>
                        {i < audit.length - 1 && <span style={{ flex: 1, width: 1, background: '#e5e7eb', marginTop: 2 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{a.th}
                          {e.from_state && e.to_state && <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11 }}> · {STATE_TH[e.from_state] ?? e.from_state} → {STATE_TH[e.to_state] ?? e.to_state}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                          <span style={{ color: isSystem ? '#6d28d9' : '#0f766e', fontWeight: 600 }}>{isSystem ? '⚙️ ระบบ' : `👤 ${e.actor}`}</span> · {fmt(e.created_at)}
                        </div>
                        {changed && (
                          <div style={{ marginTop: 3, fontSize: 11, color: '#6b7280' }}>
                            {Object.entries(changed).map(([k, v]) => (
                              <div key={k}>{k}: <span style={{ color: '#b91c1c' }}>{String(v.from ?? '—')}</span> → <span style={{ color: '#059669' }}>{String(v.to ?? '—')}</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
