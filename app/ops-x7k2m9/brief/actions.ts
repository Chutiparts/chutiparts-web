'use server'
// app/ops-x7k2m9/brief/actions.ts
// OpsBrief Private — server actions (CRUD + export)
// auth: cookie 'ops_admin' === env ADMIN_OPS_SECRET (fail-closed ถ้าไม่ตั้ง env)

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const COOKIE = 'ops_admin'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

async function authed(): Promise<boolean> {
  const secret = process.env.ADMIN_OPS_SECRET
  if (!secret) return false // fail-closed
  return (await cookies()).get(COOKIE)?.value === secret
}

const MODULES = ['dev', 'social', 'ebook', 'parts', 'tools']
const STATUSES = ['todo', 'doing', 'waiting', 'done']
const PRIOS = ['low', 'normal', 'high']
const clip = (v: unknown, n: number): string => (typeof v === 'string' ? v.trim().slice(0, n) : '')

// NOTE: ไฟล์ 'use server' ห้าม export อะไรที่ไม่ใช่ async function — จึง "ไม่" export type นี้
type OpsData = { ok: boolean; items?: any[]; decisions?: any[]; error?: string }

async function fetchAll(): Promise<OpsData> {
  const supa = svc()
  const [it, dc] = await Promise.all([
    supa.from('ops_items').select('*').order('created_at', { ascending: true }),
    supa.from('ops_decisions').select('*').order('decided_on', { ascending: false }),
  ])
  if (it.error || dc.error) return { ok: false, error: 'fetch_failed' }
  return { ok: true, items: it.data ?? [], decisions: dc.data ?? [] }
}

export async function loadData(): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  return fetchAll()
}

// ---------- ITEMS ----------
export async function createItem(input: { module: string; title: string; detail?: string; priority?: string }): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const module = MODULES.includes(input.module) ? input.module : ''
  const title = clip(input.title, 200)
  if (!module || !title) return { ok: false, error: 'bad_input' }
  const priority = PRIOS.includes(input.priority || '') ? input.priority : 'normal'
  const { error } = await svc().from('ops_items').insert({ module, title, detail: clip(input.detail, 1000) || null, priority })
  if (error) return { ok: false, error: 'insert_failed' }
  return fetchAll()
}

export async function updateItem(input: { id: string; title?: string; detail?: string; priority?: string }): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const patch: any = { updated_at: new Date().toISOString() }
  if (input.title != null) patch.title = clip(input.title, 200)
  if (input.detail != null) patch.detail = clip(input.detail, 1000) || null
  if (input.priority && PRIOS.includes(input.priority)) patch.priority = input.priority
  const { error } = await svc().from('ops_items').update(patch).eq('id', input.id)
  if (error) return { ok: false, error: 'update_failed' }
  return fetchAll()
}

export async function setItemStatus(id: string, status: string): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  if (!STATUSES.includes(status)) return { ok: false, error: 'bad_status' }
  const { error } = await svc().from('ops_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, error: 'update_failed' }
  return fetchAll()
}

export async function archiveItem(id: string, archived: boolean): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const { error } = await svc().from('ops_items').update({ archived, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, error: 'update_failed' }
  return fetchAll()
}

export async function deleteItem(id: string): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const { error } = await svc().from('ops_items').delete().eq('id', id)
  if (error) return { ok: false, error: 'delete_failed' }
  return fetchAll()
}

// ---------- DECISIONS ----------
export async function addDecision(input: { topic: string; reason?: string; next_action?: string; follow_up_date?: string; decided_on?: string }): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const topic = clip(input.topic, 300)
  if (!topic) return { ok: false, error: 'bad_input' }
  const row: any = { topic, reason: clip(input.reason, 1000) || null, next_action: clip(input.next_action, 500) || null }
  if (input.follow_up_date) row.follow_up_date = input.follow_up_date
  if (input.decided_on) row.decided_on = input.decided_on
  const { error } = await svc().from('ops_decisions').insert(row)
  if (error) return { ok: false, error: 'insert_failed' }
  return fetchAll()
}

export async function archiveDecision(id: string, archived: boolean): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const { error } = await svc().from('ops_decisions').update({ archived }).eq('id', id)
  if (error) return { ok: false, error: 'update_failed' }
  return fetchAll()
}

export async function deleteDecision(id: string): Promise<OpsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const { error } = await svc().from('ops_decisions').delete().eq('id', id)
  if (error) return { ok: false, error: 'delete_failed' }
  return fetchAll()
}

// ---------- EXPORT ----------
export async function exportMarkdown(): Promise<{ ok: boolean; md?: string; error?: string }> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const d = await fetchAll()
  if (!d.ok) return { ok: false, error: 'fetch_failed' }
  const items = (d.items || []).filter((i) => !i.archived)
  const decisions = (d.decisions || []).filter((x) => !x.archived)
  const today = new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })
  const MOD: Record<string, string> = { dev: 'Dev Control', social: 'Social Control', ebook: 'eBook Sales Control', parts: 'Premium Parts Control', tools: 'Future Tools Pipeline' }
  const ST: Record<string, string> = { todo: 'รอทำ', doing: 'กำลังทำ', waiting: 'รอข้อมูล', done: 'เสร็จ' }
  const line = (i: any) => `- [${ST[i.status] || i.status}] ${i.title}${i.detail ? ` — ${i.detail}` : ''}`

  let md = `# OpsBrief Private — Daily Export\n\n_วันที่: ${today}_\n`

  const important = items.filter((i) => i.priority === 'high' && i.status !== 'done')
  md += `\n## ⭐ งานสำคัญวันนี้\n${important.length ? important.map(line).join('\n') : '- (ไม่มี)'}`

  for (const m of ['dev', 'social', 'ebook', 'parts', 'tools']) {
    const rows = items.filter((i) => i.module === m)
    md += `\n\n## ${MOD[m]}\n${rows.length ? rows.map(line).join('\n') : '- (ว่าง)'}`
  }

  md += `\n\n## 🧭 Decision Log\n${
    decisions.length
      ? decisions
          .map((x) => `- **${x.topic}** — ${x.reason || '-'}${x.next_action ? ` · ถัดไป: ${x.next_action}` : ''}${x.follow_up_date ? ` · ตามผล: ${x.follow_up_date}` : ''} _(${x.decided_on})_`)
          .join('\n')
      : '- (ไม่มี)'
  }`

  const tmr = items.filter((i) => i.status !== 'done')
  md += `\n\n## 📌 งานที่ต้องทำต่อ (พรุ่งนี้)\n${tmr.length ? tmr.map(line).join('\n') : '- (ไม่มี)'}\n`

  return { ok: true, md }
}

// ---------- AUTH ----------
export async function logout(): Promise<void> {
  ;(await cookies()).set(COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/ops-x7k2m9', maxAge: 0 })
}
