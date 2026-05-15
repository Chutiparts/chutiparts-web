// app/admin/cases/[id]/page.tsx — Admin Case Detail
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CaseDetailClient from './CaseDetailClient'
import { INTAKE_TYPES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: caseRow, error } = await supabase
    .from('cases')
    .select(`
      *,
      vehicles ( chassis, year_from, engine_code, body_style, variant )
    `)
    .eq('id', params.id)
    .single()

  if (error || !caseRow) notFound()

  // Get admins for assign dropdown
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['admin_content', 'admin_sales', 'admin_super'])

  const intakeType = INTAKE_TYPES[caseRow.intake_type as keyof typeof INTAKE_TYPES]
  const vehicle = Array.isArray(caseRow.vehicles) ? caseRow.vehicles[0] : caseRow.vehicles

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <Link href="/admin/inbox" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mb-4">
        ← Inbox
      </Link>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 text-white p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-gray-400 uppercase">Case</p>
              <h1 className="text-2xl font-bold font-mono">{caseRow.case_number}</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">สร้างเมื่อ</p>
              <p className="text-sm">{new Date(caseRow.created_at).toLocaleString('th-TH')}</p>
              {caseRow.stop_drive && (
                <span className="inline-block mt-1 bg-red-500 text-white text-xs px-2 py-1 rounded">🛑 ห้ามขับ</span>
              )}
            </div>
          </div>
        </div>

        <CaseDetailClient case={caseRow} vehicle={vehicle} admins={admins || []} />
      </div>
    </div>
  )
}
