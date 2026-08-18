'use client'
// components/VoiceButton.tsx — ปุ่มลอย "คุยกับ AI" (Voice Pilot)
// gate: NEXT_PUBLIC_VOICE_ENABLED !== 'true' → ไม่ render อะไรเลย (บน prod มองไม่เห็นจนกว่าจะเปิด env)
// ทำงานได้ทันที: ตรวจ LINE in-app browser (ตอนกดเปิด) + ปุ่มโทร (tel:) + ปุ่มแชท LINE
// TODO (เมื่อ agent worker + /api/agent/token พร้อม): เปลี่ยน startVoice() ให้ต่อ LiveKit จริง
import { useState, type CSSProperties } from 'react'

const GREEN = '#17301F'
const GOLD = '#C9A961'
const PHONE_TEL = 'tel:0818285855'
const LINE_URL = 'https://line.me/R/ti/p/%40440ifncj'

function btn(bg: string, fg: string, border?: string): CSSProperties {
  return {
    display: 'block', textAlign: 'center', padding: '10px 12px', borderRadius: 10,
    background: bg, color: fg, border: border ? `1px solid ${border}` : 'none',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
  }
}

export default function VoiceButton() {
  const enabled = process.env.NEXT_PUBLIC_VOICE_ENABLED === 'true'
  const [open, setOpen] = useState(false)
  const [lineInApp, setLineInApp] = useState(false)
  const [voiceMsg, setVoiceMsg] = useState('')

  if (!enabled) return null

  // ตรวจ LINE in-app ตอนกดเปิด panel (ใน event handler — ไม่ใช่ effect · ไม่มี hydration mismatch)
  const toggle = () => {
    if (!open && typeof navigator !== 'undefined') {
      setLineInApp(/Line/i.test(navigator.userAgent))
    }
    setOpen((v) => !v)
  }

  const startVoice = () => {
    // TODO: ขอ token จาก /api/agent/token แล้ว connect LiveKit เข้าห้องเดียวกับ agent worker
    setVoiceMsg('ระบบเสียงกำลังเปิดให้บริการเร็ว ๆ นี้ครับ ระหว่างนี้โทรหรือแชท LINE ได้เลย')
  }

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 9999 }}>
      {open && (
        <div style={{ width: 280, marginBottom: 12, background: '#fff', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,.18)', overflow: 'hidden', border: `1px solid ${GOLD}33` }}>
          <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
            <div style={{ fontWeight: 700 }}>คุยกับ ChutiBenz</div>
            <div style={{ fontSize: 12, opacity: .8 }}>ถามสต็อก · ราคา · รุ่นที่ใส่ได้</div>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lineInApp && (
              <div style={{ fontSize: 12, color: '#8a6d1a', background: `${GOLD}22`, padding: 8, borderRadius: 8 }}>
                เปิดหน้านี้ใน Safari หรือ Chrome เพื่อคุยด้วยเสียงได้ครับ (เบราว์เซอร์ใน LINE ใช้ไมค์ไม่ได้)
              </div>
            )}
            <button type="button" onClick={startVoice} disabled={lineInApp}
              style={{ ...btn(GREEN, GOLD), opacity: lineInApp ? .5 : 1, border: `1px solid ${GOLD}` }}>
              🎙️ คุยด้วยเสียง (beta)
            </button>
            {voiceMsg && <div style={{ fontSize: 12, color: GREEN }}>{voiceMsg}</div>}
            <a href={PHONE_TEL} style={btn('#fff', GREEN, GOLD)}>📞 โทรหาร้าน 081-828-5855</a>
            <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={btn('#06C755', '#fff')}>💬 แชทผ่าน LINE</a>
          </div>
        </div>
      )}
      <button type="button" onClick={toggle} aria-label="คุยกับ ChutiBenz"
        style={{ width: 60, height: 60, borderRadius: '50%', background: GREEN, color: GOLD, border: `2px solid ${GOLD}`, boxShadow: '0 6px 20px rgba(0,0,0,.25)', cursor: 'pointer', fontSize: 26 }}>
        {open ? '✕' : '💬'}
      </button>
    </div>
  )
}
