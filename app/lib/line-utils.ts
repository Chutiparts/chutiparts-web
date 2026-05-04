/**
 * Line Utility Functions
 */

import { SHOP_CONFIG } from '@/app/config/shop'
import type { CartItem } from '@/app/context/CartContext'

/**
 * สร้างข้อความรายการสินค้าจากตะกร้า
 */
export function formatCartMessage(items: CartItem[]): string {
  if (items.length === 0) {
    return 'ตะกร้าว่าง'
  }

  const header = `🛒 รายการสั่งซื้อ ${SHOP_CONFIG.name}`
  const divider = '─────────────────'

  const itemLines = items
    .map((item, index) => {
      const subtotal = item.price * item.quantity
      return [
        `${index + 1}. ${item.name}`,
        `   จำนวน: ${item.quantity} ชิ้น × ${item.price.toLocaleString()} บ.`,
        `   = ${subtotal.toLocaleString()} บาท`,
      ].join('\n')
    })
    .join('\n\n')

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalPrice = items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  )

  const summary = [
    `รวม ${items.length} รายการ (${totalItems} ชิ้น)`,
    `💰 ยอดรวม: ${totalPrice.toLocaleString()} บาท`,
  ].join('\n')

  const footer = 'รบกวนแจ้งค่าส่งครับ/ค่ะ 🙏'

  return [header, divider, itemLines, divider, summary, '', footer].join('\n')
}

/**
 * ตรวจว่าใช้บนมือถือไหม
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * เลือก Line URL ตามอุปกรณ์
 */
export function getLineUrl(): string {
  return isMobileDevice()
    ? SHOP_CONFIG.lineUrl.mobile
    : SHOP_CONFIG.lineUrl.desktop
}

/**
 * Copy ข้อความลง clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch (err) {
    console.error('Copy failed:', err)
    return false
  }
}

/**
 * เปิด Line chat
 */
export function openLineChat(): void {
  const url = getLineUrl()
  window.open(url, '_blank')
}