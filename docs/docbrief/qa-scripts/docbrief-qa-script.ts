// qa-docbrief.ts — QA อัตโนมัติสำหรับ docbrief intake (ไฟล์ชั่วคราว ลบทิ้งหลังรัน)
// รัน: npx tsx --env-file=.env.local qa-docbrief.ts
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { intakeFile, DOC_BUCKET } from './lib/docbrief-intake'

const FIXTURES = '/private/tmp/claude-501/-Users-easy-Desktop-CODE/e0ff6aec-894a-4710-a1dc-facb55f6089e/scratchpad/fixtures'
const TAG = 'QATEST-'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain',
}
const mimeOf = (n: string) => MIME[n.slice(n.lastIndexOf('.'))] || 'application/octet-stream'

// ผลที่คาดหวังตามสเปก §11 / §4.6
const EXPECT: Record<string, { status: string; pages?: number; msg?: RegExp }> = {
  '01-ok-1page.pdf': { status: 'queued', pages: 1 },
  '02-ok-3page.pdf': { status: 'queued', pages: 3 },
  '03-toomany-6page.pdf': { status: 'rejected', msg: /หน้าเกิน/ },
  '04-ok.png': { status: 'queued' },
  '05-ok.jpg': { status: 'queued' },
  '06-bad-type.txt': { status: 'rejected', msg: /ชนิดไฟล์ไม่รองรับ/ },
  '07-broken.pdf': { status: 'rejected', msg: /PDF/ },
  '08-toobig.jpg': { status: 'rejected', msg: /ใหญ่เกิน/ },
  '09-duplicate-of-01.pdf': { status: 'duplicate' },
}

let pass = 0, fail = 0
const ok = (c: boolean, label: string, extra = '') => {
  if (c) { pass++; console.log(`  ✅ ${label}`) }
  else { fail++; console.log(`  ❌ ${label} ${extra}`) }
}

const created: string[] = []

async function run() {
  console.log('\n=== A. Intake — อัปโหลดไฟล์ทดสอบ 9 แบบ ===')
  for (const name of readdirSync(FIXTURES).sort()) {
    const exp = EXPECT[name]
    if (!exp) continue
    const buffer = readFileSync(`${FIXTURES}/${name}`)
    const r = await intakeFile(db, { name: TAG + name, type: mimeOf(name), buffer }, 'qa-bot')
    if (r.id) created.push(r.id)
    const detail = r.status === 'rejected' ? ` — "${r.message}"` : ''
    ok(r.status === exp.status, `${name} → ${r.status}${detail}`, `(คาดว่า ${exp.status})`)
    if (exp.msg && r.status === 'rejected') ok(exp.msg.test(r.message), `  ข้อความถูกต้อง`, r.message)
  }

  console.log('\n=== B. ตรวจข้อมูลใน DB ===')
  const { data: rows } = await db.from('doc_documents')
    .select('id, state, original_filename, page_count, storage_path, duplicate_of, error_category')
    .like('original_filename', `${TAG}%`)
  ok(rows?.length === 9, `สร้าง record ครบทุกไฟล์ (${rows?.length}/9)`)

  const byName = Object.fromEntries((rows || []).map((r) => [r.original_filename.replace(TAG, ''), r]))
  ok(byName['01-ok-1page.pdf']?.page_count === 1, 'นับหน้า PDF 1 หน้า ถูก', `ได้ ${byName['01-ok-1page.pdf']?.page_count}`)
  ok(byName['02-ok-3page.pdf']?.page_count === 3, 'นับหน้า PDF 3 หน้า ถูก', `ได้ ${byName['02-ok-3page.pdf']?.page_count}`)
  ok(byName['06-bad-type.txt']?.error_category === 'intake_error', 'ไฟล์ผิดชนิด → error_category = intake_error')
  ok(!byName['06-bad-type.txt']?.storage_path, 'ไฟล์ที่ไม่ผ่านไม่ถูกเก็บลง storage')
  const dupRow = byName['09-duplicate-of-01.pdf']
  ok(dupRow?.state === 'duplicate' && !!dupRow?.duplicate_of, 'ไฟล์ซ้ำชี้กลับไปต้นฉบับ')
  ok(dupRow?.storage_path === byName['01-ok-1page.pdf']?.storage_path, 'ไฟล์ซ้ำใช้ไฟล์ต้นฉบับเดิม (ไม่เขียนทับ)')

  console.log('\n=== C. ไฟล์ต้นฉบับใน Storage ===')
  const { data: files } = await db.storage.from(DOC_BUCKET).list('originals')
  const paths = (rows || []).map((r) => r.storage_path).filter(Boolean) as string[]
  const uniq = [...new Set(paths)]
  const names = new Set((files || []).map((f) => f.name))
  const missing = uniq.filter((p) => !names.has(p.split('/').pop()!))
  ok(missing.length === 0, `ไฟล์ต้นฉบับอยู่ครบใน storage (${uniq.length} ไฟล์)`, missing.join(','))

  console.log('\n=== D. Audit log (append-only §9) ===')
  const { data: audits } = await db.from('doc_audit').select('id, action, from_state, to_state').eq('actor', 'qa-bot')
  ok((audits?.length || 0) >= 9, `เขียน audit ครบ (${audits?.length} แถว)`)
  ok(audits?.some((a) => a.action === 'state.transition' && a.from_state === 'received' && a.to_state === 'queued'),
    'บันทึก transition received → queued')
  ok(audits?.some((a) => a.action === 'duplicate.detected'), 'บันทึก duplicate.detected')
  ok(audits?.some((a) => a.action === 'document.rejected'), 'บันทึก document.rejected')

  const target = audits?.[0]
  const upd = await db.from('doc_audit').update({ action: 'HACKED' }).eq('id', target!.id)
  ok(!!upd.error, 'แก้ audit ไม่ได้ (trigger append-only ทำงาน)', upd.error ? '' : 'แก้ได้ = ผิด!')
  const del = await db.from('doc_audit').delete().eq('id', target!.id)
  ok(!!del.error, 'ลบ audit ไม่ได้ (trigger append-only ทำงาน)', del.error ? '' : 'ลบได้ = ผิด!')

  console.log('\n=== E. ไม่แตะตารางเดิมของ core ===')
  for (const t of ['sales_records', 'stock_records', 'contact_leads']) {
    const { error } = await db.from(t).select('*', { count: 'exact', head: true })
    ok(!error, `${t} ยังอ่านได้ปกติ`, error?.message)
  }

  // ===== cleanup =====
  console.log('\n=== Cleanup ===')
  await db.from('doc_documents').delete().like('original_filename', `${TAG}%`)
  if (uniq.length) await db.storage.from(DOC_BUCKET).remove(uniq)
  const { count } = await db.from('doc_documents').select('*', { count: 'exact', head: true })
  console.log(`  ลบข้อมูลทดสอบแล้ว · doc_documents เหลือ ${count} แถว`)
  console.log(`  (doc_audit ลบไม่ได้ตามดีไซน์ — เหลือ ${audits?.length} แถวของ qa-bot ไว้เป็นหลักฐาน)`)

  console.log(`\n${'='.repeat(46)}\nสรุป: ผ่าน ${pass} · ไม่ผ่าน ${fail}\n${'='.repeat(46)}`)
  process.exit(fail === 0 ? 0 : 1)
}

run().catch((e) => { console.error('ERROR:', e); process.exit(1) })
