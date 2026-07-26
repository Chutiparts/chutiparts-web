// app/ops-x7k2m9/garages/page.tsx — Admin: อู่เบนซ์ทั่วไทย (import + review + publish)
// spec §Data pipeline ขั้น 2-3-5 + §เกณฑ์ review มือ · human gate ก่อน publish
// auth: owner cookie (opsAuthed) · เขียน DB ผ่าน service-role (svc)
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { opsAuthed } from '@/lib/ops-auth'
import OpsGate from '@/components/OpsGate'
import { normalizeApify, dedupeBatch, findDuplicate, type ExistingKey, type RawApify } from '@/lib/garage-import'

export const dynamic = 'force-dynamic'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

const STATUSES = ['raw', 'cleaned', 'reviewed', 'published', 'rejected'] as const
const REJECT_REASONS = ['duplicate', 'not_benz_specialist', 'missing_contact', 'unclear_name', 'other']

// ---- server actions ----
async function importJson(formData: FormData) {
  'use server'
  if (!(await opsAuthed())) return
  const text = String(formData.get('json') || '').trim()
  const label = String(formData.get('label') || '').trim() || null
  if (!text) return
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { redirect('/ops-x7k2m9/garages?err=json'); }
  // รองรับ array ตรง ๆ หรือ {items:[]} / {data:[]}
  const arr: RawApify[] = Array.isArray(parsed)
    ? (parsed as RawApify[])
    : ((parsed as Record<string, unknown>)?.items as RawApify[]) || ((parsed as Record<string, unknown>)?.data as RawApify[]) || []
  if (!arr.length) redirect('/ops-x7k2m9/garages?err=empty')

  const db = svc()
  // 1) เก็บ snapshot ดิบก่อนเสมอ (audit-first)
  await db.from('garage_snapshots').insert({
    source_name: 'manual-paste', query_label: label, source_payload_json: arr,
  })

  // 2) normalize + dedupe ภายในชุด
  const rows = dedupeBatch(arr.map(normalizeApify).filter((r) => r.name_th))

  // 3) dedupe กับของเดิมใน DB → insert ใหม่ / อัปเดต last_seen ของเดิม
  const { data: existing } = await db.from('garages').select('id, place_id, normalized_name, phone')
  const keys = (existing || []) as ExistingKey[]
  const now = new Date().toISOString()
  let inserted = 0, updated = 0
  for (const r of rows) {
    const dupId = findDuplicate(r, keys)
    if (dupId) {
      await db.from('garages').update({ last_seen_at: now, source_last_checked_at: now }).eq('id', dupId)
      updated++
    } else {
      const { error } = await db.from('garages').insert({ ...r, last_seen_at: now, source_last_checked_at: now })
      if (!error) { inserted++; keys.push({ id: 'new', place_id: r.place_id, normalized_name: r.normalized_name, phone: r.phone }) }
    }
  }
  revalidatePath('/ops-x7k2m9/garages')
  redirect(`/ops-x7k2m9/garages?imported=${inserted}&updated=${updated}&status=cleaned`)
}

async function setStatus(formData: FormData) {
  'use server'
  if (!(await opsAuthed())) return
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) return
  const patch: Record<string, unknown> = { status }
  if (status === 'rejected') patch.reject_reason = String(formData.get('reason') || 'other')
  else patch.reject_reason = null
  await svc().from('garages').update(patch).eq('id', id)
  revalidatePath('/ops-x7k2m9/garages')
}

async function removeGarage(formData: FormData) {
  'use server'
  if (!(await opsAuthed())) return
  const id = String(formData.get('id') || '')
  if (!id) return
  await svc().from('garages').delete().eq('id', id)
  revalidatePath('/ops-x7k2m9/garages')
}

type G = {
  id: string; name_th: string; slug: string | null; province: string | null; district: string | null
  phone: string | null; website: string | null; maps_url: string | null; rating: number | null
  review_count: number | null; status: string; reject_reason: string | null; classification: string | null
  needs_manual_review: boolean; source: string | null; last_seen_at: string | null
}

