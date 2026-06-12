// app/ops-x7k2m9/leads/page.tsx
// admin: ดู lead จากปุ่มติดต่อเรา + เปลี่ยนสถานะ — ป้องกันด้วย admin secret cookie (env ADMIN_OPS_SECRET)
// ใช้ cookie/secret ชุดเดียวกับ /ops-x7k2m9/orders (login ครั้งเดียวใช้ได้ทั้งสองหน้า)
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { TOPIC_TH, SOURCE_TH, LEAD_STATUS } from '@/lib/contact-config'

export const dynamic = 'force-dynamic'

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

async function loginOps(formData: FormData) {
  'use server'
  const pw = String(formData.get('password') || '')
  const secret = process.env.ADMIN_OPS_SECRET
  if (secret && pw === secret) {
    (await cookies()).set(COOKIE, secret, { httpOnly: true, secure: true, sameSite: 'lax', path: '/ops-x7k2m9', maxAge: 60 * 60 * 24 * 30 })
  }
  revalidatePath('/ops-x7k2m9/leads')
}

// ---- helpers (อยู่บนไฟล์) ----
const STATUS_VALUES = LEAD_STATUS.map((s) => s.value) // whitelist สถานะที่อนุญาต
const STATUS_TH: Record<string, string> = Object.fromEntries(LEAD_STATUS.map((s) => [s.value, s.label]))
const STATUS_CLS: Record<string, string> = {
  new: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted: 'bg-blue-50 text-blue-700 border-blue-200',
  waiting: 'bg-purple-50 text-purple-700 border-purple-200',
  won: 'bg-green-50 text-green-700 border-green-200',
  lost: 'bg-gray-100 text-gray-500 border-gray-200',
}

// label(map, value) → ถ้า value ไม่มี/ไม่อยู่ใน map คืน "ไม่ระบุ"
const label = (map: Record<string, string>, v: unknown): string =>
  (typeof v === 'string' && map[v]) ? map[v] : 'ไม่ระบุ'

// className สำหรับ quick action + ข้อความยาว
const quick = 'underline decoration-dotted underline-offset-2 hover:text-[#C9A961]'
const longText = 'break-words whitespace-pre-wrap'

// server action เปลี่ยนสถานะ — validate ฝั่ง server: authed() + id + whitelist
async function setStatus(formData: FormData) {
  'use server'
  if (!(await authed())) return
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')
  if (!id) return
  if (!STATUS_VALUES.includes(status)) return
  await svc().from('leads').update({ status }).eq('id', id)
  revalidatePath('/ops-x7k2m9/leads')
}

export default async function LeadsPage() {
  if (!(await authed())) {
    return (
      <section className="container mx-auto px-4 py-20 max-w-sm">
        <h1 className="text-xl font-serif font-medium text-gray-900 mb-1">Admin · Leads</h1>
        <p className="text-sm text-gray-500 mb-6">ใส่รหัสแอดมินเพื่อเข้าดูรายชื่อติดต่อ</p>
        <form action={loginOps} className="space-y-3">
          <input type="password" name="password" placeholder="Admin secret" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none" />
          <button type="submit" className="w-full bg-[#1C1D2C] text-white text-sm font-medium px-4 py-2.5 rounded">เข้าสู่ระบบ</button>
        </form>
        {!process.env.ADMIN_OPS_SECRET && (
          <p className="text-[11px] text-red-600 mt-4">ยังไม่ได้ตั้ง env ADMIN_OPS_SECRET — ตั้งใน Vercel ก่อนใช้งาน</p>
        )}
      </section>
    )
  }

  const supa = svc()
  const { data, error } = await supa.from('leads').select('*').order('created_at', { ascending: false }).limit(300)
  const leads = data ?? []
  const newCount = leads.filter((l) => l.status === 'new').length
  const fmt = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
      <p className="text-[10px] tracking-[0.32em] text-[#8B7355] font-serif mb-1">ADMIN · LEADS</p>
      <div className="flex items-end justify-between gap-3 mb-1">
        <h1 className="text-2xl md:text-3xl font-serif font-medium text-gray-900">รายชื่อติดต่อกลับ</h1>
        <a href="/ops-x7k2m9/leads/export" className="text-xs border border-gray-300 rounded px-3 py-1.5 text-gray-600 hover:bg-gray-50">⬇ Export CSV</a>
      </div>
      <p className="text-sm text-gray-500 mb-8">ใหม่ <strong className="text-amber-700">{newCount}</strong> · ทั้งหมด {leads.length}</p>

      {error ? (
        // 1) query error → แสดง error state เท่านั้น (ไม่โชว์ empty state)
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">ดึงข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</div>
      ) : leads.length === 0 ? (
        <div className="border border-gray-200 bg-gray-50 p-10 text-center text-gray-400">ยังไม่มีรายการติดต่อ</div>
      ) : (
        <div className="space-y-4">
          {leads.map((l) => (
            <div key={l.id} className="border border-gray-200 rounded-lg bg-white p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-gray-900">#{String(l.id).slice(0, 8).toUpperCase()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_CLS[l.status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>{label(STATUS_TH, l.status)}</span>
                  <span className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-600">{label(TOPIC_TH, l.topic)}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-gray-50 text-gray-500">มาจาก: {label(SOURCE_TH, l.source)}</span>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(l.created_at)}</span>
              </div>

              <div className="text-sm text-gray-700 space-y-0.5">
                {l.name && <div><span className="text-gray-400">ชื่อ:</span> <strong className="text-gray-900 break-words">{l.name}</strong></div>}
                {/* 4) quick action แบบข้อความล้วน (premium/classic) */}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  {l.phone && <a href={`tel:${l.phone}`} className={quick}>โทร {l.phone}</a>}
                  {l.line_id && <a href={`https://line.me/R/ti/p/~${encodeURIComponent(l.line_id)}`} target="_blank" rel="noopener noreferrer" className={quick}>LINE {l.line_id}</a>}
                  {l.email && <a href={`mailto:${l.email}`} className={`${quick} break-all`}>Email {l.email}</a>}
                </div>
                {(l.car_model || l.part_number) && (
                  <div className="flex flex-wrap gap-x-4">
                    {l.car_model && <span><span className="text-gray-400">รุ่น:</span> {l.car_model}</span>}
                    {l.part_number && <span className="break-words"><span className="text-gray-400">Part:</span> {l.part_number}</span>}
                  </div>
                )}
                {/* 5) ข้อความยาว → break-words + whitespace-pre-wrap */}
                {l.budget && <div className={`text-gray-600 ${longText}`}><span className="text-gray-400">งบ/รายละเอียดสินค้า:</span> {l.budget}</div>}
                {l.detail && <div className={`text-gray-600 ${longText}`}>{l.detail}</div>}
                {l.callback_time && <div className={`text-xs text-gray-500 ${longText}`}>สะดวกให้ติดต่อ: {l.callback_time}</div>}
              </div>

              <form action={setStatus} className="flex items-center gap-2 mt-3 border-t border-gray-100 pt-3">
                <input type="hidden" name="id" value={l.id} />
                <select name="status" defaultValue={STATUS_VALUES.includes(l.status) ? l.status : 'new'} className="border border-gray-300 rounded px-2 py-1.5 text-xs">
                  {LEAD_STATUS.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
                <button type="submit" className="bg-[#1C1D2C] text-white text-xs font-medium px-3 py-1.5 rounded">อัปเดตสถานะ</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
