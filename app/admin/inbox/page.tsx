// app/admin/inbox/page.tsx — Admin lead/case inbox
// Note: Add authentication check in middleware

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { INTAKE_TYPES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  in_review: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-green-100 text-green-800',
  shipped: 'bg-cyan-100 text-cyan-800',
  closed_won: 'bg-green-200 text-green-900',
  closed_lost: 'bg-gray-100 text-gray-700',
  closed_unreachable: 'bg-gray-200 text-gray-700',
}

const PRIORITY_BADGES: Record<string, { label: string; color: string }> = {
  urgent: { label: '🚨 ด่วน', color: 'bg-red-500 text-white' },
  high: { label: '⚠️ สูง', color: 'bg-orange-500 text-white' },
  normal: { label: 'ปกติ', color: 'bg-gray-200' },
  low: { label: 'ต่ำ', color: 'bg-gray-100' },
}

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string }
}) {
  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('cases')
    .select(`
      id, case_number, status, priority,
      intake_type, part_name, symptom_category, symptom_detail,
      contact_name, contact_phone, contact_line_id, contact_province,
      stop_drive, warning_light,
      created_at, sla_due_at, first_responded_at,
      vehicles ( chassis, year_from, engine_code )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }
  if (searchParams.q) {
    query = query.or(`case_number.ilike.%${searchParams.q}%,contact_name.ilike.%${searchParams.q}%,contact_phone.ilike.%${searchParams.q}%`)
  }

  const { data: cases, error } = await query

  // Stats
  const { data: stats } = await supabase.from('v_case_stats').select('*')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">📥 Inbox</h1>
          <div className="flex gap-2">
            <Link href="/admin/cases/export" className="rounded-lg bg-gray-800 text-white px-4 py-2 text-sm">
              📤 Export CSV
            </Link>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {stats?.map(s => (
            <div key={s.status} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500 uppercase">{s.status}</div>
              <div className="text-2xl font-bold mt-1">{s.count}</div>
              <div className="text-xs text-gray-500">{s.last_7d} ใน 7 วัน</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/admin/inbox" className={`rounded-full px-4 py-2 text-sm font-semibold ${!searchParams.status ? 'bg-yellow-500 text-white' : 'bg-white border'}`}>
            ทั้งหมด
          </Link>
          {['new','in_review','quoted','confirmed','closed_won'].map(s => (
            <Link key={s} href={`/admin/inbox?status=${s}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${searchParams.status === s ? 'bg-yellow-500 text-white' : 'bg-white border'}`}
            >{s}</Link>
          ))}
        </div>

        {/* Table */}
        {error && <div className="text-red-500 p-4 bg-red-50 rounded-lg">{error.message}</div>}

        {cases && cases.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">ไม่มีเคส</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="px-4 py-3">รถ</th>
                  <th className="px-4 py-3">ประเภท</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SLA</th>
                </tr>
              </thead>
              <tbody>
                {cases?.map(c => {
                  const veh = Array.isArray(c.vehicles) ? c.vehicles[0] : c.vehicles
                  const slaOver = c.sla_due_at && new Date(c.sla_due_at) < new Date() && !c.first_responded_at
                  const intakeType = INTAKE_TYPES[c.intake_type as keyof typeof INTAKE_TYPES]
                  return (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm">
                        <Link href={`/admin/cases/${c.id}`} className="text-blue-600 hover:underline">
                          {c.case_number}
                        </Link>
                        {c.stop_drive && <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">🛑</span>}
                        {c.priority !== 'normal' && (
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${PRIORITY_BADGES[c.priority].color}`}>
                            {PRIORITY_BADGES[c.priority].label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold">{c.contact_name}</div>
                        <div className="text-xs text-gray-500">
                          {c.contact_phone || c.contact_line_id} · {c.contact_province}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {veh?.chassis} ({veh?.year_from}) {veh?.engine_code}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {intakeType?.icon} {intakeType?.label}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[c.status]}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {slaOver ? (
                          <span className="text-red-600 font-bold">⏰ เกิน SLA</span>
                        ) : c.first_responded_at ? (
                          <span className="text-green-600">✓ ตอบแล้ว</span>
                        ) : (
                          <span className="text-gray-500">
                            {c.sla_due_at && new Date(c.sla_due_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
