'use client'
// app/cart/page.tsx — หน้าตะกร้า + checkout ส่งออเดอร์เข้า LINE
// ใช้ CartContext เดิม (chutiparts_cart) — ไม่มีจ่ายเงินบนเว็บ

import Link from 'next/link'
import { useCart, type CartItem } from '../context/CartContext'
import { LINE_OA_URL } from '@/lib/constants'

const baht = (n: number) => new Intl.NumberFormat('th-TH').format(n)

// สินค้าที่ยังไม่ตั้งราคา (ค่า default จาก bulk-add: price=1500 + ไม่มีรูป)
function isTBC(item: CartItem): boolean {
  return item.price === 1500 && !item.image_url
}

function buildOrderMessage(items: CartItem[]): string {
  const lines: string[] = ['🛒 สั่งซื้ออะไหล่ ChutiBenz', '']
  items.forEach((x, i) => {
    const price = isTBC(x) ? 'ขอใบเสนอราคา' : `฿${baht(x.price * x.quantity)}`
    lines.push(`${i + 1}. ${x.name} x${x.quantity} — ${price}`)
  })
  const subtotal = items.filter((x) => !isTBC(x)).reduce((s, x) => s + x.price * x.quantity, 0)
  const hasTBC = items.some(isTBC)
  lines.push('')
  lines.push(`รวม (เฉพาะที่มีราคา): ฿${baht(subtotal)}`)
  if (hasTBC) lines.push('* รายการที่ "ขอใบเสนอราคา" รบกวนแจ้งราคาเพิ่มครับ')
  lines.push('', 'รบกวนยืนยันราคา/ค่าส่ง และวิธีชำระเงินด้วยครับ 🙏')
  return lines.join('\n')
}

export default function CartPage() {
  const { items, totalItems, updateQty, removeItem, clearCart, isLoaded } = useCart()

  const subtotal = items.filter((x) => !isTBC(x)).reduce((s, x) => s + x.price * x.quantity, 0)
  const hasTBC = items.some(isTBC)

  const checkout = () => {
    const msg = buildOrderMessage(items)
    window.open(`${LINE_OA_URL}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  if (!isLoaded) {
    return (
      <section className="container mx-auto px-4 py-16 max-w-4xl text-center text-gray-400">
        กำลังโหลดตะกร้า…
      </section>
    )
  }

  return (
    <section className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
      <h1 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-1">🛒 ตะกร้าสินค้า</h1>
      <p className="text-sm text-gray-500 mb-8">
        ยืนยันรายการแล้วส่งคำสั่งซื้อเข้าไลน์ Mr.Chuti เพื่อเช็คราคา/ค่าส่งและชำระเงิน
      </p>

      {totalItems === 0 ? (
        <div className="border border-gray-200 bg-gray-50 p-10 text-center">
          <div className="text-4xl mb-3">🛒</div>
          <p className="text-gray-600 mb-6">ยังไม่มีสินค้าในตะกร้า</p>
          <Link href="/search" className="inline-block bg-[#C9A961] hover:bg-[#D8B872] text-white font-medium px-6 py-3 text-sm tracking-wide transition rounded">
            ค้นหาอะไหล่ →
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {/* รายการ */}
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
                  <Link href={`/products/${x.slug}`} className="font-medium text-gray-900 hover:text-[#C9A961] line-clamp-2">
                    {x.name}
                  </Link>

                  <div className="flex items-center justify-between mt-3 gap-3">
                    <div className="inline-flex items-center border border-gray-300 rounded">
                      <button type="button" aria-label="ลดจำนวน" onClick={() => updateQty(x.id, x.quantity - 1)} className="w-8 h-8 text-gray-600 hover:bg-gray-100">−</button>
                      <span className="w-9 text-center text-sm">{x.quantity}</span>
                      <button type="button" aria-label="เพิ่มจำนวน" onClick={() => updateQty(x.id, x.quantity + 1)} className="w-8 h-8 text-gray-600 hover:bg-gray-100">+</button>
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

                <button type="button" aria-label="ลบออกจากตะกร้า" onClick={() => removeItem(x.id)} className="flex-shrink-0 self-start text-gray-400 hover:text-red-600 text-sm">✕</button>
              </div>
            ))}
          </div>

          {/* สรุป */}
          <div className="border border-gray-200 p-5 bg-gray-50 rounded-lg md:sticky md:top-24">
            <div className="flex justify-between text-sm text-gray-600">
              <span>จำนวนรวม</span><span>{totalItems} ชิ้น</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-gray-700">ยอดรวม (ที่มีราคา)</span>
              <span className="font-medium text-gray-900">฿{baht(subtotal)}</span>
            </div>
            {hasTBC && (
              <p className="text-xs text-amber-700 mt-2 leading-relaxed">* มีบางรายการยังไม่มีราคา — Mr.Chuti จะแจ้งราคา + ค่าส่งทางไลน์</p>
            )}

            <button type="button" onClick={checkout} className="w-full mt-5 bg-[#06C755] hover:bg-[#05B04A] text-white font-medium px-5 py-3 text-sm tracking-wide transition rounded">
              💬 ส่งคำสั่งซื้อเข้าไลน์
            </button>
            <Link href="/search" className="block text-center w-full mt-3 border border-gray-300 text-gray-700 hover:bg-white px-5 py-2.5 text-sm transition rounded">
              ← เลือกสินค้าต่อ
            </Link>
            <button type="button" onClick={clearCart} className="block w-full mt-3 text-center text-xs text-gray-400 hover:text-red-600">
              ล้างตะกร้าทั้งหมด
            </button>
            <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
              ระบบยังไม่ตัดเงินบนเว็บ — กดส่งแล้วจะเปิดไลน์พร้อมข้อความออเดอร์ ยืนยันและชำระเงินกับ Mr.Chuti โดยตรง
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
