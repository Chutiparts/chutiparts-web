// app/ops-x7k2m9/doc-metrics/page.tsx — docbrief: หน้าดูต้นทุน AI + ปริมาณ + งานค้าง
// เบา ๆ · อ่านจาก doc_metrics + doc_documents ที่มีอยู่แล้ว · ไม่สร้างตารางใหม่
// เวลาแบ่งวันตามเวลาไทย (UTC+7)
import { createClient } from '@supabase/supabase-js'
import { opsAuthed } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'

export const dynamic = 'force-dynamic'

const SOFT_CAP = Number(process.env.DOCBRIEF_SOFT_CAP_THB || 2)

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

const baht = (n: number) => '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
// เลื่อนเป็นเวลาไทยแล้วตัดเป็น YYYY-MM-DD
const BKK = 7 * 3600 * 1000
const bkkDay = (iso: string) => new Date(new Date(iso).getTime() + BKK).toISOString().slice(0, 10)

export default async function DocMetricsPage() {
  if (!(await opsAuthed())) return <OpsGate title="📊 ต้นทุน & ปริมาณ" />

  const db = svc()
  const since = new Date(Date.now() - 31 * 86400000).toISOString()

  const [mRes, dRes] = await Promise.all([
    db.from('doc_metrics').select('cost_thb, latency_ms, created_at').gte('created_at', since),
    db.from('doc_documents').select('state, review_flags, profile, created_at'),
  ])
  const metrics = mRes.data ?? []
  const docs = dRes.data ?? []

  // ขอบเขตวัน (เวลาไทย)
  const nowShift = Date.now() + BKK
  const todayStr = new Date(nowShift).toISOString().slice(0, 10)
  const dayStartShift = new Date(todayStr + 'T00:00:00.000Z').getTime()
  const inLast = (iso: string, days: number) => (new Date(iso).getTime() + BKK) >= dayStartShift - (days - 1) * 86400000

  const agg = (rows: typeof metrics) => ({
    n: rows.length,
    cost: rows.reduce((s, r) => s + (Number(r.cost_thb) || 0), 0),
    avg: rows.length ? rows.reduce((s, r) => s + (Number(r.cost_thb) || 0), 0) / rows.length : 0,
    latency: rows.length ? rows.reduce((s, r) => s + (Number(r.latency_ms) || 0), 0) / rows.length : 0,
  })
  const today = agg(metrics.filter((r) => inLast(r.created_at, 1)))
  const week = agg(metrics.filter((r) => inLast(r.created_at, 7)))
  const month = agg(metrics) // 31 วันที่ดึงมา
  const projMonth = month.n ? month.cost : 0 // 31 วัน ≈ 1 เดือน

  // งานค้าง (สถานะปัจจุบัน ทุก profile)
  const pending = docs.filter((d) => d.state === 'pending_review').length
  const failed = docs.filter((d) => d.state === 'failed').length
  const flagged30 = docs.filter((d) => inLast(d.created_at, 31) && (d.review_flags?.length ?? 0) > 0).length
  const extracted30 = docs.filter((d) => inLast(d.created_at, 31) && ['pending_review', 'confirmed', 'exported'].includes(d.state)).length
  const flagRate = extracted30 ? Math.round((flagged30 / extracted30) * 100) : 0

  // กราฟแท่ง 7 วัน (ค่า AI ต่อวัน)
  const days: { day: string; cost: number; n: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(dayStartShift - i * 86400000).toISOString().slice(5, 10) // MM-DD
    const full = new Date(dayStartShift - i * 86400000).toISOString().slice(0, 10)
    const rows = metrics.filter((r) => bkkDay(r.created_at) === full)
    days.push({ day: d, cost: rows.reduce((s, r) => s + (Number(r.cost_thb) || 0), 0), n: rows.length })
  }
  const maxCost = Math.max(1, ...days.map((d) => d.cost))

  const card: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff', flex: 1, minWidth: 160 }
  const big = (v: string, c = '#111827'): React.CSSProperties => ({ fontSize: 26, fontWeight: 800, color: c })
  const cap = (v: number, capv: number) => (v <= capv ? '#059669' : '#b45309')

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>DOCBRIEF · COST & VOLUME</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>📊 ต้นทุน & ปริมาณ</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>ค่า AI ที่ใช้อ่านเอกสาร · งานค้าง · เวลาไทย</p>

      {/* วันนี้ / สัปดาห์ / เดือน */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>วันนี้</div>
          <div style={big(String(today.n))}>{today.n} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>ใบ</span></div>
          <div style={{ fontSize: 14, marginTop: 4 }}>ค่า AI <b>{baht(today.cost)}</b></div>
          <div style={{ fontSize: 12, color: cap(today.avg, SOFT_CAP), marginTop: 2 }}>เฉลี่ย {baht(today.avg)}/ใบ (cap {SOFT_CAP})</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>7 วัน</div>
          <div style={big(String(week.n))}>{week.n} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>ใบ</span></div>
          <div style={{ fontSize: 14, marginTop: 4 }}>ค่า AI <b>{baht(week.cost)}</b></div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>30 วัน</div>
          <div style={big(String(month.n))}>{month.n} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280' }}>ใบ</span></div>
          <div style={{ fontSize: 14, marginTop: 4 }}>ค่า AI <b>{baht(projMonth)}</b> / เดือน</div>
        </div>
      </div>

      {/* งานค้าง + คุณภาพ */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>รอตรวจ</div>
          <div style={big(String(pending), pending > 0 ? '#854d0e' : '#111827')}>{pending}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>ไม่ผ่าน</div>
          <div style={big(String(failed), failed > 0 ? '#b91c1c' : '#111827')}>{failed}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>ใบที่มีธงเตือน (30 วัน)</div>
          <div style={big(flagRate + '%')}>{flagRate}%</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{flagged30}/{extracted30} ใบ · AI ~{Math.round(month.latency / 1000)} วิ/ใบ</div>
        </div>
      </div>

      {/* กราฟ 7 วัน */}
      <div style={{ ...card, flex: 'none' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>ค่า AI 7 วันล่าสุด</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
          {days.map((d) => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{d.n ? baht(d.cost) : ''}</div>
              <div style={{ width: '100%', maxWidth: 40, height: Math.max(2, (d.cost / maxCost) * 90), background: d.cost > 0 ? '#C9A961' : '#e5e7eb', borderRadius: 4 }} />
              <div style={{ fontSize: 10, color: '#9ca3af' }}>{d.day}</div>
            </div>
          ))}
        </div>
      </div>

      {month.n === 0 && (
        <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20, fontSize: 13 }}>
          ยังไม่มีการอ่านเอกสารใน 30 วันนี้ — เริ่มใช้แล้วตัวเลขจะขึ้นเอง
        </p>
      )}
    </section>
  )
}
