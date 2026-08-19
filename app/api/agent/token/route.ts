// app/api/agent/token/route.ts
// มินต์ LiveKit access token ให้เบราว์เซอร์ต่อเข้าห้อง voice (server-only · API secret ไม่หลุดไปเบราว์เซอร์)
// agent worker (agent.py) จะถูก LiveKit dispatch เข้าห้องเดียวกันอัตโนมัติ
import { NextResponse, type NextRequest } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { randomUUID } from 'crypto'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'sin1' // co-locate กับ Supabase ap-southeast-1 (Singapore) — ลด latency query
const noStore = { 'Cache-Control': 'no-store' as const }

export async function POST(req: NextRequest) {
  const url = process.env.LIVEKIT_URL
  const key = process.env.LIVEKIT_API_KEY
  const secret = process.env.LIVEKIT_API_SECRET
  if (!url || !key || !secret) {
    return NextResponse.json({ error: 'voice_not_configured' }, { status: 503, headers: noStore })
  }

  // กันสแปม/คุมค่าใช้จ่าย: 10 สาย / 10 นาที / IP
  const ip = clientIp(req)
  if (!(await rateLimit(`agent-token:${ip}`, 10, 600))) {
    return NextResponse.json({ error: 'rate_limited', retry_after: 600 }, { status: 429, headers: noStore })
  }

  const room = `voice-${randomUUID().slice(0, 8)}`
  const identity = `web-${randomUUID().slice(0, 8)}`

  const at = new AccessToken(key, secret, { identity, ttl: '15m' })
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })
  const token = await at.toJwt()

  return NextResponse.json({ token, url, room, identity }, { headers: noStore })
}
