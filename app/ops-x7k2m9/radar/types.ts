export type RadarItem = { tier: number; part: string; model: string; metric: string; action: string; score: number }
export type RadarResult = {
  ok: boolean
  sent?: boolean
  dry?: boolean
  error?: string
  message?: string
  reason?: string
  count?: number
  top?: RadarItem[]
}
