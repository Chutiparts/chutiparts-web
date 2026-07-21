// TARGET PATH: app/api/ai/v1/tasks/open/route.ts
// list_open_tasks — งานค้าง · READ-ONLY · Phase 2: handleAiRead (weight 2)
import { type NextRequest } from 'next/server'
import { handleAiRead, norm, daysSince } from '@/lib/ai-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const taskOpen = (t: any) => !['done', 'cancelled'].includes(norm(t.status) || 'todo')

export async function GET(req: NextRequest) {
  return handleAiRead(req, {
    tool: 'tasks/open',
    keyParams: ['owner'],
    fetch: async (supa, sp) => {
      const ownerFilter = (sp.get('owner') || '').trim().slice(0, 60).toLowerCase()

      const { data, error } = await supa.from('ops_tasks').select('*').order('created_at', { ascending: false }).limit(500)
      if (error) throw new Error('query_failed')

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

      return { data: { count: tasks.length, tasks }, resultCount: tasks.length }
    },
  })
}
