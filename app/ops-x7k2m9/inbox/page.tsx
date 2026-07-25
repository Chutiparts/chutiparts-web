// app/ops-x7k2m9/inbox/page.tsx — docbrief: กล่องงาน (Workflow Inbox)
// blueprint §5/§16.1 — รวม "ใบที่ต้องทำตอนนี้" ทั้ง Profile A+B ในที่เดียว
// เรียงตามความเร่ง · ลิงก์ไปหน้าที่ทำงานได้ · ใช้ข้อมูลเดิม ไม่สร้างตารางใหม่
import { createClient } from '@supabase/supabase-js'
import { opsAuthed } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'

export const dynamic = 'force-dynamic'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

type Doc = {
  id: string; profile: string; state: string
  vendor_name: string | null; original_filename: string; doc_no: string | null; grand_total: number | null
  review_flags: string[]; error_category: string | null; error_message: string | null
  retry_count: number | null; created_at: string; updated_at: string
}

// ป้ายธง → ข้อความไทย (รวมทั้ง Profile A และ B)
const FLAG_TH: Record<string, string> = {
  validation_failed: 'ข้อมูลไม่ผ่านตรวจ', low_confidence: 'อ่านไม่ชัด', missing_doc_no: 'ไม่มีเลขที่',
  vat_mismatch: 'VAT ผิดปกติ', invalid_tax_id: 'เลขภาษีผิด', future_date: 'วันที่อนาคต',
  arithmetic_mismatch: 'ตัวเลขไม่ลงตัว', name_missing: 'ไม่มีชื่อ', name_uncertain: 'ชื่ออ่านไม่ชัด',
  qty_missing: 'ไม่มีจำนวน', price_missing: 'ไม่มีราคา', total_mismatch: 'ยอดไม่ตรง', name_review: 'ควรตรวจชื่อ',
}

const AGO = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return 'เพิ่งเข้า'
  if (h < 24) return `ค้าง ${h} ชม.`
  return `ค้าง ${Math.floor(h / 24)} วัน`
}
const profileBadge = (p: string) => (p === 'stock' ? { icon: '📦', th: 'สต็อก', href: '/ops-x7k2m9/stock-intake' } : { icon: '📄', th: 'บัญชี', href: '/ops-x7k2m9/documents' })

export default async function InboxPage() {
  if (!(await opsAuthed())) return <OpsGate title="📥 กล่องงาน" />

  const db = svc()
  const { data } = await db.from('doc_documents')
    .select('id, profile, state, vendor_name, original_filename, doc_no, grand_total, review_flags, error_category, error_message, retry_count, created_at, updated_at')
    .in('state', ['pending_review', 'confirmed', 'failed'])
    .is('deleted_at', null)
    .order('created_at', { ascending: true }) // เก่าสุดก่อน = ค้างนานสุดขึ้นก่อน
    .limit(500)
  const docs = (data ?? []) as Doc[]

  // แยกไฟล์เสียตั้งแต่อัปโหลด (แก้ไม่ได้ ต้องอัปใหม่) ออกจากงานที่ทำได้
  const groups = {
    review: docs.filter((d) => d.state === 'pending_review'),
    send: docs.filter((d) => d.state === 'confirmed'), // Profile B รอส่ง Sheet
    failed: docs.filter((d) => d.state === 'failed'),
  }
  const total = groups.review.length + groups.send.length + groups.failed.length

  const Section = ({ title, hint, items, color }: { title: string; hint: string; items: Doc[]; color: string }) => {
    if (!items.length) return null
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</h2>
          <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 999, background: color + '22', color }}>{items.length}</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{hint}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((d) => {
            const p = profileBadge(d.profile)
            const flags = (d.review_flags ?? []).filter((f) => FLAG_TH[f])
            return (
              <a key={d.id} href={p.href}
                style={{ display: 'block', border: '1px solid #e5e7eb', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '10px 14px', background: '#fff', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: '#f3f4f6', color: '#374151', whiteSpace: 'nowrap' }}>{p.icon} {p.th}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.vendor_name || d.original_filename}
                      {d.grand_total != null && <span style={{ fontWeight: 400, color: '#6b7280' }}> · {d.grand_total.toLocaleString()} ฿</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.doc_no ? `เลขที่ ${d.doc_no} · ` : ''}{AGO(d.created_at)}</div>
                  </div>
                  <span style={{ fontSize: 12, color: color, fontWeight: 600, whiteSpace: 'nowrap' }}>ทำ →</span>
                </div>
                {(flags.length > 0 || (d.state === 'failed' && d.error_message)) && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {flags.map((f) => <span key={f} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>{FLAG_TH[f]}</span>)}
                    {d.state === 'failed' && d.error_message && <span style={{ fontSize: 10, color: '#b91c1c' }}>{d.error_message.slice(0, 80)}</span>}
                  </div>
                )}
              </a>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>DOCBRIEF · WORKFLOW INBOX</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>📥 กล่องงาน</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>ใบที่ต้องทำตอนนี้ — ทั้งบัญชีและสต็อก · เก่าสุดขึ้นก่อน</p>

      {total === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 15 }}>ไม่มีงานค้าง — เคลียร์หมดแล้ว</div>
        </div>
      ) : (
        <>
          <Section title="รอตรวจ" hint="AI อ่านเสร็จ รอคุณตรวจ/แก้" items={groups.review} color="#854d0e" />
          <Section title="รอส่งเข้า Sheet" hint="ยืนยันแล้ว รอกดส่งออก" items={groups.send} color="#1e40af" />
          <Section title="ไม่ผ่าน — ต้องแก้" hint="มีปัญหา · ลองใหม่หรือแก้ข้อมูล" items={groups.failed} color="#b91c1c" />
        </>
      )}
    </section>
  )
}
