// app/api/line/route.ts — LINE Reception Desk (เฟส 1: ค้นสต็อกจริง ไม่มี AI key)
// รับข้อความจาก LINE OA → ค้น Supabase products (แบบ SalesChat) → ตอบชื่อ+ราคา+ลิงก์
// ปลอดภัย: verify X-Line-Signature ด้วย Channel secret · อ่านอย่างเดียว (ไม่เขียน DB ในเฟสนี้)
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ⚠️ ใช้ชื่อ env แยกเฉพาะบอต ChutiBenz Ops (@311vbzok) — ไม่ชนกับ LINE_CHANNEL_ACCESS_TOKEN
// ของเว็บหลัก mr.chuti5988 (@440ifncj) ที่ใช้แจ้งเตือน lead อยู่แล้ว
const SECRET = process.env.LINE_OPS_CHANNEL_SECRET || ''
const TOKEN = process.env.LINE_OPS_CHANNEL_ACCESS_TOKEN || ''

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  return createClient(url, key, { auth: { persistSession: false } })
}

const MODELS = ['123', '124', '126', '140', '201', '202', '210', '220']
function extractCodes(text: string): string[] {
  const codes = new Set<string>()
  const re = /w?\s*([12]\d{2})/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) { if (MODELS.includes(m[1])) codes.add('W' + m[1]) }
  return [...codes]
}
function cleanKw(text: string): string {
  return text.replace(/[,()%*."'\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
}

// ดึง "เลขอะไหล่/part number" จากข้อความ (token ยาว >=5 มีเลข >=4 ตัว) — ตัด W-code/M-code 3 หลักออก
function extractPartNo(text: string): string {
  let best = ''
  for (const raw of text.split(/[\s,]+/)) {
    const tok = raw.replace(/[^A-Za-z0-9\-]/g, '')
    const digits = (tok.match(/\d/g) || []).length
    if (tok.length >= 5 && digits >= 4 && tok.length > best.length) best = tok
  }
  return best
}
// ค้นตามเลขอะไหล่ — ลองหลายชื่อคอลัมน์ (กันไม่รู้ชื่อเป๊ะ) · คอลัมน์ไม่มี = ข้ามไป
const PART_COLS = ['sku', 'part_number', 'part_no', 'partnumber', 'oem', 'oem_no']
async function searchByPart(pn: string) {
  const variants = [pn, pn.replace(/[-\s]/g, '')]
  for (const col of PART_COLS) {
    let colMissing = false
    for (const v of variants) {
      const { data, error } = await sb().from('products').select('name,name_en,price,slug').eq('is_published', true).ilike(col, `%${v}%`).limit(6)
      if (error) { colMissing = true; break }
      if (data && data.length) return data
    }
    if (colMissing) continue
  }
  return []
}

async function searchParts(text: string) {
  // 1) เลข part ก่อน (แม่นสุด)
  const pn = extractPartNo(text)
  if (pn) { const byPn = await searchByPart(pn); if (byPn.length) return byPn }
  // 2) รุ่นรถ (W-code) / 3) ชื่ออะไหล่
  const codes = extractCodes(text)
  let q = sb().from('products').select('name,name_en,price,slug,compatible_models,is_published').eq('is_published', true).limit(6)
  if (codes.length) {
    q = q.overlaps('compatible_models', codes)
  } else {
    const kw = cleanKw(text)
    if (!kw) return []
    q = q.or(`name.ilike.%${kw}%,name_en.ilike.%${kw}%`)
  }
  const { data, error } = await q
  if (error) return []
  return data || []
}

const GREETING = 'สวัสดีค่ะ 🙏 chutibenz ยินดีต้อนรับค่ะ\nต้องการอะไหล่รถรุ่นไหนคะ? พิมพ์ รุ่นรถ (เช่น W124) + ชื่ออะไหล่ หรือส่งเลข part / รูป มาได้เลยค่ะ'
const WARRANTY_DAYS = 15 // มาตรฐานร้าน — ปรับได้

function buildReply(items: any[]): string {
  if (!items.length) {
    // ไม่เจอในสต็อก = ของหมด/ยังไม่ลงระบบ → เก็บลูกค้าไว้ (แอดไลน์ + ฝากรายละเอียด)
    return 'ตอนนี้ยังไม่เจอชิ้นนี้ในสต็อกค่ะ 🙏\nรบกวนแอดไลน์ร้านไว้ พอมีของเข้ามาแล้วเราจะรีบแจ้งให้ทราบทันทีค่ะ\n\nฝาก รุ่นรถ + ปี + ชื่ออะไหล่ (หรือเลข part / รูป) ไว้ได้เลยค่ะ เดี๋ยวทีมงานเช็คให้อีกครั้ง'
  }
  let s = 'มีของค่ะ 👇\n\n'
  s += items.map((p) => `• ${p.name}${p.price ? ` — ฿${Number(p.price).toLocaleString()}` : ''}\n  https://chutibenz.com/products/${p.slug}`).join('\n\n')
  s += `\n\nทุกชิ้นรับประกัน ${WARRANTY_DAYS} วันค่ะ · สนใจชิ้นไหนแจ้งได้เลยค่ะ 😊`
  return s
}

async function replyLine(replyToken: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  }).catch(() => {})
}

export async function GET() {
  return new Response('LINE webhook OK', { status: 200 })
}

export async function POST(req: Request) {
  const bodyText = await req.text()
  // verify signature
  if (SECRET) {
    const sig = req.headers.get('x-line-signature') || ''
    const hash = crypto.createHmac('sha256', SECRET).update(bodyText).digest('base64')
    if (hash !== sig) return new Response('bad signature', { status: 401 })
  }
  let body: any
  try { body = JSON.parse(bodyText) } catch { return new Response('ok', { status: 200 }) }
  const events = body?.events || []

  for (const ev of events) {
    // ผู้ใช้แอดเพื่อน/เริ่มแชท → ทักทายก่อน (เหมือน "รับสาย")
    if (ev.type === 'follow' && ev.replyToken) {
      await replyLine(ev.replyToken, GREETING)
      continue
    }
    if (ev.type !== 'message' || !ev.replyToken) continue
    const msg = ev.message || {}
    if (msg.type === 'text') {
      const items = await searchParts(String(msg.text || ''))
      await replyLine(ev.replyToken, buildReply(items))
    } else if (msg.type === 'audio') {
      // เฟส 3 จะถอดเสียง — เฟสนี้ยังตอบแนะนำให้พิมพ์ / ทีมงานติดต่อกลับ
      await replyLine(ev.replyToken, 'รับข้อความเสียงแล้วค่ะ 🎙️ ตอนนี้ระบบยังตอบเสียงอัตโนมัติไม่ได้ — รบกวนพิมพ์ รุ่นรถ + อะไหล่ที่ต้องการมาได้เลยค่ะ หรือรอทีมงานติดต่อกลับค่ะ')
    } else if (msg.type === 'image') {
      await replyLine(ev.replyToken, 'ได้รับรูปแล้วค่ะ 📷 รบกวนพิมพ์ รุ่นรถ + ชื่ออะไหล่ (หรือเลข part) ประกอบด้วยนะคะ เดี๋ยวทีมงานเช็คสต็อกให้ค่ะ')
    } else {
      await replyLine(ev.replyToken, GREETING)
    }
  }
  return new Response('ok', { status: 200 })
}
