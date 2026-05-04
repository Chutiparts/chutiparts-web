'use client'

import { useState } from 'react'
import { useCart } from '@/app/context/CartContext'
import {
  formatCartMessage,
  copyToClipboard,
  openLineChat,
} from '@/app/lib/line-utils'

type Status = 'idle' | 'copying' | 'success' | 'error'

export default function SendToLineButton() {
  const { items } = useCart()
  const [status, setStatus] = useState<Status>('idle')

  const isEmpty = items.length === 0

  const handleSend = async () => {
    if (isEmpty || status !== 'idle') return

    setStatus('copying')

    const message = formatCartMessage(items)
    const copied = await copyToClipboard(message)

    if (!copied) {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
      return
    }

    setStatus('success')

    setTimeout(() => {
      openLineChat()
      setStatus('idle')
    }, 1200)
  }

  const buttonText = {
    idle: '💬 ส่งรายการไป Line',
    copying: '⏳ กำลัง Copy...',
    success: '✅ Copy แล้ว! เปิด Line...',
    error: '❌ Copy ไม่สำเร็จ',
  }[status]

  const buttonColor = {
    idle: 'bg-green-500 hover:bg-green-600',
    copying: 'bg-gray-400',
    success: 'bg-green-600',
    error: 'bg-red-500',
  }[status]

  return (
    <div className="space-y-2">
      <button
        onClick={handleSend}
        disabled={isEmpty || status !== 'idle'}
        className={`
          w-full py-3 px-4 rounded-lg font-medium text-white
          transition-all duration-200
          disabled:bg-gray-300 disabled:cursor-not-allowed
          ${buttonColor}
        `}
      >
        {buttonText}
      </button>

      {status === 'success' && (
        <p className="text-sm text-green-600 text-center animate-pulse">
          📋 ข้อความถูก copy แล้ว — Paste ใน Line ได้เลย!
        </p>
      )}

      {status === 'idle' && !isEmpty && (
        <p className="text-xs text-gray-500 text-center">
          กดปุ่ม → Copy รายการ → เปิด Line อัตโนมัติ
        </p>
      )}
    </div>
  )
}