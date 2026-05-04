"use client"

import { useEffect } from "react"
import { useCart } from "../context/CartContext"

type CartDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQty, clearCart, totalItems, totalPrice } =
    useCart()

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [isOpen, onClose])

  // Lock body scroll when drawer open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-50 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="ตะกร้าสินค้า"
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-5 border-b border-gray-200 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
            ตะกร้า
            {totalItems > 0 && (
              <span className="bg-yellow-400 text-gray-900 text-sm px-2 py-0.5 rounded-full font-bold">
                {totalItems}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label="ปิดตะกร้า"
            className="p-2 hover:bg-gray-700 rounded-lg transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-7xl mb-4 opacity-40">🛒</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                ตะกร้าว่างเปล่า
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                เลือกสินค้าที่ต้องการ แล้วกด &quot;ใส่ตะกร้า&quot;
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition"
              >
                เลือกซื้อสินค้า
              </button>
            </div>
          ) : (
            // Items list
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.id} className="p-4 flex gap-3">
                  {/* Image */}
                  <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        🚗
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
                      {item.name}
                    </h4>
                    <p className="text-green-600 font-bold mb-2">
                      ฿{item.price.toLocaleString()}
                    </p>

                    {/* Qty Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="ลดจำนวน"
                          className="px-2.5 py-1 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition text-gray-700 font-bold"
                        >
                          −
                        </button>
                        <span className="px-3 py-1 text-sm font-semibold min-w-[40px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          aria-label="เพิ่มจำนวน"
                          className="px-2.5 py-1 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition text-gray-700 font-bold"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label={`ลบ ${item.name} จากตะกร้า`}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Stock warning */}
                    {item.quantity >= item.stock && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ ถึงจำนวนคงเหลือสูงสุดแล้ว
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <footer className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-gray-700">ยอดรวม:</span>
              <span className="text-2xl font-bold text-green-600">
                ฿{totalPrice.toLocaleString()}
              </span>
            </div>

            {/* Send to Line button (Phase 5 จะทำให้ใช้งานได้จริง) */}
            <button
              disabled
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>💬</span>
              ส่งรายการไป Line
              <span className="text-xs font-normal opacity-80">(Phase 5)</span>
            </button>

            {/* Clear cart */}
            <button
              onClick={() => {
                if (confirm("ล้างตะกร้าทั้งหมด?")) {
                  clearCart()
                }
              }}
              className="w-full py-2 text-sm text-gray-600 hover:text-red-600 transition"
            >
              ล้างตะกร้า
            </button>
          </footer>
        )}
      </aside>
    </>
  )
}

