'use client'
// app/cart/page.tsx — ตะกร้า + ฟอร์มติดต่อ + consent -> บันทึกออเดอร์ -> ส่งไลน์
import { useState } from 'react'
import Link from 'next/link'
import { useCart, type CartItem } from '../context/CartContext'
import { LINE_OA_URL } from '@/lib/constants'

const baht = (n: number) => new Intl.NumberFormat('th-TH').format(n)

function isTBC(item: CartItem): boolean {
  return item.price === 1500 && !item.image_url
}

function buildOrderMessage(
  items: CartItem[],
  info: { ref?: string; name?: string; contact?: string; note?: string },
): string {
  const lines: string[] = ['สั่งซื้ออะไหล่ ChutiBenz', '']
  items.forEach((x, i) => {
    const code = (x as any).code || (x as any).part_number || ''
    const codeTxt = code ? ` (${code})` : ''
    const price = isTBC(x) ? 'ขอใบเสนอราคา' : `฿${baht(x.price * x.quantity)}`
    lines.push(`${i + 1}. ${x.name}${codeTxt} x${x.quantity} — ${price}`)
  })
  const subtotal = items.filter((x) => !isTBC(x)).reduce((s, x) => s + x.price * x.quantity, 0)
  lines.push('', `รวม (เฉพาะที่มีราคา): ฿${baht(subtotal)}`)
  if (items.some(isTBC)) lines.push('* รายการที่ "ขอใบเสนอราคา" รบกวนแจ้งราคาเพิ่มครับ')
  lines.push('', '— ข้อมูลผู้สั่ง —')
  if (info.name?.trim()) lines.push(`ชื่อ: ${info.name.trim()}`)
  if (info.contact?.trim()) lines.push(`ติดต่อกลับ: ${info.contact.trim()}`)
  if (info.note?.trim()) lines.push(`รายละเอียด: ${info.note.trim().slice(0, 500)}`)
  if (info.ref) lines.push(`เลขออเดอร์: ${info.ref}`)
  lines.push('', 'รบกวนยืนยันราคา/ค่าส่ง และวิธีชำระเงินด้วยครับ')
  return lines.join('\n')
}

