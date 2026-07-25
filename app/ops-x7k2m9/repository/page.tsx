// app/ops-x7k2m9/repository/page.tsx — คลังเอกสาร (ค้นย้อนหลัง) — blueprint §5
// ค้น + filter ทุก profile/ทุกสถานะ · ลิงก์ไปหน้า detail (มี activity timeline)
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { opsAuthed } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'
import { parseRepoFilters, hasActiveFilters, sanitizeLike } from '@/lib/docbrief-repository'

export const dynamic = 'force-dynamic'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

const STATE_TH: Record<string, string> = {
  received: 'รับเข้า', queued: 'รออ่าน', extracting: 'กำลังอ่าน', pending_review: 'รอตรวจ',
  confirmed: 'ยืนยันแล้ว', exporting: 'กำลังส่ง', exported: 'ส่งออกแล้ว', rejected: 'ปฏิเสธ',
  failed: 'ไม่ผ่าน', duplicate: 'ซ้ำ (ไฟล์)',
}
const STATE_OPTS = Object.keys(STATE_TH)
const money = (n: number | null) => (n != null ? n.toLocaleString() + ' ฿' : '—')
const inp: React.CSSProperties = { padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, width: '100%' }
const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }

export default async function RepositoryPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await opsAuthed())) return <OpsGate title="🗂️ คลังเอกสาร" />
  const sp = await props.searchParams
  const f = parseRepoFilters(sp)

  const db = svc()
  let query = db.from('doc_documents')
    .select('id, profile, state, vendor_name, doc_no, doc_date, grand_total, source, review_flags, created_at')
    .is('deleted_at', null)

  if (f.q) {
    const kw = sanitizeLike(f.q)
    if (kw) query = query.or(`vendor_name.ilike.%${kw}%,doc_no.ilike.%${kw}%`)
  }
  if (f.state) query = query.eq('state', f.state)
  if (f.profile) query = query.eq('profile', f.profile)
  if (f.vendor) { const v = sanitizeLike(f.vendor); if (v) query = query.ilike('vendor_name', `%${v}%`) }
  if (f.dateFrom) query = query.gte('doc_date', f.dateFrom)
  if (f.dateTo) query = query.lte('doc_date', f.dateTo)
  if (f.amountMin != null) query = query.gte('grand_total', f.amountMin)
  if (f.amountMax != null) query = query.lte('grand_total', f.amountMax)
  if (f.dupOnly) query = query.contains('review_flags', ['possible_duplicate'])
  if (f.source) { const s = sanitizeLike(f.source); if (s) query = query.ilike('source', `%${s}%`) }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(100)
  const docs = data ?? []

  return (
    <section style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>DOCBRIEF · REPOSITORY</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>🗂️ คลังเอกสาร</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>ค้นเอกสารย้อนหลังทุกใบ ทุกสถานะ — คลิกดูรายละเอียด + ประวัติ</p>

      {/* ฟอร์มค้นหา (GET) */}
      <form method="GET" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>ค้นหา (ผู้ขาย / เลขที่)</label><input name="q" defaultValue={f.q} style={inp} placeholder="เช่น สรรพากร หรือ 6712..." /></div>
          <div><label style={lbl}>ประเภท</label>
            <select name="profile" defaultValue={f.profile} style={inp}>
              <option value="">ทั้งหมด</option><option value="accounting">บัญชี</option><option value="stock">สต็อก</option>
            </select>
          </div>
          <div><label style={lbl}>สถานะ</label>
            <select name="state" defaultValue={f.state} style={inp}>
              <option value="">ทุกสถานะ</option>
              {STATE_OPTS.map((s) => <option key={s} value={s}>{STATE_TH[s]}</option>)}
            </select>
          </div>
          <div><label style={lbl}>ผู้ขาย</label><input name="vendor" defaultValue={f.vendor} style={inp} /></div>
          <div><label style={lbl}>วันที่ตั้งแต่</label><input type="date" name="date_from" defaultValue={f.dateFrom} style={inp} /></div>
          <div><label style={lbl}>ถึง</label><input type="date" name="date_to" defaultValue={f.dateTo} style={inp} /></div>
          <div><label style={lbl}>ยอดต่ำสุด</label><input name="amount_min" defaultValue={f.amountMin ?? ''} style={inp} inputMode="numeric" /></div>
          <div><label style={lbl}>ยอดสูงสุด</label><input name="amount_max" defaultValue={f.amountMax ?? ''} style={inp} inputMode="numeric" /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#374151' }}>
              <input type="checkbox" name="dup" value="1" defaultChecked={f.dupOnly} /> เฉพาะที่อาจซ้ำ
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="submit" style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#17301F', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>ค้นหา</button>
          {hasActiveFilters(f) && <Link href="/ops-x7k2m9/repository" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>ล้างตัวกรอง</Link>}
        </div>
      </form>

      {error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>ค้นไม่สำเร็จ: {error.message}</div>}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>พบ {docs.length} รายการ{docs.length >= 100 ? ' (แสดง 100 แรก — กรองเพิ่มเพื่อแคบลง)' : ''}</div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {docs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>ไม่พบเอกสารตามเงื่อนไข</div>
        ) : docs.map((d, i) => (
          <Link key={d.id} href={`/ops-x7k2m9/repository/${d.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', textDecoration: 'none', color: 'inherit', background: i % 2 ? '#fafafa' : '#fff', borderTop: i ? '1px solid #f3f4f6' : 'none' }}>
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#f3f4f6', color: '#374151', whiteSpace: 'nowrap' }}>{d.profile === 'stock' ? '📦' : '📄'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.vendor_name || '(ไม่มีชื่อ)'}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.doc_no ? `เลขที่ ${d.doc_no} · ` : ''}{d.doc_date || '—'}{d.source ? ` · ${d.source}` : ''}</div>
            </div>
            {(d.review_flags ?? []).includes('possible_duplicate') && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>อาจซ้ำ</span>}
            <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{money(d.grand_total)}</span>
            <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', minWidth: 70, textAlign: 'right' }}>{STATE_TH[d.state] ?? d.state}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
