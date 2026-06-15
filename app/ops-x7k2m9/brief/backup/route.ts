// app/ops-x7k2m9/brief/backup/route.ts
// OpsBrief Private — backup endpoint (อ่านอย่างเดียว) คืน Markdown ห่อใน HTML
// ใช้โดย scheduled task ผ่าน web_fetch (GET เท่านั้น แนบ header ไม่ได้ จึงใช้ token ใน query)
// ป้องกันด้วย env OPS_BACKUP_TOKEN — fail-closed ถ้าไม่ตั้ง env
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

function buildMarkdown(items: any[], decisions: any[]): string {
  const live = items.filter((i) => !i.archived)
  const dec = decisions.filter((x) => !x.archived)
  const today = new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })
  const MOD: Record<string, string> = { dev: 'Dev Control', social: 'Social Control', ebook: 'eBook Sales Control', parts: 'Premium Parts Control', tools: 'Future Tools Pipeline' }
  const ST: Record<string, string> = { todo: 'รอทำ', doing: 'กำลังทำ', waiting: 'รอข้อมูล', done: 'เสร็จ' }
  const line = (i: any) => `- [${ST[i.status] || i.status}] ${i.title}${i.detail ? ` — ${i.detail}` : ''}`

  let md = `# OpsBrief Private — Daily Export\n\n_วันที่: ${today}_\n`

  const important = live.filter((i) => i.priority === 'high' && i.status !== 'done')
  md += `\n## ⭐ งานสำคัญวันนี้\n${important.length ? important.map(line).join('\n') : '- (ไม่มี)'}`

  for (const m of ['dev', 'social', 'ebook', 'parts', 'tools']) {
    const rows = live.filter((i) => i.module === m)
    md += `\n\n## ${MOD[m]}\n${rows.length ? rows.map(line).join('\n') : '- (ว่าง)'}`
  }

  md += `\n\n## 🧭 Decision Log\n${
    dec.length
      ? dec.map((x) => `- **${x.topic}** — ${x.reason || '-'}${x.next_action ? ` · ถัดไป: ${x.next_action}` : ''}${x.follow_up_date ? ` · ตามผล: ${x.follow_up_date}` : ''} _(${x.decided_on})_`).join('\n')
      : '- (ไม่มี)'
  }`

  const tmr = live.filter((i) => i.status !== 'done')
  md += `\n\n## 📌 งานที่ต้องทำต่อ (พรุ่งนี้)\n${tmr.length ? tmr.map(line).join('\n') : '- (ไม่มี)'}\n`
  return md
}

export async function GET(req: NextRequest) {
  const token = process.env.OPS_BACKUP_TOKEN
  if (!token) return new NextResponse('backup_disabled: ยังไม่ได้ตั้ง env OPS_BACKUP_TOKEN', { status: 503 })
  const given = req.nextUrl.searchParams.get('key')
  if (given !== token) return new NextResponse('unauthorized', { status: 401 })

  try {
    const supa = svc()
    const [it, dc] = await Promise.all([
      supa.from('ops_items').select('*').order('created_at', { ascending: true }),
      supa.from('ops_decisions').select('*').order('decided_on', { ascending: false }),
    ])
    if (it.error || dc.error) {
      return new NextResponse('# OpsBrief backup error\nfetch_failed', { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }
    const md = buildMarkdown(it.data ?? [], dc.data ?? [])
    // ห่อใน HTML doc จริง + <pre> เพื่อให้ web_fetch (scheduled backup) ดึงเนื้อหาได้
    const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>OpsBrief Backup</title></head><body><pre>${esc}</pre></body></html>`
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (e) {
    return new NextResponse(`# OpsBrief backup error\n${(e as Error)?.message || 'unknown'}`, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}
