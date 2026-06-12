// app/api/orders/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ITEMS = 100
const MAX_QTY = 999
const MAX_CONTACT_LEN = 150
const MAX_NAME_LEN = 150
const MAX_ITEM_NAME_LEN = 200
const MAX_NOTE_LEN = 1000

type InItem = { id?: unknown; code?: unknown; name?: unknown; price?: unknown; qty?: unknown }

function cleanId(v: unknown): string | number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') return v.slice(0, 64)
  return null
}
function cleanPrice(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function POST(req: NextRequest) {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ ok: false, error: 'server_misconfig' }, { status: 500 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }) }

  if (typeof body?.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: false, error: 'spam_detected' }, { status: 400 })
  }

  const contact = typeof body?.customer_contact === 'string' ? body.customer_contact.trim() : ''
  if (!contact) return NextResponse.json({ ok: false, error: 'missing_contact' }, { status: 400 })
  if (contact.length > MAX_CONTACT_LEN) return NextResponse.json({ ok: false, error: 'invalid_contact' }, { status: 400 })

  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  if (note.length > MAX_NOTE_LEN) return NextResponse.json({ ok: false, error: 'invalid_note' }, { status: 400 })

  const customerNameRaw = typeof body?.customer_name === 'string' ? body.customer_name.trim() : ''
  const customerName = customerNameRaw ? customerNameRaw.slice(0, MAX_NAME_LEN) : null

  const rawItems: InItem[] = Array.isArray(body?.items) ? body.items : []
  if (rawItems.length === 0) return NextResponse.json({ ok: false, error: 'empty_cart' }, { status: 400 })
  if (rawItems.length > MAX_ITEMS) return NextResponse.json({ ok: false, error: 'too_many_items' }, { status: 400 })

  const items = rawItems
    .map((x) => {
      if (!x || typeof x !== 'object') return null
      const item = x as InItem
      const name = typeof item.name === 'string' ? item.name.trim().slice(0, MAX_ITEM_NAME_LEN) : ''
      if (!name) return null
      return {
        id: cleanId(item.id),
        code: typeof item.code === 'string' ? item.code.slice(0, 64) : null,
        name,
        price: cleanPrice(item.price),
        qty: Math.max(1, Math.min(MAX_QTY, Math.trunc(Number(item.qty) || 1))),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (items.length === 0) return NextResponse.json({ ok: false, error: 'invalid_items' }, { status: 400 })

  const item_count = items.reduce((s, x) => s + x.qty, 0)
  const subtotal = items.reduce((s, x) => s + (x.price ?? 0) * x.qty, 0)
  const has_tbc = items.some((x) => x.price == null)
  const sourceRaw = typeof body?.source === 'string' ? body.source.trim() : ''
  const source = (sourceRaw || 'web_cart').slice(0, 50)

  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } })
  const { data, error } = await supa.from('orders').insert({
    status: 'pending', items, item_count, subtotal, has_tbc,
    customer_name: customerName, customer_contact: contact, note: note || null, source,
  }).select('id').single()

  if (error || !data) {
    console.error('[orders] insert failed:', error)
    return NextResponse.json({ ok: false, error: 'order_insert_failed' }, { status: 500 })
  }
  const ref = String(data.id).slice(0, 8).toUpperCase()
  return NextResponse.json({ ok: true, id: data.id, ref, message: 'received' })
}
