// lib/docbrief-dedup.ts — ตรวจจับ "อาจซ้ำ" (possible duplicate) — blueprint §10/§14
//
// ต่างจาก exact-file-duplicate (ใช้ file hash · auto-block เป็น 'duplicate' อยู่แล้ว):
// ตัวนี้ตรวจ "เนื้อหาคล้าย" — เลขที่ตรง / ยอดตรง / ผู้ขายคล้าย / วันที่ใกล้กัน
// เป็นแค่ธงเตือน (review flag) ห้าม auto-block — คนต้องตัดสินในหน้าเทียบ
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DupMatch {
  document_id: string
  score: number
  reasons: string[]
  // ข้อมูลย่อสำหรับโชว์ (ไม่ต้อง query ซ้ำ)
  vendor_name: string | null
  doc_no: string | null
  grand_total: number | null
  doc_date: string | null
}

const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/\s+/g, '')
const daysApart = (a: string | null, b: string | null) => {
  if (!a || !b) return Infinity
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000
}

interface HeaderDoc {
  id: string; profile: string
  vendor_name: string | null; doc_no: string | null; grand_total: number | null; doc_date: string | null
}

/** ให้คะแนนความซ้ำระหว่าง 2 ใบ + เหตุผล */
function scorePair(a: HeaderDoc, b: HeaderDoc): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  // น้ำหนัก: เลขที่ 0.4 · ยอด 0.4 · ผู้ขาย 0.15 · วันที่ 0.15
  // ตั้งให้ "ยอดตรง + วันที่ตรง" = 0.55 (เกินเกณฑ์) — เผื่อใบส่งของที่ไม่มีเลขที่
  // แต่ "ยอดตรงอย่างเดียว" = 0.4 (ไม่ถึง) — กันเตือนมั่วกรณีสองบิลคนละใบยอดบังเอิญเท่ากัน
  const aNo = norm(a.doc_no), bNo = norm(b.doc_no)
  if (aNo && bNo && aNo === bNo) { score += 0.4; reasons.push('doc_no_match') }

  if (a.grand_total != null && b.grand_total != null && Math.abs(a.grand_total - b.grand_total) < 0.01) {
    score += 0.4; reasons.push('amount_match')
  }
  const aV = norm(a.vendor_name), bV = norm(b.vendor_name)
  if (aV && bV && (aV === bV || aV.includes(bV) || bV.includes(aV))) { score += 0.15; reasons.push('vendor_similar') }

  const d = daysApart(a.doc_date, b.doc_date)
  if (d <= 3) { score += 0.15; reasons.push('date_proximity') }

  return { score: Math.min(1, score), reasons }
}

const THRESHOLD = 0.5 // ต้องมีสัญญาณแรงอย่างน้อย (เช่น เลขที่+ยอด หรือ ยอด+ผู้ขาย)

/**
 * หา "ใบที่อาจซ้ำ" กับใบนี้ — เทียบเฉพาะ profile เดียวกัน · ไม่นับตัวเอง · ไม่นับที่ทิ้งแล้ว
 * คืน matches เรียงคะแนนมากสุดก่อน
 */
export async function findPossibleDuplicates(db: SupabaseClient, documentId: string): Promise<DupMatch[]> {
  const { data: self } = await db.from('doc_documents')
    .select('id, profile, vendor_name, doc_no, grand_total, doc_date').eq('id', documentId).single()
  if (!self) return []
  if (!self.doc_no && self.grand_total == null) return [] // ไม่มีอะไรให้เทียบ

  // ดึงเฉพาะใบที่มีโอกาสตรง (เลขที่ตรง หรือ ยอดตรง) เพื่อไม่ scan ทั้งตาราง
  const ors: string[] = []
  if (self.doc_no) ors.push(`doc_no.eq.${self.doc_no}`)
  if (self.grand_total != null) ors.push(`grand_total.eq.${self.grand_total}`)
  if (!ors.length) return []

  const { data: cands } = await db.from('doc_documents')
    .select('id, profile, vendor_name, doc_no, grand_total, doc_date')
    .eq('profile', self.profile)
    .is('deleted_at', null)
    .neq('id', documentId)
    .in('state', ['pending_review', 'confirmed', 'exported'])
    .or(ors.join(','))
    .limit(50)

  const matches: DupMatch[] = []
  for (const c of cands ?? []) {
    const { score, reasons } = scorePair(self as HeaderDoc, c as HeaderDoc)
    if (score >= THRESHOLD) {
      matches.push({
        document_id: c.id, score: Number(score.toFixed(2)), reasons,
        vendor_name: c.vendor_name, doc_no: c.doc_no, grand_total: c.grand_total, doc_date: c.doc_date,
      })
    }
  }
  return matches.sort((x, y) => y.score - x.score)
}

/** ตรวจแล้วตั้งธง + เก็บหลักฐาน — เรียกท้าย extract (ทั้ง 2 profile) */
export async function checkPossibleDuplicate(db: SupabaseClient, documentId: string): Promise<number> {
  const matches = await findPossibleDuplicates(db, documentId)
  if (!matches.length) return 0

  const { data: doc } = await db.from('doc_documents').select('review_flags').eq('id', documentId).single()
  const flags = new Set<string>(doc?.review_flags ?? [])
  flags.add('possible_duplicate')

  await db.from('doc_documents').update({
    review_flags: Array.from(flags),
    review_metadata: { possible_duplicate_matches: matches },
    updated_at: new Date().toISOString(),
  }).eq('id', documentId)
  await db.from('doc_audit').insert({
    document_id: documentId, actor: 'system', action: 'duplicate.detected',
    metadata: { matches: matches.map((m) => ({ id: m.document_id, score: m.score, reasons: m.reasons })) },
  })
  return matches.length
}

/** คนยืนยันว่า "ไม่ใช่เอกสารซ้ำ" — เอาธงออก เก็บ metadata ไว้เป็นหลักฐาน */
export async function dismissDuplicate(db: SupabaseClient, documentId: string, actor = 'owner'): Promise<void> {
  const { data: doc } = await db.from('doc_documents').select('review_flags').eq('id', documentId).single()
  const flags = (doc?.review_flags ?? []).filter((f: string) => f !== 'possible_duplicate')
  await db.from('doc_documents').update({ review_flags: flags, updated_at: new Date().toISOString() }).eq('id', documentId)
  await db.from('doc_audit').insert({
    document_id: documentId, actor, action: 'duplicate.dismissed', metadata: { note: 'ยืนยันว่าไม่ใช่เอกสารซ้ำ' },
  })
}
