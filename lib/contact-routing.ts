// lib/contact-routing.ts — กฎช่องทางติดต่อตามภาษา (P0.1)
// TH → LINE เป็นช่องหลัก · EN → WhatsApp เป็นช่องหลัก · แสดงทั้งคู่เสมอ (ไม่ซ่อน)
export type Lang = 'th' | 'en'
export type Channel = 'line' | 'wa'

export const CONTACT: Record<Channel, { href: string; label: string; labelFull: string; color: string }> = {
  line: { href: 'https://line.me/R/ti/p/%40440ifncj', label: 'LINE',     labelFull: 'LINE: mr.chuti5988',        color: '#06C755' },
  wa:   { href: 'https://wa.me/66818285855',          label: 'WhatsApp', labelFull: 'WhatsApp: +66 81-828-5855', color: '#25D366' },
}

// ช่องหลักตามภาษา
export function primaryChannel(lang: Lang): Channel {
  return lang === 'en' ? 'wa' : 'line'
}
// ลำดับแสดง (ช่องหลักมาก่อน) — คืน ['line','wa'] หรือ ['wa','line']
export function contactOrder(lang: Lang): Channel[] {
  return lang === 'en' ? ['wa', 'line'] : ['line', 'wa']
}
