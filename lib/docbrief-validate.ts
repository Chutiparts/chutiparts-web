// lib/docbrief-validate.ts — docbrief Phase 3 (Validate): กฎไทยแบบ deterministic
// สเปก: phase-0-decision-doc.md §4 (validation ไทย) · §5 (idempotency key) · §3 (กติกา confidence ใหม่)
// หลักการ: ระบบตรวจเอง ไม่เชื่อโมเดล · กฎเชิงคณิตน่าเชื่อถือกว่า confidence ที่โมเดลรายงาน
import { createHash } from 'node:crypto'

export interface DocFields {
  vendor_name: string | null
  vendor_tax_id: string | null
  doc_no: string | null
  doc_date: string | null // YYYY-MM-DD (ค.ศ.)
  subtotal: number | null
  vat: number | null
  grand_total: number | null
  currency: string | null
  confidence?: Record<string, number> | null
}

export interface Issue {
  flag: string
  field: string
  message: string
}

// ===== §4.2 เลขผู้เสียภาษี 13 หลัก + checksum กรมสรรพากร =====
export function isValidThaiTaxId(raw: string): boolean {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(d[12])
}

// ===== §5 Export idempotency key =====
export function exportKey(f: DocFields): string {
  const parts = [
    (f.vendor_tax_id?.replace(/\D/g, '') || 'NA').toLowerCase(),
    (f.doc_no || '').trim(),
    (f.grand_total ?? 0).toFixed(2),
    f.doc_date || '',
    (f.currency || 'THB').toUpperCase(),
  ]
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

const VAT_RATE = 0.07
const ARITHMETIC_TOLERANCE = 0.02 // บาท (§4.1)
const VAT_SANITY_TOLERANCE = 1.0 // บาท (§4.1)
const CONF_THRESHOLD = 0.85 // ใช้เป็น fallback เท่านั้น (§3)

const r2 = (n: number) => Math.round(n * 100) / 100

export type VatModel = 'exclusive' | 'inclusive' | 'mismatch'

/**
 * เทียบยอดว่าเป็นราคาแยก VAT (exclusive) หรือราคารวม VAT (inclusive)
 * - exclusive: subtotal + vat = grand_total (ราคายังไม่รวม VAT แล้วบวก VAT เข้า)
 * - inclusive: grand_total รวม VAT อยู่แล้ว → VAT ที่ฝัง = grand_total × 7/107
 *   (เคสไทยที่บิลโชว์ราคารวม VAT เป็น subtotal แล้วแตก VAT ออกมา ทำให้ subtotal+vat ≠ total)
 * คืน model + VAT ที่ควรเป็นตาม model นั้น
 */
export function reconcileVat(subtotal: number, vat: number, grandTotal: number): { model: VatModel; expectedVat: number } {
  // exclusive — ยอดบวกลงตัวตรง ๆ
  if (Math.abs(subtotal + vat - grandTotal) <= ARITHMETIC_TOLERANCE) {
    return { model: 'exclusive', expectedVat: r2(subtotal * VAT_RATE) }
  }
  // inclusive — grand_total รวม VAT แล้ว
  const netBase = r2((grandTotal * 100) / 107)
  const embeddedVat = r2(grandTotal - netBase)
  const vatOk = Math.abs(vat - embeddedVat) <= VAT_SANITY_TOLERANCE
  // subtotal ที่โชว์อาจเป็นราคารวม (≈ grand_total) หรือฐานก่อน VAT (≈ netBase)
  const subtotalOk =
    Math.abs(subtotal - grandTotal) <= ARITHMETIC_TOLERANCE ||
    Math.abs(subtotal - netBase) <= VAT_SANITY_TOLERANCE
  if (vatOk && subtotalOk) return { model: 'inclusive', expectedVat: embeddedVat }
  return { model: 'mismatch', expectedVat: r2(subtotal * VAT_RATE) }
}

/**
 * ตรวจเอกสาร 1 ใบ คืน flags + รายละเอียดปัญหา
 * ไม่ตัดสินใจแทนคน — แค่ตั้งธงให้ owner ดู (confirm-before-write §2)
 */
export function validateDocument(f: DocFields): { flags: string[]; issues: Issue[] } {
  const issues: Issue[] = []
  const add = (flag: string, field: string, message: string) => issues.push({ flag, field, message })

  // ---- §4.5 เลขที่เอกสาร (จำเป็นต่อ idempotency key §5) ----
  if (!f.doc_no?.trim()) {
    add('missing_doc_no', 'doc_no', 'ไม่มีเลขที่เอกสาร — ออก export key ไม่ได้ ต้องกรอกเอง')
  }

  // ---- §4.4 ยอดสุทธิ ----
  if (f.grand_total == null) {
    add('validation_failed', 'grand_total', 'ไม่พบยอดสุทธิ')
  } else if (f.grand_total <= 0) {
    add('validation_failed', 'grand_total', `ยอดสุทธิต้องมากกว่า 0 (ได้ ${f.grand_total})`)
  }

  // ---- §4.1 VAT + arithmetic ----
  const hasBreakdown = f.subtotal != null && f.vat != null && f.grand_total != null
  let arithmeticOk = false

  if (hasBreakdown) {
    const rec = reconcileVat(f.subtotal!, f.vat!, f.grand_total!)
    if (rec.model === 'exclusive') {
      arithmeticOk = true // ← เลขบวกลงตัว = อ่านถูกแน่นอน (§3)
      // VAT sanity 7% (เฉพาะราคาแยก VAT)
      if (f.vat === 0) {
        add('vat_mismatch', 'vat', 'VAT = 0 (สินค้ายกเว้น VAT?) — ให้คนยืนยัน')
      } else if (Math.abs(f.vat! - rec.expectedVat) > VAT_SANITY_TOLERANCE) {
        const rate = f.subtotal ? ((f.vat! / f.subtotal!) * 100).toFixed(2) : '?'
        add('vat_mismatch', 'vat',
          `VAT ไม่ใช่ 7% (คิดได้ ${rate}% · คาดว่า ${rec.expectedVat.toFixed(2)}) — อาจมีของยกเว้น VAT`)
      }
    } else if (rec.model === 'inclusive') {
      arithmeticOk = true // ยอดสอดคล้องแบบ "ราคารวม VAT" = อ่านถูก (ไม่ใช่ fail)
      add('vat_inclusive', 'vat',
        `บิลนี้เป็นราคารวม VAT แล้ว (VAT ฝังใน ≈ ${rec.expectedVat.toFixed(2)} บาท) — ตรวจยอดผ่าน`)
    } else {
      const diff = Math.abs(f.subtotal! + f.vat! - f.grand_total!)
      add('validation_failed', 'grand_total',
        `ก่อน VAT + VAT ≠ ยอดสุทธิ (ต่าง ${diff.toFixed(2)} บาท) และไม่เข้าเงื่อนไขราคารวม VAT`)
    }
  }
  // ถ้าไม่มี subtotal/vat (เช่น ใบเสร็จศุลกากร/ภ.พ.30) → ข้าม ไม่ใช่ fail (§3 †)

  // ---- §4.2 เลขผู้เสียภาษี ----
  if (f.vendor_tax_id?.trim() && !isValidThaiTaxId(f.vendor_tax_id)) {
    add('invalid_tax_id', 'vendor_tax_id',
      `เลขผู้เสียภาษีไม่ผ่าน checksum 13 หลัก (${f.vendor_tax_id})`)
  }

  // ---- §4.3 วันที่ ----
  if (!f.doc_date) {
    add('validation_failed', 'doc_date', 'ไม่พบวันที่เอกสาร')
  } else {
    const d = new Date(`${f.doc_date}T00:00:00Z`)
    if (Number.isNaN(d.getTime())) {
      add('validation_failed', 'doc_date', `รูปแบบวันที่ไม่ถูกต้อง (${f.doc_date})`)
    } else {
      const today = new Date()
      today.setUTCHours(23, 59, 59, 999)
      if (d > today) add('future_date', 'doc_date', `วันที่อยู่ในอนาคต (${f.doc_date})`)
      const year = d.getUTCFullYear()
      if (year > 2400) add('validation_failed', 'doc_date', `ยังเป็น พ.ศ. ไม่ได้แปลง (${f.doc_date})`)
    }
  }

  // ---- §3 confidence — ใช้เป็น fallback เท่านั้น ----
  // ถ้าเลขบวกลงตัวแล้ว ไม่ต้องสนใจ confidence ของ field ตัวเลข
  const conf = f.confidence || {}
  const numericFields = ['subtotal', 'vat', 'grand_total']
  const lowConf = Object.entries(conf)
    .filter(([field, v]) => {
      if (v >= CONF_THRESHOLD) return false
      if (arithmeticOk && numericFields.includes(field)) return false // เลขยืนยันตัวเองแล้ว
      if (field === 'doc_no' && !f.doc_no) return false // มี missing_doc_no อยู่แล้ว
      if (field === 'vendor_tax_id' && !f.vendor_tax_id) return false // ไม่มีก็ไม่ต้องเตือนซ้ำ
      return true
    })
    .map(([field]) => field)

  if (lowConf.length) {
    add('low_confidence', lowConf.join(','),
      `โมเดลไม่มั่นใจในการอ่าน: ${lowConf.join(', ')} — ให้คนตรวจ`)
  }

  const flags = [...new Set(issues.map((i) => i.flag))]
  return { flags, issues }
}

/** พร้อม export ไหม — ใช้กันไม่ให้ confirm เอกสารที่ข้อมูลไม่ครบ */
export function canExport(f: DocFields): { ok: boolean; reason?: string } {
  if (!f.doc_no?.trim()) return { ok: false, reason: 'ต้องมีเลขที่เอกสาร (ใช้ทำ export key)' }
  if (f.grand_total == null || f.grand_total <= 0) return { ok: false, reason: 'ต้องมียอดสุทธิมากกว่า 0' }
  if (!f.doc_date) return { ok: false, reason: 'ต้องมีวันที่เอกสาร' }
  return { ok: true }
}
