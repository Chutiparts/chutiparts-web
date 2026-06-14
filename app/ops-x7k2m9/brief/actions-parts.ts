'use server'
// app/ops-x7k2m9/brief/actions-parts.ts
// Phase D — Premium Parts Pipeline (อะไหล่พรีเมียม, manual + seed)
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

const STATUSES = ['not_uploaded', 'uploaded', 'posted', 'inquiry', 'negotiating', 'sold', 'needs_photo', 'needs_detail']
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const intOrNull = (v: unknown) => {
  if (v == null || v === '') return null
  const n = Math.trunc(Number(v))
  return isNaN(n) ? null : n
}

export type PartsData = { ok: boolean; error?: string; parts?: any[] }

async function fetchParts(): Promise<PartsData> {
  const { data, error } = await svc().from('ops_parts_pipeline').select('*').order('created_at', { ascending: true }).limit(300)
  if (error) return { ok: false, error: 'fetch_failed' }
  return { ok: true, parts: data ?? [] }
}

export async function loadParts(): Promise<PartsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  return fetchParts()
}

export async function createPart(input: { title: string; model?: string; sku?: string; condition?: string; price?: any; stock?: any }): Promise<PartsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const title = clip(input.title, 200)
  if (!title) return { ok: false, error: 'bad_input' }
  const { error } = await svc().from('ops_parts_pipeline').insert({
    title,
    model: clip(input.model, 40) || null,
    sku: clip(input.sku, 80) || null,
    condition: clip(input.condition, 120) || null,
    price: intOrNull(input.price),
    stock: intOrNull(input.stock),
  })
  if (error) return { ok: false, error: 'insert_failed' }
  return fetchParts()
}

export async function updatePart(input: { id: string; title?: string; model?: string; sku?: string; condition?: string; price?: any; stock?: any; website_url?: string; social_url?: string; fitment_note?: string; inquiry_note?: string }): Promise<PartsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const patch: any = { updated_at: new Date().toISOString() }
  if (input.title != null) patch.title = clip(input.title, 200)
  if (input.model != null) patch.model = clip(input.model, 40) || null
  if (input.sku != null) patch.sku = clip(input.sku, 80) || null
  if (input.condition != null) patch.condition = clip(input.condition, 120) || null
  if (input.price !== undefined) patch.price = intOrNull(input.price)
  if (input.stock !== undefined) patch.stock = intOrNull(input.stock)
  if (input.website_url != null) patch.website_url = clip(input.website_url, 500) || null
  if (input.social_url != null) patch.social_url = clip(input.social_url, 500) || null
  if (input.fitment_note != null) patch.fitment_note = clip(input.fitment_note, 500) || null
  if (input.inquiry_note != null) patch.inquiry_note = clip(input.inquiry_note, 500) || null
  const { error } = await svc().from('ops_parts_pipeline').update(patch).eq('id', input.id)
  if (error) return { ok: false, error: 'update_failed' }
  return fetchParts()
}

export async function setPartStatus(id: string, status: string): Promise<PartsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  if (!STATUSES.includes(status)) return { ok: false, error: 'bad_status' }
  const { error } = await svc().from('ops_parts_pipeline').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, error: 'update_failed' }
  return fetchParts()
}

export async function deletePart(id: string): Promise<PartsData> {
  if (!(await authed())) return { ok: false, error: 'unauthorized' }
  const { error } = await svc().from('ops_parts_pipeline').delete().eq('id', id)
  if (error) return { ok: false, error: 'delete_failed' }
  return fetchParts()
}
