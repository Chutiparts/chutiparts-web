// app/ops-x7k2m9/doc-metrics/page.tsx — Dashboard: ต้นทุน AI + ปริมาณ + คุณภาพ + เวลาประหยัด
// blueprint §6 · อ่านจาก doc_metrics + doc_documents + doc_exports ที่มีอยู่ · ไม่สร้างตารางใหม่
// logic การคำนวณอยู่ที่ lib/docbrief-metrics.ts (ทดสอบแยกได้) · เวลาไทย (UTC+7)
import { createClient } from '@supabase/supabase-js'
import { opsAuthed } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'
import {
  agg, bkkDay, withinLastDays, dayStartShift, timeSavedMinutes, humanizeMinutes, reviewRate, exportSuccessRate,
} from '@/lib/docbrief-metrics'

export const dynamic = 'force-dynamic'
const SOFT_CAP = Number(process.env.DOCBRIEF_SOFT_CAP_THB || 2)
const MIN_PER_DOC = Number(process.env.DOCBRIEF_MINUTES_SAVED_PER_DOC || 3)

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

const baht = (n: number) => '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const nowMs = () => Date.now() // แยกเป็น helper — Date.now ใน server component
function Section({ title }: { title: string }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '18px 0 8px' }}>{title}</div>
}

export default async function DocMetricsPage() {
  if (!(await opsAuthed())) return <OpsGate title="📊 ต้นทุน & คุณภาพ" />

  const db = svc()
  const since = new Date(nowMs() - 31 * 86400000).toISOString()
  const [mRes, dRes, eRes] = await Promise.all([
    db.from('doc_metrics').select('document_id, cost_thb, latency_ms, created_at').gte('created_at', since),
    db.from('doc_documents').select('id, state, review_flags, profile, created_at').is('deleted_at', null),
    db.from('doc_exports').select('status'),
  ])
  const metrics = mRes.data ?? []
  const docs = dRes.data ?? []
  const exports = eRes.data ?? []
  const now = nowMs()

  // profile ของแต่ละ metric (join ผ่าน document_id)
  const profileById: Record<string, string> = {}
  for (const d of docs) profileById[d.id] = d.profile

  const today = agg(metrics.filter((r) => withinLastDays(r.created_at, 1, now)))
  const week = agg(metrics.filter((r) => withinLastDays(r.created_at, 7, now)))
  const month = agg(metrics)

  // แยก Profile A/B (30 วัน)
  const mAcc = agg(metrics.filter((r) => profileById[r.document_id] !== 'stock'))
  const mStock = agg(metrics.filter((r) => profileById[r.document_id] === 'stock'))

  // backlog
  const pending = docs.filter((d) => d.state === 'pending_review').length
  const failed = docs.filter((d) => d.state === 'failed').length

  // คุณภาพ (30 วัน)
  const extracted30 = docs.filter((d) => withinLastDays(d.created_at, 31, now) && ['pending_review', 'confirmed', 'exported'].includes(d.state))
  const flagged30 = extracted30.filter((d) => (d.review_flags?.length ?? 0) > 0).length
  const rRate = reviewRate(flagged30, extracted30.length)

  // export success
  const expOk = exports.filter((e) => e.status === 'success').length
  const expFail = exports.filter((e) => e.status === 'failed').length
  const eRate = exportSuccessRate(expOk, expFail)

  // เวลาประหยัด (30 วัน)
  const savedMin = timeSavedMinutes(month.n, MIN_PER_DOC)

  const card: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff', flex: 1, minWidth: 150 }
  const big = (v: string, c = '#111827'): React.CSSProperties => ({ fontSize: 24, fontWeight: 800, color: c })
  const capColor = (v: number) => (v <= SOFT_CAP ? '#059669' : '#b45309')

  // กราฟ 7 วัน
  const start = dayStartShift(now)
  const days: { day: string; cost: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const full = new Date(start - i * 86400000).toISOString().slice(0, 10)
    const rows = metrics.filter((r) => bkkDay(r.created_at) === full)
    days.push({ day: full.slice(5), cost: rows.reduce((s, r) => s + (Number(r.cost_thb) || 0), 0) })
  }
  const maxCost = Math.max(1, ...days.map((d) => d.cost))

  return (
    <section style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>DOCBRIEF · DASHBOARD</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>📊 ต้นทุน & คุณภาพ</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>ค่า AI · ปริมาณ · คุณภาพการอ่าน · เวลาที่ประหยัด · เวลาไทย</p>

      <Section title="ค่า AI" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>วันนี้</div>
          <div style={big(String(today.n))}>{today.n} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>ใบ</span></div>
          <div style={{ fontSize: 14, marginTop: 4 }}>{baht(today.cost)}</div>
          <div style={{ fontSize: 12, color: capColor(today.avg), marginTop: 2 }}>เฉลี่ย {baht(today.avg)}/ใบ (cap {SOFT_CAP})</div>
        </div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>7 วัน</div><div style={big(String(week.n))}>{week.n} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>ใบ</span></div><div style={{ fontSize: 14, marginTop: 4 }}>{baht(week.cost)}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>30 วัน</div><div style={big(String(month.n))}>{month.n} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>ใบ</span></div><div style={{ fontSize: 14, marginTop: 4 }}>{baht(month.cost)} / เดือน</div></div>
      </div>

      <Section title="แยกตามประเภท (30 วัน)" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>📄 บัญชี</div><div style={big(String(mAcc.n))}>{mAcc.n} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>ใบ</span></div><div style={{ fontSize: 14, marginTop: 4 }}>{baht(mAcc.cost)} · เฉลี่ย {baht(mAcc.avg)}/ใบ</div></div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>📦 สต็อก</div><div style={big(String(mStock.n))}>{mStock.n} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>ใบ</span></div><div style={{ fontSize: 14, marginTop: 4 }}>{baht(mStock.cost)} · เฉลี่ย {baht(mStock.avg)}/ใบ</div></div>
      </div>

      <Section title="คุณค่า & คุณภาพ" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>เวลาที่ประหยัด (30 วัน)</div><div style={big(humanizeMinutes(savedMin), '#0f766e')}>{humanizeMinutes(savedMin)}</div><div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>~{MIN_PER_DOC} นาที/ใบ × {month.n} ใบ</div></div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>ต้องตรวจพิเศษ (มีธง)</div><div style={big(rRate + '%')}>{rRate}%</div><div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{flagged30}/{extracted30.length} ใบ</div></div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>ส่งออกสำเร็จ</div><div style={big(eRate + '%', eRate >= 95 ? '#059669' : '#b45309')}>{eRate}%</div><div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{expOk} สำเร็จ · {expFail} พลาด</div></div>
      </div>

      <Section title="งานค้าง" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>รอตรวจ</div><div style={big(String(pending), pending ? '#854d0e' : '#111827')}>{pending}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>ไม่ผ่าน</div><div style={big(String(failed), failed ? '#b91c1c' : '#111827')}>{failed}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: '#6b7280' }}>เวลา AI เฉลี่ย/ใบ</div><div style={big(Math.round(month.latency / 1000) + ' วิ')}>{Math.round(month.latency / 1000)} วิ</div></div>
      </div>

      <Section title="ค่า AI 7 วันล่าสุด" />
      <div style={{ ...card, flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
          {days.map((d) => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{d.cost > 0 ? baht(d.cost) : ''}</div>
              <div style={{ width: '100%', maxWidth: 40, height: Math.max(2, (d.cost / maxCost) * 90), background: d.cost > 0 ? '#C9A961' : '#e5e7eb', borderRadius: 4 }} />
              <div style={{ fontSize: 10, color: '#9ca3af' }}>{d.day}</div>
            </div>
          ))}
        </div>
      </div>

      {month.n === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20, fontSize: 13 }}>ยังไม่มีการอ่านเอกสารใน 30 วันนี้ — เริ่มใช้แล้วตัวเลขจะขึ้นเอง</p>}
    </section>
  )
}
