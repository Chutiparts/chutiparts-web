// app/ops-x7k2m9/businesses/page.tsx — คิวอนุมัติอู่/ร้านที่ส่งเข้ามา
// 2026-06-15: Joey ดูคิว → อนุมัติ (copy ขึ้น businesses) / ปฏิเสธ
// auth: ใช้ cookie ADMIN_OPS_SECRET เหมือนหน้า /ops-x7k2m9/leads
// ⚠️ ตอน review: ยืนยัน (1) วิธี auth ให้ตรงกับหน้า leads (2) คอลัมน์จริงของตาราง businesses
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { SubmitButton } from './SubmitButton'

export const dynamic = 'force-dynamic'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

// slug จากชื่อ (ไทย→คงไว้, ช่องว่าง→-, ตัด char แปลก)
function toSlug(name: string) {
  const base = name.trim().toLowerCase().replace(/[^฀-๿a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return (base || 'shop') + '-' + Math.random().toString(36).slice(2, 6)
}

// ---- server actions ----
async function approve(formData: FormData) {
  'use server'
  if ((await cookies()).get('ops_admin')?.value !== process.env.ADMIN_OPS_SECRET) return
  const id = String(formData.get('id') || '')
  const supa = svc()
  const { data: sub } = await supa.from('business_submissions').select('*').eq('id', id).single()
  if (!sub) return
  if (sub.status !== 'pending') return  // กันกดซ้ำ/กดย้อน — อนุมัติได้ครั้งเดียว ป้องกัน insert ซ้ำ
  // copy ขึ้น businesses (verified=false — Joey ค่อยกด verify ทีหลังถ้าตรวจร้านแล้ว)
  // คอลัมน์ map ตรง schema จริงแล้ว: specialties (งานที่ถนัด), facebook_url (เว็บ/FB)
  const { error: insErr } = await supa.from('businesses').insert({
    slug: toSlug(sub.name), name: sub.name, type: sub.type, province: sub.province,
    address: sub.address, google_maps_url: sub.google_maps_url, lat: sub.lat, lng: sub.lng,
    phone: sub.phone, line_id: sub.line_id, facebook_url: sub.website,
    models_expertise: sub.models_expertise, specialties: sub.services,
    description: sub.description, cover_image: sub.cover_image, verified: false,
  })
  // ถ้า insert ไม่ผ่าน (เช่นชน constraint / type 'both' ไม่ถูกรับ) — อย่ามาร์ค approved
  // คาไว้ pending + บันทึกสาเหตุใน reviewed_by_note ให้เห็นว่าทำไมไม่ขึ้น (กันข้อมูลหายเงียบ)
  if (insErr) {
    await supa.from('business_submissions')
      .update({ reviewed_by_note: 'approve_failed: ' + insErr.message, updated_at: new Date().toISOString() })
      .eq('id', id)
    revalidatePath('/ops-x7k2m9/businesses')
    return
  }
  await supa.from('business_submissions').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/ops-x7k2m9/businesses')
}

async function reject(formData: FormData) {
  'use server'
  if ((await cookies()).get('ops_admin')?.value !== process.env.ADMIN_OPS_SECRET) return
  const id = String(formData.get('id') || '')
  await svc().from('business_submissions').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/ops-x7k2m9/businesses')
}

async function login(formData: FormData) {
  'use server'
  // ใช้มาตรฐานเดียวกับ /ops-x7k2m9/leads + /orders → login ที่เดียวใช้ได้ทุกหน้า
  const pw = String(formData.get('password') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    (await cookies()).set('ops_admin', secret, { httpOnly: true, secure: true, sameSite: 'lax', path: '/ops-x7k2m9', maxAge: 60 * 60 * 24 * 30 })
  }
}

export default async function OpsBusinessesPage() {
  const authed = (await cookies()).get('ops_admin')?.value === process.env.ADMIN_OPS_SECRET
  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20">
        <h1 className="text-xl font-bold mb-4">Ops · อู่/ร้าน รออนุมัติ</h1>
        <form action={login} className="space-y-3">
          <input name="password" type="password" placeholder="Admin secret" className="w-full border border-gray-300 rounded px-3 py-2.5" />
          <button type="submit" className="w-full bg-[#1C1D2C] text-white text-sm font-medium px-4 py-2.5 rounded">เข้าสู่ระบบ</button>
        </form>
      </div>
    )
  }

  const { data: subs } = await svc()
    .from('business_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: true })
  const rows = subs ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">อู่/ร้าน รออนุมัติ</h1>
      <p className="text-sm text-gray-500 mb-6">{rows.length} รายการ · กดอนุมัติ = ขึ้นแสดงในไดเรกทอรี (verified=ยัง)</p>

      {rows.length === 0 && <p className="text-gray-400">ไม่มีรายการรออนุมัติ</p>}

      <div className="space-y-4">
        {rows.map((b: any) => (
          <div key={b.id} className="border border-gray-200 rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">{b.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {b.type === 'garage' ? '🔨 อู่' : b.type === 'parts_shop' ? '🛒 ร้านอะไหล่' : '🔨🛒 ทั้งคู่'}
                  {b.province && ` · 📍 ${b.province}`}
                </p>
              </div>
              <span className="text-[10px] text-gray-400">#{String(b.id).slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="text-sm text-gray-700 mt-2 space-y-1">
              {b.address && <p>🏠 {b.address}</p>}
              {b.google_maps_url && <p>📍 <a href={b.google_maps_url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{b.google_maps_url}</a></p>}
              {(b.phone || b.line_id) && <p>📞 {b.phone || '-'} · 💬 {b.line_id || '-'}</p>}
              {b.website && <p>🌐 {b.website}</p>}
              {b.models_expertise?.length > 0 && <p>🚗 {b.models_expertise.join(', ')}</p>}
              {b.services?.length > 0 && <p>🔧 {b.services.join(', ')}</p>}
              {b.description && <p className="text-gray-600">{b.description}</p>}
              {b.reviewed_by_note && <p className="text-red-600 text-xs font-medium">⚠️ {b.reviewed_by_note}</p>}
            </div>
            <div className="flex gap-2 mt-3 border-t border-gray-100 pt-3">
              <form action={approve}><input type="hidden" name="id" value={b.id} />
                <SubmitButton pendingText="กำลังอนุมัติ…" className="bg-green-600 text-white text-sm font-medium px-4 py-1.5 rounded">✓ อนุมัติ</SubmitButton></form>
              <form action={reject}><input type="hidden" name="id" value={b.id} />
                <SubmitButton pendingText="กำลังลบ…" className="bg-gray-200 text-gray-700 text-sm px-4 py-1.5 rounded">✕ ปฏิเสธ</SubmitButton></form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
