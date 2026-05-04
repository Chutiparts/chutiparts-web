/**
 * Shop Configuration
 */

export const SHOP_CONFIG = {
  name: 'ChutiParts',
  tagline: 'อะไหล่ Mercedes-Benz มือสอง',
  lineId: 'mr.chuti5988',
  lineUrl: {
    mobile: 'line://ti/p/~mr.chuti5988',
    desktop: 'https://line.me/ti/p/~mr.chuti5988',
  },
  phone: '',
} as const

export type ShopConfig = typeof SHOP_CONFIG