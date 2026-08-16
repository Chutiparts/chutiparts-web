'use client'
import { useState, useTransition } from 'react'
import type { RadarResult } from './types'

const GREEN = '#17301F'

export default function RadarClient({ runRadar }: { runRadar: (dry: boolean) => Promise<RadarResult> }) {
  const [res, setRes] = useState<RadarResult | null>(null)
  const [pending, start] = useTransition()
  const [mode, setMode] = useState<'preview' | 'send' | null>(null)

  const go = (dry: boolean) =>
    start(async () => {
      setMode(dry ? 'preview' : 'send')
      setRes(null)
      setRes(await runRadar(dry))
    })

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 20, color: GREEN, marginBottom: 4 }}>🛰️ Demand Radar</div>
      <div style={{ fontSize: 13.5, color: '#666', marginBottom: 18, lineHeight: 1.6 }}>
        รวมสัญญาณ <b>ขายได้แต่หมด</b> · <b>ลูกค้าถามแต่ไม่มี</b> · <b>ค้นไม่เจอ</b> → Top 3 ที่ควรลงมือ
        <br />
        <span style={{ color: '#999' }}>ระบบส่งเข้า LINE อัตโนมัติทุกเช้า 08:00 น. · ปุ่มด้านล่างไว้ดู/ทดสอบเอง</span>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => go(true)} disabled={pending}
          style={{ flex: 1, background: '#fff', color: GREEN, border: `2px solid ${GREEN}`, borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1 }}>
          {pending && mode === 'preview' ? 'กำลังดู…' : '👁️ ดูตัวอย่าง (ไม่ส่ง)'}
        </button>
        <button onClick={() => go(false)} disabled={pending}
          style={{ flex: 1, background: pending ? '#8a9a90' : GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: pending ? 'default' : 'pointer' }}>
          {pending && mode === 'send' ? 'กำลังส่ง…' : '📤 ส่งเข้า LINE'}
        </button>
      </div>

      {res && (
        <div style={{ marginTop: 18 }}>
          {res.ok && res.count === 0 && (
            <div style={{ background: '#F4F7F5', border: '1px solid #d8e0da', borderRadius: 10, padding: 16, fontSize: 14, color: '#5F5E5A' }}>
              🟢 วันนี้ไม่มีรายการที่ต้องลงมือ (ไม่มีของขายได้แต่หมด / คนถามค้าง / ค้นไม่เจอเกินเกณฑ์) — ระบบจะไม่ส่ง LINE
            </div>
          )}
          {res.ok && (res.count ?? 0) > 0 && (
            <div style={{ background: '#E7F3EC', border: '1px solid #4CAF7D', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1B6E45', marginBottom: 10 }}>
                {res.dry ? `👁️ ตัวอย่าง (พบ ${res.count} รายการ · ยังไม่ส่ง)` : res.sent ? '📤 ส่งเข้า LINE แล้ว ✓' : '⚠️ คำนวณได้แต่ส่งไม่สำเร็จ'}
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, color: '#20372a', margin: 0, lineHeight: 1.6 }}>{res.message}</pre>
              {!res.sent && !res.dry && res.error && <div style={{ marginTop: 10, color: '#A32D2D', fontSize: 13 }}>ส่งไม่สำเร็จ: {res.error}</div>}
            </div>
          )}
          {!res.ok && (
            <div style={{ background: '#FDECEC', border: '1px solid #E39A9A', borderRadius: 10, padding: 16, fontSize: 14, color: '#A32D2D' }}>
              ❌ {res.error}{res.message ? ` — ${res.message}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
