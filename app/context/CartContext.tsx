'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'

export type CartItem = {
  id: string | number
  slug: string
  name: string
  price: number
  image_url: string | null
  stock: number
  quantity: number
}

type CartContextType = {
  items: CartItem[]
  addItem: (product: Omit<CartItem, 'quantity'>, qty?: number) => void
  removeItem: (id: CartItem['id']) => void
  updateQty: (id: CartItem['id'], qty: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
  isLoaded: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)
const STORAGE_KEY = 'chutiparts_cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setItems(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load cart from localStorage:', err)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (err) {
      console.error('Failed to save cart to localStorage:', err)
    }
  }, [items, isLoaded])

  const addItem = (
    product: Omit<CartItem, 'quantity'>,
    qty: number = 1
  ) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, product.stock)
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: newQty } : item
        )
      }
      const safeQty = Math.min(qty, product.stock)
      return [...prev, { ...product, quantity: safeQty }]
    })
  }

  const removeItem = (id: CartItem['id']) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const updateQty = (id: CartItem['id'], qty: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item
          const newQty = Math.max(1, Math.min(qty, item.stock))
          return { ...item, quantity: newQty }
        })
        .filter((item) => item.quantity > 0)
    )
  }

  const clearCart = () => {
    setItems([])
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        totalItems,
        totalPrice,
        isLoaded,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return ctx
}

