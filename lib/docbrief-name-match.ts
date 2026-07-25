// lib/docbrief-name-match.ts — จับ "ชื่ออะไหล่คล้ายของเดิม" กันสร้างสต็อกซ้ำ (blueprint B2)
// ใช้ Dice coefficient บน character-bigram — เหมาะกับภาษาไทยที่ไม่มีเว้นวรรคคำ
//   ("ผ้าเบรคหน้า Vios" ~ "ผ้าเบรค Vios หน้า" → คล้ายสูง แม้ลำดับ/ช่องว่างต่างกัน)
// เป็นแค่ "เตือน" ไม่บล็อก — ของคนละชิ้นอาจชื่อคล้ายกันได้ คนตัดสินเสมอ (confirm-before-write)

/** normalize: lowercase + ตัดอักขระที่ไม่ใช่ตัวอักษร/ตัวเลข/วรรณยุกต์ + ยุบช่องว่างทิ้ง (ไทยไม่เว้นวรรคคำ)
 *  เก็บ \p{M} (สระ/วรรณยุกต์ไทยเป็น combining mark) ไว้ ไม่งั้น "ผ้า" จะกลายเป็น "ผา" */
export function normalizePartName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, '')
}

function bigrams(s: string): string[] {
  const g: string[] = []
  for (let i = 0; i < s.length - 1; i++) g.push(s.slice(i, i + 2))
  return g
}

/** ความคล้าย 0..1 (Dice coefficient บน character-bigram แบบ multiset) */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizePartName(a)
  const nb = normalizePartName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0 // สั้นเกินทำ bigram ไม่ได้ (และไม่เท่ากัน)
  const ga = bigrams(na)
  const gb = bigrams(nb)
  const counts = new Map<string, number>()
  for (const g of ga) counts.set(g, (counts.get(g) ?? 0) + 1)
  let inter = 0
  for (const g of gb) {
    const c = counts.get(g) ?? 0
    if (c > 0) { inter++; counts.set(g, c - 1) }
  }
  return (2 * inter) / (ga.length + gb.length)
}

export interface NameMatch { part_name: string; sku: string | null; similarity: number }

/**
 * หา "ของเดิม" ที่ชื่อคล้ายกับ candidate เกิน threshold (เรียงคล้ายมากก่อน)
 * @param threshold ดีฟอลต์ 0.6 — สูงพอกันเตือนมั่ว แต่จับสลับคำ/พิมพ์ต่างได้
 */
export function findSimilarNames(
  candidate: string | null | undefined,
  existing: { part_name: string | null; sku: string | null }[],
  threshold = 0.6,
): NameMatch[] {
  if (!candidate?.trim()) return []
  const out: NameMatch[] = []
  for (const e of existing) {
    if (!e.part_name?.trim()) continue
    const sim = nameSimilarity(candidate, e.part_name)
    if (sim >= threshold) out.push({ part_name: e.part_name, sku: e.sku, similarity: Math.round(sim * 100) / 100 })
  }
  return out.sort((x, y) => y.similarity - x.similarity)
}