export default function CartPage() {
  const { items, totalItems, updateQty, removeItem, clearCart, isLoaded } = useCart()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [warn, setWarn] = useState('')

  const subtotal = items.filter((x) => !isTBC(x)).reduce((s, x) => s + x.price * x.quantity, 0)
  const hasTBC = items.some(isTBC)

  const checkout = async () => {
    setErr(''); setWarn('')
    if (items.length === 0) { setErr('ยังไม่มีสินค้าในตะกร้า'); return }
    if (!contact.trim()) { setErr('กรุณากรอก LINE หรือเบอร์โทร เพื่อให้เราติดต่อกลับได้'); return }
    if (!consent) { setErr('กรุณายินยอมให้ติดต่อกลับ ก่อนส่งคำสั่งซื้อ'); return }
    setSubmitting(true)
    let ref = ''
    let saved = false
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website, customer_name: name, customer_contact: contact, note, source: 'web_cart',
          items: items.map((x) => ({ id: x.id, name: x.name, price: isTBC(x) ? null : x.price, qty: x.quantity })),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (j?.ok) { ref = j.ref; saved = true }
    } catch {
      /* best-effort */
    } finally {
      setSubmitting(false)
    }
    if (!saved) setWarn('ระบบบันทึกออเดอร์อาจยังไม่สำเร็จ แต่คุณสามารถส่งรายการผ่าน LINE ให้ทีมงานได้โดยตรง')
    const msg = buildOrderMessage(items, { ref, name, contact, note })
    window.open(`${LINE_OA_URL}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  if (!isLoaded) {
    return <section className="container mx-auto px-4 py-16 max-w-4xl text-center text-gray-400">กำลังโหลดตะกร้า…</section>
  }

  return (
    <section className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
      <h1 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-1">ตะกร้าสินค้า</h1>
      <p className="text-sm text-gray-500 mb-8">กรอกช่องทางติดต่อ แล้วส่งคำสั่งซื้อ — ระบบบันทึกออเดอร์ + เปิดไลน์ Mr.Chuti</p>

      {totalItems === 0 ? (
        <div className="border border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-gray-600 mb-6">ยังไม่มีสินค้าในตะกร้า</p>
          <Link href="/search" className="inline-block bg-[#C9A961] hover:bg-[#D8B872] text-white font-medium px-6 py-3 text-sm rounded">ค้นหาอะไหล่</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-2 divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden bg-white">
            {items.map((x) => (
              <div key={x.id} className="flex gap-4 p-4">
                <Link href={`/products/${x.slug}`} className="flex-shrink-0 w-20 h-20 bg-gray-100 overflow-hidden rounded border border-gray-200">
                  {x.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.image_url} alt={x.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-2xl text-gray-300">⚙️</span>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${x.slug}`} className="font-medium text-gray-900 hover:text-[#C9A961] line-clamp-2">{x.name}</Link>
                  <div className="flex items-center justify-between mt-3 gap-3">
                    <div className="inline-flex items-center border border-gray-300 rounded">
                      <button type="button" aria-label="ลด" onClick={() => updateQty(x.id, x.quantity - 1)} className="w-8 h-8 text-gray-600 hover:bg-gray-100">-</button>
                      <span className="w-9 text-center text-sm">{x.quantity}</span>
                      <button type="button" aria-label="เพิ่ม" onClick={() => updateQty(x.id, x.quantity + 1)} className="w-8 h-8 text-gray-600 hover:bg-gray-100">+</button>
                    </div>
                    <div className="text-right">
                      {isTBC(x) ? (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">ขอใบเสนอราคา</span>
                      ) : (
                        <span className="font-medium text-gray-900">฿{baht(x.price * x.quantity)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button type="button" aria-label="ลบ" onClick={() => removeItem(x.id)} className="flex-shrink-0 self-start text-gray-400 hover:text-red-600 text-sm">x</button>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 p-5 bg-gray-50 rounded-lg md:sticky md:top-24">
            <div className="flex justify-between text-sm text-gray-600"><span>จำนวนรวม</span><span>{totalItems} ชิ้น</span></div>
            <div className="flex justify-between mt-2"><span className="text-gray-700">ยอดรวม (ที่มีราคา)</span><span className="font-medium text-gray-900">฿{baht(subtotal)}</span></div>
            {hasTBC && <p className="text-xs text-amber-700 mt-2">* มีบางรายการยังไม่มีราคา — Mr.Chuti จะแจ้งราคา + ค่าส่งทางไลน์</p>}

            <div className="mt-5 space-y-3 border-t border-gray-200 pt-4 relative">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ (ไม่บังคับ)" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none" />
              <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="LINE ID หรือเบอร์โทร *" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#C9A961] focus:outline-none resize-none" />
              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#C9A961]" />
                <span>ยินยอมให้ ChutiBenz เก็บข้อมูลติดต่อ เพื่อติดต่อกลับเรื่องคำสั่งซื้อนี้</span>
              </label>
              <div className="absolute left-[-9999px] top-auto w-px h-px overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
              </div>
              {err && <p className="text-xs text-red-600">{err}</p>}
            </div>

            <button type="button" onClick={checkout} disabled={submitting} className="w-full mt-4 bg-[#06C755] hover:bg-[#05B04A] disabled:opacity-60 text-white font-medium px-5 py-3 text-sm rounded">
              {submitting ? 'กำลังส่ง…' : 'ส่งคำสั่งซื้อ + เปิดไลน์'}
            </button>
            {warn && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3">{warn}</p>}
            <Link href="/search" className="block text-center w-full mt-3 border border-gray-300 text-gray-700 hover:bg-white px-5 py-2.5 text-sm rounded">เลือกสินค้าต่อ</Link>
            <button type="button" onClick={clearCart} className="block w-full mt-3 text-center text-xs text-gray-400 hover:text-red-600">ล้างตะกร้าทั้งหมด</button>
            <p className="text-[11px] text-gray-400 mt-4">ระบบยังไม่ตัดเงินบนเว็บ — กดส่งแล้วระบบบันทึกออเดอร์ + เปิดไลน์ ยืนยันและชำระเงินกับ Mr.Chuti โดยตรง</p>
          </div>
        </div>
      )}
    </section>
  )
}
