/**
 * Shop Configuration
 */

export const SHOP_CONFIG = {
  name: 'ChutiBenz',
  tagline: 'อะไหล่ Mercedes-Benz มือสอง',
  lineId: '@440ifncj',
  lineUrl: {
    mobile: 'https://line.me/R/ti/p/%40440ifncj',
    desktop: 'https://line.me/R/ti/p/%40440ifncj',
  },
  phone: '',
} as const

export type ShopConfig = typeof SHOP_CONFIG