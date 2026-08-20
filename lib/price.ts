// lib/price.ts — แสดงราคาให้เหมือนกันทั้งเว็บ: มีราคา = ฿x,xxx · ไม่มี (≤0/null) = "สอบถามราคา"
export function priceLabel(price: number | null | undefined): string {
  return typeof price === 'number' && price > 0 ? `฿${price.toLocaleString()}` : 'สอบถามราคา'
}
