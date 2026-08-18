'use client'
// components/VoiceButton.tsx — ปุ่มลอย "คุยกับ AI" (Voice Pilot)
// gate: NEXT_PUBLIC_VOICE_ENABLED !== 'true' → ไม่ render อะไรเลย
// เสียง: ขอ token จาก /api/agent/token → ต่อ LiveKit → agent worker ถูก dispatch เข้าห้องเดียวกัน
// fallback: ตรวจ LINE in-app browser + ปุ่มโทร (tel:) + แชท LINE
import { useState, useRef, type CSSProperties } from 'react'

const GREEN = '#17301F'
const GOLD = '#C9A961'
const PHONE_TEL = 'tel:0818285855'
const LINE_URL = 'https://line.me/R/ti/p/%40440ifncj'

type Phase = 'idle' | 'connecting' | 'live' | 'error'

function btn(bg: string, fg: string, border?: string): CSSProperties {
  return {
    display: 'block', textAlign: 'center', padding: '10px 12px', borderRadius: 10,
    background: bg, color: fg, border: border ? `1px solid ${border}` : 'none',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', width: '100%',
  }
}

export default function VoiceButton() {
  // เปิดปุ่มเมื่อ: env เปิด (เปิดให้ทุกคน) หรือมี ?voice ใน URL (เทสส่วนตัว ลูกค้าทั่วไปไม่เห็น)
  const [enabled] = useState(() =>
    process.env.NEXT_PUBLIC_VOICE_ENABLED === 'true' ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('voice')),
  )
  const [open, setOpen] = useState(false)
  const [lineInApp, setLineInApp] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [msg, setMsg] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomRef = useRef<any>(null)

  if (!enabled) return null

  const toggle = () => {
    if (!open && typeof navigator !== 'undefined') setLineInApp(/Line/i.test(navigator.userAgent))
    setOpen((v) => !v)
  }

  const startVoice = async () => {
    if (phase === 'connecting' || phase === 'live') return
    setPhase('connecting')
    setMsg('กำลังเชื่อมต่อ…')
    try {
      const res = await fetch('/api/agent/token', { method: 'POST' })
      if (!res.ok) throw new Error('token_failed')
      const { token, url } = await res.json()
      const { Room, RoomEvent } = await import('livekit-client')
      const room = new Room()
      roomRef.current = room
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.on(RoomEvent.TrackSubscribed, (track: any) => {
        if (track.kind === 'audio') {
          const el = track.attach()
          el.style.display = 'none'
          document.body.appendChild(el)
        }
      })
      room.on(RoomEvent.Disconnected, () => { setPhase('idle'); setMsg('') })
      await room.connect(url, token)
      await room.localParticipant.setMicrophoneEnabled(true)
      setPhase('live')
      setMsg('กำลังคุยกับ AI — พูดได้เลยครับ')
    } catch (e) {
      setPhase('error')
      const noMic = e instanceof Error && e.name === 'NotFoundError'
      setMsg(noMic
        ? 'ไม่พบไมโครโฟนในเครื่องนี้ — ลองใช้มือถือ หรือโทร/แชท LINE ได้เลยครับ'
        : 'เชื่อมต่อเสียงไม่สำเร็จ ลองใหม่ หรือโทร/แชท LINE ได้เลยครับ')
      console.error('[voice] startVoice failed:', e)
    }
  }

  const endVoice = async () => {
    try { await roomRef.current?.disconnect() } catch { /* ignore */ }
    roomRef.current = null
    setPhase('idle')
    setMsg('')
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
            {phase === 'live' ? (
              <button type="button" onClick={endVoice} style={btn('#c0392b', '#fff')}>🔴 วางสาย</button>
            ) : (
              <button type="button" onClick={startVoice} disabled={lineInApp || phase === 'connecting'}
                style={{ ...btn(GREEN, GOLD, GOLD), opacity: (lineInApp || phase === 'connecting') ? .5 : 1 }}>
                🎙️ {phase === 'connecting' ? 'กำลังเชื่อมต่อ…' : 'คุยด้วยเสียง'}
              </button>
            )}
            {msg && <div style={{ fontSize: 12, color: phase === 'error' ? '#c0392b' : GREEN }}>{msg}</div>}
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