const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }
const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({ background: bg, color: fg, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' })
const STATUS_TH: Record<string, string> = { raw: 'ดิบ', cleaned: 'ล้างแล้ว', reviewed: 'ตรวจแล้ว', published: 'เผยแพร่', rejected: 'ตัดทิ้ง' }
const STATUS_COLOR: Record<string, string> = { raw: '#6b7280', cleaned: '#2563eb', reviewed: '#8a5a12', published: '#166534', rejected: '#a32d2d' }

export default async function GaragesAdmin({ searchParams }: { searchParams: Promise<{ status?: string; imported?: string; updated?: string; err?: string; q?: string }> }) {
  if (!(await opsAuthed())) return <OpsGate title="🔧 อู่เบนซ์ทั่วไทย (แอดมิน)" />
  const sp = await searchParams
  const filter = sp.status && STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? sp.status : 'cleaned'
  const q = (sp.q || '').trim().replace(/[%,()]/g, '')  // sanitize ให้ ilike ปลอดภัย

  const db = svc()
  let listQ = db.from('garages').select('*').eq('status', filter)
  if (q) listQ = listQ.or(`name_th.ilike.%${q}%,province.ilike.%${q}%,slug.ilike.%${q}%`)
  const [{ data: listData }, { data: allData }] = await Promise.all([
    listQ.order('last_seen_at', { ascending: false, nullsFirst: false }).limit(200),
    db.from('garages').select('status'),
  ])
  const list = (listData || []) as G[]
  const counts: Record<string, number> = {}
  for (const r of (allData || []) as { status: string }[]) counts[r.status] = (counts[r.status] || 0) + 1

  return (
    <section style={{ maxWidth: 980, margin: '0 auto', padding: '20px 16px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.2em', color: '#8B7355', marginBottom: 2 }}>CHUTIBENZ · ADMIN</p>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🔧 อู่เบนซ์ทั่วไทย — นำเข้า & ตรวจ</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        วางผลลัพธ์ Apify (JSON) → ระบบ normalize + dedupe → ตรวจแล้วกด <b>เผยแพร่</b> · เฉพาะ “เผยแพร่” เท่านั้นที่ขึ้นเว็บสาธารณะ
      </p>

      {sp.imported != null && (
        <div style={{ ...box, background: '#e7f2ec', borderColor: '#c7e2d3', color: '#166534' }}>
          ✓ นำเข้าเสร็จ: เพิ่มใหม่ <b>{sp.imported}</b> · อัปเดตของเดิม <b>{sp.updated}</b> อู่ (สถานะ “ล้างแล้ว” รอตรวจ)
        </div>
      )}
      {sp.err && (
        <div style={{ ...box, background: '#fcebeb', borderColor: '#f0cccc', color: '#a32d2d' }}>
          {sp.err === 'json' ? 'JSON ไม่ถูกต้อง — ตรวจรูปแบบอีกครั้ง' : 'ไม่พบรายการในไฟล์ (ต้องเป็น array ของร้าน)'}
        </div>
      )}

      {/* Import */}
      <form action={importJson} style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>📥 นำเข้าจาก Apify (วาง JSON)</h2>
        <input name="label" placeholder="ป้ายกำกับ (เช่น อู่เบนซ์ + กรุงเทพ)" style={{ width: '100%', padding: 9, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 8 }} />
        <textarea name="json" rows={6} placeholder='วาง JSON array จาก Apify dataset ที่นี่ เช่น [{"title":"...","address":"...","phone":"...","placeId":"..."}]'
          style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12.5, fontFamily: 'monospace' }} />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: '#9ca3af' }}>เก็บ raw ลง snapshots อัตโนมัติ (audit) · dedupe ด้วย place_id</span>
          <button type="submit" style={btn('#123a5e')}>นำเข้า + ประมวลผล</button>
        </div>
      </form>

      {/* ค้นหา */}
      <form method="get" action="/ops-x7k2m9/garages" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input type="hidden" name="status" value={filter} />
        <input name="q" defaultValue={q} placeholder="🔎 ค้นหาชื่ออู่ / จังหวัด / slug (เช่น ฮีโน่, บางกะปิ)"
          style={{ flex: 1, padding: 9, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
        <button style={btn('#123a5e')}>ค้นหา</button>
        {q && <a href={`/ops-x7k2m9/garages?status=${filter}`} style={{ ...btn('#fff', '#374151'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>ล้าง</a>}
      </form>

      {/* status filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {STATUSES.map((st) => (
          <Link key={st} href={`/ops-x7k2m9/garages?status=${st}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            style={{ textDecoration: 'none', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              background: filter === st ? STATUS_COLOR[st] : '#fff', color: filter === st ? '#fff' : '#374151', border: '1px solid #e5e7eb' }}>
            {STATUS_TH[st]} ({counts[st] || 0})
          </Link>
        ))}
      </div>

      {q && <p style={{ fontSize: 12.5, color: '#6b7280', margin: '0 0 10px' }}>🔎 ผลค้นหา “{q}” ในสถานะ {STATUS_TH[filter]} — พบ {list.length} อู่</p>}

      {/* list */}
      {list.length === 0 ? (
        <div style={{ ...box, textAlign: 'center', color: '#9ca3af' }}>— ไม่มีอู่ในสถานะนี้ —</div>
      ) : (
        list.map((g) => (
          <div key={g.id} style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {g.name_th}{' '}
                  {g.needs_manual_review && <span style={{ fontSize: 11, background: '#fbf1de', color: '#8a5a12', padding: '1px 7px', borderRadius: 10 }}>⚠ ต้องตรวจ</span>}
                </div>
                <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2 }}>
                  📍 {g.province || '—'}{g.district && g.district !== '-' ? `, ${g.district}` : ''}
                  {g.phone ? ` · 📞 ${g.phone}` : ' · ไม่มีเบอร์'}
                  {g.rating ? ` · ★ ${g.rating} (${g.review_count || 0})` : ''}
                </div>
                <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2 }}>
                  slug: {g.slug || '—'} · source: {g.source || '—'}
                  {g.maps_url && <> · <a href={g.maps_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Maps</a></>}
                  {g.status === 'published' && g.slug && <> · <a href={`/garage/${g.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#166534' }}>ดูหน้าเว็บ ↗</a></>}
                </div>
              </div>
              <span style={{ height: 'fit-content', fontSize: 12, fontWeight: 700, color: STATUS_COLOR[g.status], background: `${STATUS_COLOR[g.status]}18`, padding: '3px 10px', borderRadius: 20 }}>
                {STATUS_TH[g.status]}{g.reject_reason ? ` · ${g.reject_reason}` : ''}
              </span>
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {g.status !== 'published' && (
                <form action={setStatus}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="status" value="published" /><button style={btn('#166534')}>✓ เผยแพร่</button></form>
              )}
              {g.status !== 'reviewed' && g.status !== 'published' && (
                <form action={setStatus}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="status" value="reviewed" /><button style={btn('#8a5a12')}>ตรวจแล้ว</button></form>
              )}
              {g.status === 'published' && (
                <form action={setStatus}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="status" value="reviewed" /><button style={btn('#fff', '#374151')}>↩ ถอนออกจากเว็บ</button></form>
              )}
              <form action={setStatus} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="hidden" name="id" value={g.id} /><input type="hidden" name="status" value="rejected" />
                <select name="reason" style={{ fontSize: 12, padding: '5px 6px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                  {REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button style={btn('#a32d2d')}>ตัดทิ้ง</button>
              </form>
              <form action={removeGarage} style={{ marginLeft: 'auto' }}><input type="hidden" name="id" value={g.id} /><button style={btn('#fff', '#9ca3af')}>ลบถาวร</button></form>
            </div>
          </div>
        ))
      )}
    </section>
  )
}
