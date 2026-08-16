'use client'
import { useState, useTransition } from 'react'
import type { SyncResult } from './types'

const GREEN = '#17301F'

export default function SyncNowClient({ runSync }: { runSync: () => Promise<SyncResult> }) {
  const [res, setRes] = useState<SyncResult | null>(null)
  const [pending, start] = useTransition()

  const go = () =>
    start(async () => {
      setRes(null)
      setRes(await runSync())
    })

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 20, color: GREEN, marginBottom: 4 }}>🔄 Sync ขึ้นเว็บตอนนี้</div>
      <div style={{ fontSize: 13.5, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
        ดึงข้อมูลจากชีต <b>🌐 Web Catalog</b> → อัปเดตสินค้าบนเว็บทันที (ตั้ง published + ซิงค์ ชื่อ/ราคา/จำนวน/หมวด · เก็บรูปเดิมไว้)
        <br />
        <span style={{ color: '#999' }}>เฉพาะแถวที่คอลัมน์ PUBLISH = &quot;published&quot; เท่านั้น · ปกติระบบ sync อัตโนมัติ 16:00 น. ทุกวันอยู่แล้ว</span>
      </div>

      <button
        onClick={go}
        disabled={pending}
        style={{ width: '100%', background: pending ? '#8a9a90' : GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '16px', fontSize: 17, fontWeight: 700, cursor: pending ? 'default' : 'pointer' }}
      >
        {pending ? 'กำลัง sync…' : '🔄 Sync ขึ้นเว็บตอนนี้'}
      </button>

      {res && (
        <div style={{ marginTop: 18, background: res.ok ? '#E7F3EC' : '#FDECEC', border: '1px solid ' + (res.ok ? '#4CAF7D' : '#E39A9A'), borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: res.ok ? '#1B6E45' : '#A32D2D', marginBottom: res.ok ? 10 : 4 }}>
            {res.ok ? '✅ Sync สำเร็จ' : '❌ ' + (res.error || 'ไม่สำเร็จ')}
          </div>
          {res.ok ? (
            <div style={{ fontSize: 13.5, color: '#33503f', lineHeight: 1.7 }}>
              อ่านจากชีต {res.rows_fetched ?? '-'} แถว · ขึ้นเว็บ (published) <b>{res.rows_published ?? 0}</b> รายการ
              <br />
              เพิ่มใหม่ {res.rows_inserted ?? 0} · อัปเดต {res.rows_updated ?? 0}
              {res.skipped_rows && res.skipped_rows.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: '#8A6416' }}>
                  ข้าม {res.skipped_rows.length} แถว: {res.skipped_rows.slice(0, 6).map((s) => `${s.sku}(${s.reason})`).join(', ')}
                  {res.skipped_rows.length > 6 ? ' …' : ''}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#A32D2D' }}>{res.message || 'ลองใหม่อีกครั้ง หรือเช็ก CRON_SECRET / ชีต'}</div>
          )}
          {res.ok && <div style={{ fontSize: 12.5, color: '#5F5E5A', marginTop: 10 }}>เปิดหน้าเว็บจริงเช็กได้เลย — ของที่ตั้ง published จะขึ้นแล้ว</div>}
        </div>
      )}
    </div>
  )
}
