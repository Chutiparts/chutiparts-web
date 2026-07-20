// TARGET PATH: app/api/ai/v1/tasks/open/route.ts
// list_open_tasks — งานค้าง (status ไม่ใช่ done/cancelled) · READ-ONLY
import { NextResponse, type NextRequest } from 'next/server'
import { aiSupa, checkAuth, audit, norm, daysSince, noStore } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const taskOpen = (t: any) => !['done', 'cancelled'].includes(norm(t.status) || 'todo')

export async function GET(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) return auth.res

  const { searchParams } = new URL(req.url)
  const ownerFilter = (searchParams.get('owner') || '').trim().slice(0, 60).toLowerCase()

  const supa = aiSupa()
  if (!supa) return NextResponse.json({ v: 1, error: 'server_misconfig' }, { status: 500 })

  const { data, error } = await supa
    .from('ops_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ v: 1, error: 'query_failed' }, { status: 500 })

  let rows = (data || []).filter(taskOpen)
  if (ownerFilter) rows = rows.filter((t: any) => norm(t.owner).includes(ownerFilter))

  const tasks = rows.map((t: any) => ({
    id: t.id ? String(t.id).slice(0, 8) : null,
    title: t.title || null,
    owner: t.owner || null,
    no_owner: !t.owner,
    status: norm(t.status) || 'todo',
    priority: t.priority || 'medium',
    task_type: t.task_type || null,
    due_date: t.due_date || null,
    age_days: daysSince(t.created_at),
    overdue_days: t.due_date ? Math.max(daysSince(t.due_date), 0) : 0,
  }))

  await audit(supa, auth.tid, 'list_open_tasks', { owner: ownerFilter }, tasks.length)

  return NextResponse.json({ v: 1, count: tasks.length, tasks }, { headers: noStore })
}
