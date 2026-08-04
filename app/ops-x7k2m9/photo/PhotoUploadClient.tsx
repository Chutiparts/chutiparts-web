'use client'
// app/ops-x7k2m9/photo/PhotoUploadClient.tsx — Phase 1 อัพรูปอะไหล่ (ChutiBenz)
// 2026-08-04 · มือถือเป็นหลัก · ปุ่มใหญ่ · ย่อรูปในเครื่องก่อนส่ง · ภาษาไทย
import { useState, useRef, useCallback } from 'react'

const GREEN = '#17301F'
const strip = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '')

type Lookup =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'found'; part_number: string; name: string | null; car_model: string | null; image_url: string | null }

// ย่อรูปในเครื่อง: กว้าง/สูงสุด 1600px · JPEG 0.82
async function resizeImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => rej(new Error('โหลดรูปไม่ได้'))
      im.src = url
    })
    let w = img.naturalWidth
    let h = img.naturalHeight
    if (w > maxDim || h > maxDim) {
      if (w >= h) { h = Math.round((h * maxDim) / w); w = maxDim }
      else { w = Math.round((w * maxDim) / h); h = maxDim }
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas ไม่รองรับ')
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', quality))
    if (!blob) throw new Error('ย่อรูปไม่สำเร็จ')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function PhotoUploadClient() {
  const [sku, setSku] = useState('')
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' })
  const [preview, setPreview] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doLookup = useCallback(async () => {
    const s = sku.trim()
    if (!s) return
    setLookup({ status: 'loading' })
    setMsg(null)
    try {
      const r = await fetch(`/api/ops/photo-upload?sku=${encodeURIComponent(s)}`)
      const j = await r.json()
      if (j.found) {
        setLookup({ status: 'found', part_number: j.part_number, name: j.name, car_model: j.car_model, image_url: j.image_url })
      } else {
        setLookup({ status: 'notfound' })
      }
    } catch {
      setLookup({ status: 'notfound' })
    }
  }, [sku])

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setMsg(null)
    try {
      const resized = await resizeImage(f)
      setBlob(resized)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(resized))
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'เลือกรูปไม่สำเร็จ' })
    }
  }, [preview])

  const onSave = useCallback(async () => {
    if (lookup.status !== 'found' || !blob) return
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('sku', lookup.part_number)
      fd.append('file', blob, `${lookup.part_number}.jpg`)
      const r = await fetch('/api/ops/photo-upload', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error([j.error, j.message, j.details].filter(Boolean).join(' — ') || 'อัพไม่สำเร็จ')
      setMsg({ type: 'ok', text: '✅ อัพรูปขึ้นเว็บแล้ว' })
      setLookup({ ...lookup, image_url: j.url })
      setBlob(null)
      if (preview) { URL.revokeObjectURL(preview); setPreview(null) }
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'อัพไม่สำเร็จ' })
    } finally {
      setBusy(false)
    }
  }, [lookup, blob, preview])

  const btn: React.CSSProperties = {
    width: '100%', padding: '16px', borderRadius: 12, fontSize: 17, fontWeight: 700,
    border: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: GREEN, marginBottom: 4 }}>📷 อัพรูปอะไหล่</h1>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>พิมพ์ SKU → ถ่าย/เลือกรูป → บันทึก · เสร็จ</p>

      {/* STEP 1 — SKU */}
      <label style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>1. SKU อะไหล่</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 12 }}>
        <input
          value={sku}
          onChange={(e) => { setSku(e.target.value); setLookup({ status: 'idle' }) }}
          onKeyDown={(e) => { if (e.key === 'Enter') doLookup() }}
          placeholder="เช่น 140-025"
          autoCapitalize="characters"
          style={{ flex: 1, padding: '14px', border: '1px solid #ccc', borderRadius: 10, fontSize: 17 }}
        />
        <button onClick={doLookup} disabled={!strip(sku)} style={{ ...btn, width: 'auto', padding: '0 20px', background: GREEN, color: '#fff', opacity: strip(sku) ? 1 : 0.4 }}>
          ค้นหา
        </button>
      </div>

      {lookup.status === 'loading' && <p style={{ color: '#666' }}>กำลังค้นหา…</p>}
      {lookup.status === 'notfound' && (
        <div style={{ background: '#FDECEC', color: '#B42318', padding: 12, borderRadius: 10, fontSize: 14 }}>
          ❌ ไม่พบ SKU นี้ในระบบ — ตรวจตัวสะกด หรือเพิ่มสินค้าในชีตก่อน
        </div>
      )}

      {lookup.status === 'found' && (
        <>
          <div style={{ background: '#EAF3EC', border: `1px solid ${GREEN}22`, padding: 14, borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, color: GREEN, fontSize: 16 }}>✓ {lookup.part_number}</div>
            <div style={{ fontSize: 14, color: '#333', marginTop: 2 }}>{lookup.name || '(ไม่มีชื่อ)'}{lookup.car_model ? ` · ${lookup.car_model}` : ''}</div>
            {lookup.image_url && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>รูปเดิม:</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lookup.image_url} alt="รูปเดิม" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
              </div>
            )}
          </div>

          {/* STEP 2 — เลือก/ถ่ายรูป */}
          <label style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>2. ถ่าย/เลือกรูป</label>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{ ...btn, background: '#fff', color: GREEN, border: `2px solid ${GREEN}`, marginTop: 6, marginBottom: 12 }}>
            📷 ถ่าย / เลือกรูป
          </button>

          {preview && (
            <div style={{ marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="พรีวิว" style={{ width: '100%', borderRadius: 12, border: '1px solid #ddd' }} />
            </div>
          )}

          {/* STEP 3 — บันทึก */}
          <button onClick={onSave} disabled={!blob || busy} style={{ ...btn, background: GREEN, color: '#fff', opacity: !blob || busy ? 0.4 : 1 }}>
            {busy ? 'กำลังบันทึก…' : '💾 บันทึกขึ้นเว็บ'}
          </button>
        </>
      )}

      {msg && (
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 10, fontSize: 15, fontWeight: 600,
          background: msg.type === 'ok' ? '#E7F6EC' : '#FDECEC',
          color: msg.type === 'ok' ? '#1B7F3B' : '#B42318',
        }}>
          {msg.text}
        </div>
      )}
    </div>
  )
}
