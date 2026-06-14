'use server'
// app/ops-x7k2m9/brief/actions-social.ts
// Phase C — Social Command (โพสต์/ช่องทาง social, manual)
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
  if (!secret) return false
  return (await cookies()).get(COOKIE)?.value === secret
}

const CHANNELS = ['page', 'group_sell', 'group_knowledge', 'cvd', 'other']
const STATUSES = ['draft', 'posted', 'monitoring', 'follow_up', 'archived']
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

export type SocialData = { ok: boolean; error?: string; posts?: any[] }

async function fetchSocial(): Promise<SocialData> {
  const { data, error } = await svc().from('ops_social_posts').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) return { ok: false, error: 'fetch_failed' }
  return { ok: true, posts: data ?? [] }
}

export async function loadSocial(): Promise<SocialData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  return fetchSocial()
}

export async function createSocial(input: { title: string; channel?: string; post_url?: string; target_url?: string }): Promise<SocialData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const title = clip(input.title, 200)
  if (!title) return { ok: false, error: 'bad_input' }
  const channel = CHANNELS.includes(input.channel || '') ? input.channel : 'page'
  const { error } = await svc().from('ops_social_posts').insert({
    title, channel,
    post_url: clip(input.post_url, 500) || null,
    target_url: clip(input.target_url, 500) || null,
  })
  if (error) return { ok: false, error: 'insert_failed' }
  return fetchSocial()
}

export async function updateSocial(input: { id: string; title?: string; channel?: string; post_url?: string; target_url?: string; next_action?: string; note?: string }): Promise<SocialData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const patch: any = { updated_at: new Date().toISOString() }
  if (input.title != null) patch.title = clip(input.title, 200)
  if (input.channel && CHANNELS.includes(input.channel)) patch.channel = input.channel
  if (input.post_url != null) patch.post_url = clip(input.post_url, 500) || null
  if (input.target_url != null) patch.target_url = clip(input.target_url, 500) || null
  if (input.next_action != null) patch.next_action = clip(input.next_action, 500) || null
  if (input.note != null) patch.note = clip(input.note, 1000) || null
  const { error } = await svc().from('ops_social_posts').update(patch).eq('id', input.id)
  if (error) return { ok: false, error: 'update_failed' }
  return fetchSocial()
}

export async function setSocialStatus(id: string, status: string): Promise<SocialData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  if (!STATUSES.includes(status)) return { ok: false, error: 'bad_status' }
  const { error } = await svc().from('ops_social_posts').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, error: 'update_failed' }
  return fetchSocial()
}

export async function deleteSocial(id: string): Promise<SocialData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const { error } = await svc().from('ops_social_posts').delete().eq('id', id)
  if (error) return { ok: false, error: 'delete_failed' }
  return fetchSocial()
}
