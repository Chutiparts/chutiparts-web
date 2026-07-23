// qa-parse.ts — smoke test Phase 2 (Parse) กับบิลจริง (ไฟล์ชั่วคราว ลบหลังรัน)
// รัน: npx tsx --env-file=.env.local qa-parse.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { intakeFile } from './lib/docbrief-intake'
import { extractDocument } from './lib/docbrief-extract'

const BILLS = '/Users/easy/Desktop/CODE/บิล'
const TAG = 'QAPARSE-'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

const mimeOf = (n: string) =>
  n.toLowerCase().endsWith('.pdf') ? 'application/pdf'
  : n.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

const money = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2 })

async function run() {
  const files = readdirSync(BILLS).filter((f) => /\.(pdf|png|jpe?g)$/i.test(f)).sort()
  console.log(`\nพบไฟล์ ${files.length} ใบ\n${'='.repeat(60)}`)

  const ids: string[] = []
  for (const name of files) {
    const buffer = readFileSync(`${BILLS}/${name}`)
    const r = await intakeFile(db, { name: TAG + name, type: mimeOf(name), buffer }, 'qa-parse')
    console.log(`[intake] ${name} → ${r.status}${r.status === 'rejected' ? ` (${r.message})` : ''}`)
    if (r.status === 'queued') ids.push(r.id)
  }

  console.log(`\nเริ่ม extraction ${ids.length} ใบ (เรียก Claude จริง)\n${'='.repeat(60)}`)
  for (const id of ids) {
    const t = Date.now()
    const r = await extractDocument(db, id, 'qa-parse')
    const secs = ((Date.now() - t) / 1000).toFixed(1)
    if (!r.ok) { console.log(`❌ ${id.slice(0, 8)} → ${r.errorCategory}: ${r.message}`); continue }
    console.log(`✅ ${id.slice(0, 8)} → สำเร็จ (${secs}s, ${r.costThb?.toFixed(3)} บาท)`)
  }

  console.log(`\nผลที่ดึงได้\n${'='.repeat(60)}`)
  const { data: rows } = await db.from('doc_documents')
    .select('id, original_filename, state, vendor_name, vendor_tax_id, doc_no, doc_date, subtotal, vat, grand_total, currency, confidence, error_message, raw_extraction')
    .like('original_filename', `${TAG}%`).order('created_at')

  for (const d of rows || []) {
    console.log(`\n📄 ${d.original_filename.replace(TAG, '')}  [${d.state}]`)
    if (d.error_message) { console.log(`   error: ${d.error_message}`); continue }
    console.log(`   ผู้ขาย      : ${d.vendor_name ?? '(null)'}`)
    console.log(`   เลขภาษี     : ${d.vendor_tax_id ?? '(null)'}`)
    console.log(`   เลขที่เอกสาร: ${d.doc_no ?? '(null)'}`)
    console.log(`   วันที่       : ${d.doc_date ?? '(null)'}   [ดิบ: ${(d.raw_extraction as Record<string, unknown>)?.doc_date_raw ?? '—'}]`)
    console.log(`   ก่อน VAT    : ${money(d.subtotal)}`)
    console.log(`   VAT         : ${money(d.vat)}`)
    console.log(`   ยอดสุทธิ    : ${money(d.grand_total)} ${d.currency ?? ''}`)
    const conf = (d.confidence || {}) as Record<string, number>
    const low = Object.entries(conf).filter(([, v]) => v < 0.85)
    console.log(`   confidence  : ${Object.entries(conf).map(([k, v]) => `${k}=${v}`).join(' ') || '—'}`)
    if (low.length) console.log(`   ⚠️ ต่ำกว่า 0.85: ${low.map(([k]) => k).join(', ')}`)
    const notes = (d.raw_extraction as Record<string, unknown>)?.notes
    if (notes) console.log(`   หมายเหตุโมเดล: ${notes}`)
  }

  console.log(`\nต้นทุน / metrics\n${'='.repeat(60)}`)
  const { data: metrics } = await db.from('doc_metrics')
    .select('document_id, model, input_tokens, output_tokens, cost_thb, latency_ms')
    .in('document_id', (rows || []).map((r) => r.id))
  let total = 0
  for (const m of metrics || []) {
    total += Number(m.cost_thb)
    console.log(`  ${m.document_id.slice(0, 8)} · in ${m.input_tokens} / out ${m.output_tokens} tok · ${Number(m.cost_thb).toFixed(3)} บาท · ${(m.latency_ms / 1000).toFixed(1)}s`)
  }
  const n = (metrics || []).length
  console.log(`\n  รวม ${total.toFixed(3)} บาท · เฉลี่ย ${n ? (total / n).toFixed(3) : '0'} บาท/ใบ  (soft cap 2.00)`)
  console.log(`\n(ข้อมูลทดสอบยังอยู่ใน DB — ดูได้ที่ /ops-x7k2m9/documents · บอกผมถ้าจะลบ)\n`)
}

run().catch((e) => { console.error('ERROR:', e); process.exit(1) })
