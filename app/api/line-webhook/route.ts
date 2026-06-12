// app/api/line-webhook/route.ts
// helper ชั่วคราว: ใช้หา LINE_ADMIN_TO (groupId/userId) ของแชนแนล Ops
// วิธีใช้: ตั้ง Webhook URL ของแชนแนลเป็น https://chutibenz.com/api/line-webhook
//   → เชิญบอทเข้ากลุ่ม แล้วพิมพ์อะไรก็ได้ในกลุ่ม → บอทจะตอบ id กลับมาให้ก๊อปไปใส่ env
// เมื่อได้ id แล้วจะปิด Webhook หรือคงไว้ก็ได้ (route นี้ไม่เก็บข้อมูลอะไร)
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: true, note: 'LINE webhook endpoint (chutibenz ops)' })
}

export async function POST(req: Request) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const events = Array.isArray(body?.events) ? body.events : []
  for (const ev of events) {
    const src = ev?.source || {}
    const id = src.groupId || src.roomId || src.userId || '(unknown)'
    const kind = src.type || 'unknown'
    console.log('[line-webhook] source:', JSON.stringify(src))

    // ตอบ id กลับเข้าแชต/กลุ่ม เพื่อให้ก๊อปไปตั้ง env LINE_ADMIN_TO
    if (token && ev?.replyToken) {
      try {
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            replyToken: ev.replyToken,
            messages: [{ type: 'text', text: `LINE_ADMIN_TO (${kind}) = ${id}` }],
          }),
        })
      } catch (e) {
        console.error('[line-webhook] reply error:', (e as Error)?.message)
      }
    }
  }

  // LINE ต้องการ 200 เสมอ
  return NextResponse.json({ ok: true })
}
