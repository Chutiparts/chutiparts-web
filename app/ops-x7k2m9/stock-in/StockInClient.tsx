'use client'
import { useActionState, useEffect, useState } from 'react'
import type { ProductInfo } from './page'

const GREEN = '#17301F'
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#33503f', marginBottom: 4, marginTop: 12 }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 15, marginTop: 2 }

type ActionState = { ok: boolean; message: string } | null
type Action = (prev: ActionState, fd: FormData) => Promise<{ ok: boolean; message: string }>

export default function StockInClient({
  sku, info, receiveOne, publishOne,
}: {
  sku: string
  info: ProductInfo
  receiveOne: Action
  publishOne: Action
}) {
  const [recRes, recAction, recPending] = useActionState<ActionState, FormData>(receiveOne, null)
  const [pubRes, pubAction, pubPending] = useActionState<ActionState, FormData>(publishOne, null)
  const [stocked, setStocked] = useState(info.in_stock ?? false)
  const [published, setPublished] = useState(info.is_published ?? false)

  useEffect(() => { if (recRes?.ok) setStocked(true) }, [recRes])
  useEffect(() => { if (pubRes?.ok) setPublished(true) }, [pubRes])

  if (!sku || !info.found) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 19, color: GREEN, marginBottom: 8 }}>🚚 รับเข้าสต็อก</div>
        <div style={{ background: '#FFF6E5', border: '1px solid #E6B450', borderRadius: 10, padding: 16, fontSize: 14, color: '#8A6416' }}>
          {sku ? `ไม่พบสินค้า SKU "${sku}" ใน products — เพิ่มสินค้าก่อน` : 'ไม่มี SKU ในลิงก์ — เข้ามาจากหน้า "เพิ่มสินค้า" → "อัพรูป" ก่อน'}
        </div>
        <a href="/ops-x7k2m9/add-part" style={{ display: 'inline-block', marginTop: 16, background: GREEN, color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700 }}>➕ ไปหน้าเพิ่มสินค้า</a>
      </div>
    )
  }

  const Step = ({ n, label, done }: { n: number; label: string; done: boolean }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: done ? '#1B6E45' : '#999', fontWeight: done ? 700 : 500 }}>
      <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 9, background: done ? '#1B6E45' : '#ddd', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{done ? '✓' : n}</span>
      {label}
    </span>
  )

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 20, color: GREEN, marginBottom: 4 }}>🚚 รับเข้าสต็อก + ขึ้นเว็บ</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <Step n={1} label="เพิ่มสินค้า" done />
        <Step n={2} label="อัพรูป" done={!!info.image_url} />
        <Step n={3} label="รับเข้าสต็อก" done={stocked} />
        <Step n={4} label="ขึ้นเว็บ" done={published} />
      </div>

      {/* การ์ดสินค้า */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#F4F7F5', borderRadius: 12, padding: 12, marginBottom: 18 }}>
        {info.image_url
          ? <img src={info.image_url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
          : <div style={{ width: 64, height: 64, borderRadius: 8, background: '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📦</div>}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#17301F' }}>{info.name || sku}</div>
          <div style={{ fontSize: 12.5, color: '#666' }}>{sku}{info.car_model ? ` · ${info.car_model}` : ''}{info.category ? ` · ${info.category}` : ''}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{info.price != null ? `ราคา ${info.price.toLocaleString()} · ` : ''}{published ? '🌐 ขึ้นเว็บแล้ว' : 'ยังไม่ขึ้นเว็บ'} · {stocked ? '📦 มีในสต็อก' : 'ยังไม่เข้าสต็อก'}</div>
        </div>
      </div>

      {/* STEP 3: รับเข้าสต็อก */}
      {!stocked && (
        <form action={recAction} style={{ background: '#fff', border: '1px solid #e3e8e5', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: GREEN, marginBottom: 4 }}>3️⃣ รับเข้าสต็อก</div>
          <input type="hidden" name="sku" value={sku} />
          <label style={lbl}>จำนวน (ชิ้น) *
            <input name="qty" inputMode="numeric" defaultValue="1" style={inp} placeholder="เช่น 1" />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ ...lbl, flex: 1 }}>ต้นทุน/ชิ้น (บาท)
              <input name="cost" inputMode="numeric" style={inp} placeholder="เช่น 6000" />
            </label>
            <label style={{ ...lbl, flex: 1 }}>ราคาขาย (บาท)
              <input name="set_price" inputMode="numeric" style={inp} placeholder="เช่น 10000" />
            </label>
          </div>
          <label style={lbl}>ที่เก็บ
            <input name="location" style={inp} placeholder="เช่น ชั้น A-3" />
          </label>
          <button type="submit" disabled={recPending}
            style={{ width: '100%', marginTop: 16, background: recPending ? '#8a9a90' : GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 16, fontWeight: 700, cursor: recPending ? 'default' : 'pointer' }}>
            {recPending ? 'กำลังรับเข้า…' : '🚚 รับเข้าสต็อก'}
          </button>
          {recRes && !recRes.ok && <div style={{ marginTop: 10, color: '#A32D2D', fontSize: 13 }}>❌ {recRes.message}</div>}
        </form>
      )}
      {stocked && (
        <div style={{ background: '#E7F3EC', border: '1px solid #4CAF7D', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 14, color: '#1B6E45', fontWeight: 600 }}>
          ✅ เข้าสต็อกแล้ว{recRes?.ok ? ` — ${recRes.message}` : ''}
        </div>
      )}

      {/* STEP 4: publish */}
      {stocked && !published && (
        <form action={pubAction} style={{ background: '#fff', border: '1px solid #e3e8e5', borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: GREEN, marginBottom: 8 }}>4️⃣ ขึ้นเว็บให้ลูกค้าเห็น</div>
          <input type="hidden" name="sku" value={sku} />
          <button type="submit" disabled={pubPending}
            style={{ width: '100%', background: pubPending ? '#8a9a90' : '#0F6E56', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 16, fontWeight: 700, cursor: pubPending ? 'default' : 'pointer' }}>
            {pubPending ? 'กำลังขึ้นเว็บ…' : '🌐 ขึ้นเว็บตอนนี้'}
          </button>
          {pubRes && !pubRes.ok && <div style={{ marginTop: 10, color: '#A32D2D', fontSize: 13 }}>❌ {pubRes.message}</div>}
        </form>
      )}

      {/* DONE */}
      {stocked && published && (
        <div style={{ background: '#E7F3EC', border: '1px solid #4CAF7D', borderRadius: 12, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1B6E45', marginBottom: 6 }}>🎉 เสร็จครบทุกขั้น!</div>
          <div style={{ fontSize: 13.5, color: '#33503f', marginBottom: 14 }}>เพิ่มสินค้า → อัพรูป → รับเข้าสต็อก → ขึ้นเว็บ · ลูกค้าเห็นของแล้ว ขายตัดสต็อกอัตโนมัติ</div>
          <a href="/ops-x7k2m9/add-part" style={{ display: 'inline-block', background: GREEN, color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '11px 18px', fontSize: 14, fontWeight: 700 }}>➕ เพิ่มสินค้าตัวถัดไป</a>
        </div>
      )}
    </div>
  )
}
