// lib/docbrief.ts — docbrief (AI Backoffice Copilot) intake helpers
// ใช้ร่วมกับ /ops-x7k2m9/documents · ไม่มี dependency ใหม่ (ใช้ node:crypto เท่านั้น)
// สเปก: phase-0-decision-doc.md §11 (file limits) · §4.6 (dedup)
import { createHash } from 'node:crypto'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_PDF_PAGES = 5
export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

export function extFor(mime: string): string {
  if (mime === 'application/pdf') return '.pdf'
  if (mime === 'image/png') return '.png'
  return '.jpg'
}

// นับหน้า PDF แบบไม่พึ่ง library (เลี่ยงเพิ่ม dependency ใน core repo)
// คืน null = อ่านไม่ออก / ไม่ใช่ PDF ที่ parse ได้
export function countPdfPages(buf: Buffer): number | null {
  const s = buf.toString('latin1')
  if (!s.startsWith('%PDF-')) return null
  // 1) ใช้ /Count ใน page tree (แม่นสุด)
  const counts = [...s.matchAll(/\/Type\s*\/Pages[\s\S]{0,300}?\/Count\s+(\d+)/g)].map((m) => parseInt(m[1], 10))
  if (counts.length) return Math.max(...counts)
  // 2) fallback: นับ /Type /Page (ไม่เอา /Pages)
  const n = (s.match(/\/Type\s*\/Page[^s]/g) || []).length
  return n > 0 ? n : null
}

export type Validated =
  | { ok: true; pageCount: number | null }
  | { ok: false; message: string }

export function validateFile(mime: string, size: number, buf: Buffer): Validated {
  if (!ALLOWED_MIME.includes(mime)) {
    return { ok: false, message: `ชนิดไฟล์ไม่รองรับ: ${mime || 'unknown'} (รับเฉพาะ PDF, JPG, PNG)` }
  }
  if (size <= 0) return { ok: false, message: 'ไฟล์ว่างหรือเสียหาย (0 bytes)' }
  if (size > MAX_FILE_SIZE) {
    return { ok: false, message: `ไฟล์ใหญ่เกินกำหนด: ${(size / 1048576).toFixed(1)} MB (จำกัด 10 MB)` }
  }
  let pageCount: number | null = null
  if (mime === 'application/pdf') {
    pageCount = countPdfPages(buf)
    if (pageCount === null) return { ok: false, message: 'อ่านไฟล์ PDF ไม่ได้ (ไฟล์อาจเสียหาย)' }
    if (pageCount > MAX_PDF_PAGES) {
      return { ok: false, message: `PDF หน้าเกินกำหนด: ${pageCount} หน้า (จำกัด ${MAX_PDF_PAGES} หน้า)` }
    }
  }
  return { ok: true, pageCount }
}
