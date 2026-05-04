"use client"

import { useState } from "react"
import { useCart } from "../context/CartContext"

type Product = {
  id: string | number
  slug: string
  name: string
  price: number
  image_url: string | null
  stock: number
}

type AddToCartButtonProps = {
  product: Product
}

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const { addItem } = useCart()
  const [qty, setQty] = useState(1)
  const [justAdded, setJustAdded] = useState(false)

  // Out of stock
  if (product.stock <= 0) {
    return (
      <div className="p-4 bg-gray-100 rounded-xl text-center">
        <p className="text-gray-500 font-semibold">😢 สินค้าหมดสต็อก</p>
        <p className="text-xs text-gray-400 mt-1">
          ติดต่อร้านเพื่อสั่งจองล่วงหน้า
        </p>
      </div>
    )
  }

  const handleDecrease = () => setQty((q) => Math.max(1, q - 1))
  const handleIncrease = () => setQty((q) => Math.min(product.stock, q + 1))

  const handleAddToCart = () => {
    addItem(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        stock: product.stock,
      },
      qty
    )

    // Visual feedback
    setJustAdded(true)
    setTimeout(() => {
      setJustAdded(false)
      setQty(1) // reset
    }, 2000)
  }

  return (
    <div className="space-y-3">
      {/* Qty selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-700">จำนวน:</span>
        <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={handleDecrease}
            disabled={qty <= 1 || justAdded}
            aria-label="ลดจำนวน"
            className="px-4 py-2 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition text-gray-700 font-bold text-lg"
          >
            −
          </button>
          <span className="px-5 py-2 font-bold text-lg min-w-[60px] text-center border-x-2 border-gray-200">
            {qty}
          </span>
          <button
            onClick={handleIncrease}
            disabled={qty >= product.stock || justAdded}
            aria-label="เพิ่มจำนวน"
            className="px-4 py-2 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition text-gray-700 font-bold text-lg"
          >
            +
          </button>
        </div>
        <span className="text-xs text-gray-500">
          (มี {product.stock} ชิ้น)
        </span>
      </div>

      {/* Add to cart button */}
      <button
        onClick={handleAddToCart}
        disabled={justAdded}
        className={`w-full py-4 font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-lg ${
          justAdded
            ? "bg-green-600 text-white scale-[0.98]"
            : "bg-gray-900 hover:bg-gray-800 text-white hover:scale-[1.01]"
        }`}
      >
        {justAdded ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
            เพิ่มลงตะกร้าแล้ว!
          </>
        ) : (
          <>
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
            ใส่ตะกร้า
          </>
        )}
      </button>
    </div>
  )
}

