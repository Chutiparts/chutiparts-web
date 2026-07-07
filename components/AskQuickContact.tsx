// components/AskQuickContact.tsx — ปุ่มคุยด่วน LINE/WhatsApp ใน /ask (route ตามภาษา · P0.1)
// client island: อ่านภาษาปัจจุบัน → ช่องหลักเด่น+มาก่อน · แสดงทั้งคู่ · WhatsApp เติม prefill
'use client'
import { useLang } from '@/app/context/LanguageContext'
import { CONTACT, contactOrder, primaryChannel } from '@/lib/contact-routing'

const PREFILL = `สวัสดีครับ อยากสอบถามอะไหล่ Mercedes-Benz
• รุ่นรถ + ปี:
• อะไหล่ที่ต้องการ:
• Part number (ถ้ามี):`

export default function AskQuickContact() {
  const { lang } = useLang()
  const L: 'th' | 'en' = lang === 'en' ? 'en' : 'th'
  const primary = primaryChannel(L)
  const hrefFor = (ch: 'line' | 'wa') =>
    ch === 'wa' ? `${CONTACT.wa.href}?text=${encodeURIComponent(PREFILL)}` : CONTACT.line.href

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
      {contactOrder(L).map((ch) => {
        const isP = ch === primary
        return (
          <a key={ch} href={hrefFor(ch)} target="_blank" rel="noopener noreferrer"
            style={{
              background: CONTACT[ch].color, color: '#fff',
              padding: isP ? '13px 26px' : '12px 20px', borderRadius: 10, fontWeight: 700,
              textDecoration: 'none', fontSize: isP ? 16 : 15,
              boxShadow: isP ? '0 2px 10px rgba(0,0,0,.25)' : 'none',
            }}>
            {CONTACT[ch].label}{isP ? ' ★' : ''}
          </a>
        )
      })}
    </div>
  )
}
