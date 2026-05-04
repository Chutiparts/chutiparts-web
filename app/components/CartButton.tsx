"use client"

import { useCart } from "../context/CartContext"

type CartButtonProps = {
  onClick: () => void
}

export default function CartButton({ onClick }: CartButtonProps) {
  const { totalItems, isLoaded } = useCart()

  return (
    <button
      onClick={onClick}
      aria-label={`เปิดตะกร้าสินค้า (${totalItems} รายการ)`}
      className="fixed bottom-6 right-6 z-40 group"
    >
      <div className="relative bg-white hover:bg-gray-50 shadow-2xl hover:shadow-green-200 rounded-full p-4 transition-all duration-300 group-hover:scale-110 border-2 border-gray-100">
        {/* Cart Icon (SVG) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-7 h-7 text-gray-800 group-hover:text-green-600 transition-colors"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
          />
        </svg>

        {/* Badge */}
        {isLoaded && totalItems > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 shadow-md ring-2 ring-white animate-in fade-in zoom-in duration-300">
            {totalItems > 99 ? "99+" : totalItems}
          </span>
        )}
      </div>

      {/* Tooltip on hover (desktop only) */}
      <span className="hidden md:block absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        ดูตะกร้า ({totalItems})
      </span>
    </button>
  )
}

