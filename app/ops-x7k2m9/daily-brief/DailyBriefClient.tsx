'use client'
// app/ops-x7k2m9/daily-brief/DailyBriefClient.tsx — Command Center P0 (อ่านล้วน + copy/export)
// รวมงานเช้าจาก Lead & Follow-up + Task Ops มาหน้าเดียว: ต้องตาม/ต้องทำ/เกินกำหนด/ไม่มีเจ้าของ/ตัดสินใจ/เสี่ยง
// rule-based ล้วน (ไม่มี AI จริง) · ไม่ส่งข้อความ/แจ้งเตือนจริง · ไม่ลบ/แก้ข้อมูล · map สถานะให้ตรงกับ 2 โมดูลเดิม
import { useMemo, useState } from 'react'

type Row = Record<string, any>
const GREEN = '#17301F', BRASS = '#B8895A', CREAM = '#F4EFE4'

// ===== Lead status (ตรงกับ PartsDeskClient) =====
const LEAD_STATUS: Record<string, string> = {
  new: 'ใหม่', quoted: 'ส่งรูป/ราคาแล้ว', deciding: 'รอตัดสินใจ', to_follow: 'ต้องตาม', won: 'ปิดการขาย ✓', lost: 'ไม่ซื้อ',
}
const LEGACY: Record<string, string> = { contacted: 'quoted', waiting: 'deciding' }
const normStatus = (s?: string) => { const k = LEGACY[s || ''] || s || 'new'; return LEAD_STATUS[k] ? k : 'new' }
const leadStatusTh = (l: Row) => LEAD_STATUS[normStatus(l.status)]

// ===== Task status/priority (ตรงกับ TaskOps) =====
const TASK_STATUS: Record<string, string> = {
  todo: 'ยังไม่เริ่ม', doing: 'กำลังทำ', waiting: 'รอข้อมูล/ลูกค้า', done: 'เสร็จแล้ว ✓', cancelled: 'ยกเลิก',
}
const TASK_PRIORITY: Record<string, { th: string; bg: string; fg: string }> = {
  high: { th: 'ด่วน', bg: '#FCEBEB', fg: '#A32D2D' },
  medium: { th: 'ปกติ', bg: '#FAEEDA', fg: '#854F0B' },
  low: { th: 'ต่ำ', bg: '#F1EFE8', fg: '#5F5E5A' },
}

const todayStr = () => new Date().toISOString().slice(0, 10)
function shiftStr(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10) }
function daysSince(d?: string | null) { if (!d) return 999; return Math.floor((Date.now() - new Date(d).getTime()) / 86400000) }
function fmtDate(d?: string | null) { if (!d) return '-'; const x = new Date(d); return `${x.getDate()}/${x.getMonth() + 1}` }

// ----- lead helpers -----
const leadOpen = (l: Row) => !['won', 'lost'].includes(normStatus(l.status))
const leadOverdue = (l: Row) => leadOpen(l) && !!l.follow_due && l.follow_due < todayStr()
const leadDueToday = (l: Row) => leadOpen(l) && l.follow_due === todayStr()
const leadNoOwner = (l: Row) => leadOpen(l) && (!l.owner || !String(l.owner).trim())
const partOf = (l: Row) => l.part_wanted || l.part_number || 'อะไหล่'
const contactOf = (l: Row) => l.line_id || l.phone || l.contact_value || '-'
function followMsgTH(l: Row) {
  return `สวัสดีครับ ขออนุญาตติดตามเรื่องอะไหล่ Mercedes-Benz ที่สอบถามไว้ครับ\nรายการ: ${partOf(l)}\nรุ่นรถ: ${l.car_model || '-'}\nหากยังสนใจอยู่ ผมช่วยเช็กของ/รูป/ราคาให้ต่อได้ครับ`
}

// ----- task helpers -----
const taskOpen = (t: Row) => !['done', 'cancelled'].includes(t.status || 'todo')
const taskOverdue = (t: Row) => taskOpen(t) && !!t.due_date && t.due_date < todayStr()
const taskDueToday = (t: Row) => taskOpen(t) && t.due_date === todayStr()
const taskNoOwner = (t: Row) => taskOpen(t) && (!t.owner || !String(t.owner).trim())

// ----- reorder helpers (สรุปย่อจาก Stock Source · เกณฑ์ default: ย้อนหลัง 90 วัน · ขายดี ≥2 · เหลือน้อย ≤1) -----
const rNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }
const rNorm = (s?: any) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const rKey = (part: any, model: any) => rNorm(part) + '|' + rNorm(model)
function reorderSignals(sales: Row[], stock: Row[]): Row[] {
  const cutoff = shiftStr(-90)
  const left: Record<string, number> = {}
  stock.forEach((s) => { if (String(s.status || 'in_stock') === 'in_stock') { const k = rKey(s.part_name, s.car_model); left[k] = (left[k] || 0) + 1 } })
  const g: Record<string, any> = {}
  sales.forEach((r) => {
    if (!r.sale_date || r.sale_date < cutoff) return
    const k = rKey(r.part_sold, r.car_model)
    if (!g[k]) g[k] = { key: k, part: r.part_sold || '(ไม่ระบุ)', model: r.car_model || '', sold: 0, sumProfit: 0 }
    g[k].sold += 1; g[k].sumProfit += rNum(r.sale_price) - rNum(r.cost)
  })
  return Object.values(g)
    .map((x: any) => ({ ...x, left: left[x.key] || 0 }))
    .filter((x: any) => x.left <= 1)
    .map((x: any) => ({ ...x, urgent: x.left === 0 && x.sold >= 2 }))
    .sort((a: any, b: any) => (a.urgent === b.urgent ? b.sold - a.sold : a.urgent ? -1 : 1))
}

// ----- product helpers (Level B: merge สัญญาณเสี่ยงจาก Risk Guard · อ่าน defensive) -----
const pName = (p: Row) => p.name || p.name_en || p.title || '(ไม่มีชื่อ)'
const pPart = (p: Row) => p.part_number || p.sku || p.oem_number || p.oem || p.part_no || ''
const pModel = (p: Row) => p.car_model || (Array.isArray(p.compatible_models) ? p.compatible_models.join('/') : p.compatible_models) || ''
const pPrice = (p: Row) => { const n = Number(p.price); return isNaN(n) ? 0 : n }
const pImg = (p: Row) => p.image_url || p.image || p.cover_image || ''
const pPublished = (p: Row) => p.is_published === true || p.is_published === 'true' || p.published === true
const pCreated = (p: Row) => p.created_at || null
const pUpdated = (p: Row) => p.updated_at || p.created_at || null
const pDaysSince = (d?: string | null) => { if (!d) return null; const t = new Date(d).getTime(); if (isNaN(t)) return null; return Math.floor((Date.now() - t) / 86400000) }
const AGED_DAYS = 365, STALE_DAYS = 45 // เกณฑ์ default เดียวกับ Risk Guard (ปรับเกณฑ์ละเอียดที่หน้า Risk Guard)

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7e3d8', borderRadius: 8, padding: '9px 11px', marginBottom: 6 }
const qbtn: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', color: '#333', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }

// ===== Crisis Watch playbooks (P0 live: lead + task) — เกณฑ์ owner เคาะ 18 ก.ค. 2026 =====
// อ่านล้วนจาก props เดิม (leads/tasks) · ไม่มี SQL/fetch ใหม่ · playbook เต็ม 5 เรื่องอยู่ที่ products/crisis-watch/CRISIS-BRIEFS-ChutiBenz-5playbooks.md
type CrisisBrief = { title: string; first15: string[]; templates: { label: string; body: string }[]; notSay: string[]; escalation: string }
const CRISIS_BRIEFS: Record<string, CrisisBrief> = {
  lead: {
    title: 'ลูกค้าทักแล้วหลุด',
    first15: [
      'เปิดลิสต์ lead ค้าง เรียงตามลำดับซื้อสูง',
      'ตามกลุ่มซื้อสูงก่อน: ส่งราคาแล้ว/รอตัดสินใจที่เงียบ → ถามรุ่นมูลค่าสูง (W140/W126/เครื่อง/ล้อแม็ก) → รายใหม่',
      'ก๊อปข้อความทักกลับ ปรับชื่อ/รุ่น',
      'มอบเจ้าของเคส 1 คนต่อ 1 lead',
      'ตั้งวันตามครั้งถัดไป กันหลุดซ้ำ',
    ],
    templates: [{ label: 'ข้อความทักกลับ (ไทย)', body: 'สวัสดีครับ ขออนุญาตติดตามเรื่องอะไหล่ Mercedes-Benz ที่สอบถามไว้ครับ\nรายการ: [ชิ้น]\nรุ่นรถ: [รุ่น]\nหากยังสนใจอยู่ ผมช่วยเช็กของ/รูป/ราคาให้ต่อได้ครับ' }],
    notSay: ['“ทำไมเงียบไป”', '“ยังเอาอยู่ไหม” (กดดัน)', 'ทิ้งไว้เฉย ๆ ไม่ตาม'],
    escalation: 'lead มูลค่าสูงค้าง >3 วัน → แจ้ง Mr.Chuti',
  },
  task: {
    title: 'งานหลุดเพราะไม่มีคนถือ',
    first15: [
      'เปิดงานที่ไม่มี owner → assign ทันทีทีละงาน',
      'งานเกินกำหนด → เคาะปิดวันนี้ หรือเลื่อนวันใหม่ (อย่าปล่อยลอย)',
      'งานด่วน (high) ที่ค้าง → ดันขึ้นก่อน',
      'กำหนดคน update สถานะ',
      'เช็กว่างานที่หายกระทบ Daily Brief ตรงไหน',
    ],
    templates: [{ label: 'ข้อความแจ้งทีม', body: 'ขอเคลียร์งานค้างครับ: งานที่ไม่มีเจ้าของจะ assign ให้ทีละคน · งานเกินกำหนดขอปิดวันนี้หรือเลื่อนวันใหม่ · ช่วยอัปเดตสถานะในระบบด้วยครับ' }],
    notSay: ['สั่งงานปากเปล่าไม่ลงระบบ', 'ปล่อยงานไม่มีเจ้าของข้ามวัน'],
    escalation: 'งานด่วนไม่มีคนรับ >1 วัน → Mr.Chuti',
  },
  stock: {
    title: 'ของมีแต่ลูกค้ามองไม่เห็น',
    first15: [
      'ดูรุ่นที่ลูกค้าถามเข้ามา (leads) เทียบกับของในสต็อกที่ยังไม่มีรูป',
      'ถ่ายรูปชิ้นที่ตรงดีมานด์ก่อน (ไม่ไล่ถ่ายตามลำดับคลัง)',
      'ชิ้นมูลค่าสูง/หายากของรุ่นนั้นก่อน (W140/W126 ตามคลื่น Q4)',
      'ขึ้นเว็บ + ตั้งราคา (ต้นทุนครบ)',
      'assign คนถ่าย/คนลงเว็บ',
    ],
    templates: [{ label: 'ข้อความมอบงานถ่ายรูป', body: 'ฝากถ่ายรูปอะไหล่ที่ลูกค้าถามบ่อยแต่ยังไม่มีรูปบนเว็บครับ\nรุ่น: [รุ่น]\nถ่ายชิ้นมูลค่าสูง/หายากก่อน มุมชัด ๆ 2-3 รูป แล้วส่งให้ลงเว็บ + ตั้งราคา' }],
    notSay: ['ปล่อยของดีไม่มีรูปค้างเป็นเดือน', 'ลงเว็บไม่ใส่ราคา'],
    escalation: 'ลูกค้าถามซ้ำแต่ร้านไม่มีของ → แจ้ง Mr.Chuti จัดหา',
  },
  profit: {
    title: 'ขายแล้วไม่รู้กำไรจริง',
    first15: [
      'เปิดรายการที่ขาดทุน/margin บาง — เช็กว่าผูก landed cost ครบไหม (เฟรต + surcharge + ค่าใน)',
      'margin บาง = ต้นทุนแฝงตกหล่น → เติมต้นทุนให้ครบก่อน (ไม่ใช่สัญญาณให้ลดราคา)',
      'ตั้งราคาจากต้นทุนครบตั้งแต่แรก',
      'ลูกค้าต่อราคา → ยึดราคา (การลด = เฉพาะโปรที่ตั้งใจ)',
      'บันทึกค่าที่ตกหล่นไว้ ใช้ตั้งราคาล็อตหน้า',
    ],
    templates: [{ label: 'เช็กลิสต์ต้นทุนก่อนตั้งราคา', body: 'ก่อนปิดการขาย/ตั้งราคา เช็ก landed cost จริง: ราคาทุนอะไหล่ + ค่าเฟรต + fuel surcharge + ค่าใน (ขนส่งในประเทศ/แพ็ก) แล้วบวก margin กรอบปลอดภัย · ไม่ลดราคายกเว้นช่วงโปร' }],
    notSay: ['ลดราคาสุ่มตอนต่อรอง', 'ตั้งราคาจากความรู้สึกไม่ดูต้นทุน'],
    escalation: 'จะลดนอกโปร = ต้องผ่าน Mr.Chuti คนเดียว',
  },
  web: {
    title: 'ลูกค้าเข้าเว็บแล้วหลุด (เว็บ/ฟอร์ม/ค้นหา)',
    first15: [
      'เปิด Search Demand ดูคำค้น "ไม่เจอ" — คำไหนซ้ำบ่อย',
      'คำที่ไม่เจอ + คนถามจริง = ดีมานด์หลุด → จัดหาของ/ลงเว็บ/ทำคอนเทนต์',
      'ทดสอบฟอร์ม lead ส่งเข้าไหม (ส่ง 1 ครั้ง) + CTA (LINE/WhatsApp) กดไปถูกที่ไหม',
      'eBook funnel เดินไหม (add friend → ส่ง PDF)',
      'เป็นบั๊ก → แจ้ง dev · เป็นของขาด → แจ้งทีมขาย',
    ],
    templates: [{ label: 'ข้อความแจ้ง dev/ทีม', body: 'เจอคำค้นที่ลูกค้าหาแต่เว็บไม่เจอ ขอช่วยเช็ก: (1) มีของแต่ยังไม่ลงเว็บไหม (2) ควรจัดหามาขายไหม (3) ฟอร์ม/CTA ทำงานปกติไหม' }],
    notSay: ['ปล่อยฟอร์มเสียข้ามวัน (lead หายเงียบ)', 'เพิกเฉยคำค้นไม่เจอ'],
    escalation: 'lead route/ฟอร์มเสีย = เลือดไหล → แจ้ง dev + owner ทันที',
  },
}

export default function DailyBriefClient({ leads, tasks, sales = [], stock = [], products = [], searches = [] }: { leads: Row[]; tasks: Row[]; sales?: Row[]; stock?: Row[]; products?: Row[]; searches?: Row[] }) {
  const [toast, setToast] = useState('')
  const [openBrief, setOpenBrief] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600) }
  const copy = (text: string, m = 'คัดลอกแล้ว') => navigator.clipboard?.writeText(text).then(() => flash(m))

  const leadName = (id?: string) => { if (!id) return ''; const l = leads.find((x) => x.id === id); return l ? (l.name || '(lead)') : '' }
  const leadModelPart = (id?: string) => { const l = leads.find((x) => x.id === id); return l ? `${partOf(l)}${l.car_model ? ` (${l.car_model})` : ''}` : '' }

  // ===== buckets =====
  const B = useMemo(() => {
    const todayFollow = leads.filter(leadDueToday)
    const overdueLeads = leads.filter(leadOverdue)
    const todayTasks = tasks.filter(taskDueToday)
    const overdueTasks = tasks.filter(taskOverdue)
    const unassignedLeads = leads.filter(leadNoOwner)
    const unassignedTasks = tasks.filter(taskNoOwner)

    // Decision Needed — rule-based
    const decide: { key: string; label: string; reason: string }[] = []
    const cut2 = shiftStr(-2) // เกินกำหนด "มากกว่า 2 วัน" = follow_due/due_date < วันนี้-2
    leads.forEach((l) => {
      if (leadOpen(l) && normStatus(l.status) === 'deciding' && daysSince(l.last_activity_at || l.created_at) > 3)
        decide.push({ key: 'L' + l.id, label: `${l.name || '(ไม่ระบุ)'} — ${partOf(l)}${l.car_model ? ` (${l.car_model})` : ''}`, reason: 'ลูกค้ารอตัดสินใจ > 3 วัน' })
      else if (leadOverdue(l) && l.follow_due < cut2)
        decide.push({ key: 'L' + l.id, label: `${l.name || '(ไม่ระบุ)'} — ${partOf(l)}`, reason: `Lead เกินกำหนดตาม > 2 วัน (${fmtDate(l.follow_due)})` })
    })
    tasks.forEach((t) => {
      if (taskOpen(t) && (t.priority || 'medium') === 'high')
        decide.push({ key: 'T' + t.id, label: `${t.title || '(ไม่มีชื่องาน)'}${t.owner ? ` · ${t.owner}` : ''}`, reason: 'งานด่วน (high) ยังไม่เสร็จ' })
      else if (taskOverdue(t) && t.due_date < cut2)
        decide.push({ key: 'T' + t.id, label: `${t.title || '(ไม่มีชื่องาน)'}`, reason: `Task เกินกำหนด > 2 วัน (${fmtDate(t.due_date)})` })
    })

    return { todayFollow, overdueLeads, todayTasks, overdueTasks, unassignedLeads, unassignedTasks, decide }
  }, [leads, tasks])

  const unassignedCount = B.unassignedLeads.length + B.unassignedTasks.length
  const reorder = useMemo(() => reorderSignals(sales, stock), [sales, stock])
  // 📦 คงเหลือจากชีต (stock_records.qty ที่ sync จากแท็บ Stock) — อ่านตรงตาม SKU ไม่พึ่งชื่อยอดขาย
  // Path B: คงเหลือจริง = รับเข้า (stock.qty จากชีต) − ขาย (นับ sales_records ตาม sku · 1 แถว=1 ชิ้น)
  const soldBySku = useMemo(() => { const m: Record<string, number> = {}; (sales || []).forEach((r) => { const k = String(r.sku || '').trim().toUpperCase(); if (k) m[k] = (m[k] || 0) + 1 }); return m }, [sales])
  const sheetStock = useMemo(() => stock.filter((s) => s.qty != null && !isNaN(Number(s.qty))).map((s) => { const received = Number(s.qty); const sold = soldBySku[String(s.sku || '').trim().toUpperCase()] || 0; return { sku: s.sku || '', name: s.part_name || '(ไม่ระบุ)', model: s.car_model || '', received, sold, qty: received - sold, location: s.location || '' } }), [stock, soldBySku])
  const lowStock = useMemo(() => sheetStock.filter((x) => x.qty <= 1).sort((a, b) => a.qty - b.qty), [sheetStock])
  const totalUnits = useMemo(() => sheetStock.reduce((s, x) => s + x.qty, 0), [sheetStock])
  const reorderUrgent = reorder.filter((x) => x.urgent).length

  // ===== Product risk buckets (Level B: merge จาก Risk Guard) =====
  const P = useMemo(() => {
    const pub = products.filter(pPublished)
    const aged = pub.filter((p) => { const d = pDaysSince(pCreated(p)); return d !== null && d >= AGED_DAYS })
      .sort((a, b) => (pDaysSince(pCreated(b)) || 0) - (pDaysSince(pCreated(a)) || 0))
    const stale = pub.filter((p) => { const d = pDaysSince(pUpdated(p)); return d !== null && d >= STALE_DAYS })
      .sort((a, b) => (pDaysSince(pUpdated(b)) || 0) - (pDaysSince(pUpdated(a)) || 0))
    const incomplete = pub.filter((p) => !pImg(p) || pPrice(p) <= 0)
    return { pubCount: pub.length, aged, stale, incomplete }
  }, [products])
  const stockRiskCount = P.aged.length + P.stale.length + P.incomplete.length

  // ===== Copy Daily Brief (รูปแบบตามสเปก) =====
  function briefText() {
    const fl = B.todayFollow.length
      ? B.todayFollow.map((l) => `- ${l.name || '(ไม่ระบุ)'} / ${l.car_model || '-'} / ${partOf(l)} / เจ้าของ: ${l.owner || 'ยังไม่มี'}`).join('\n')
      : '- ไม่มีรายการ'
    const tk = B.todayTasks.length
      ? B.todayTasks.map((t) => `- ${t.title || '(ไม่มีชื่องาน)'} / เจ้าของ: ${t.owner || 'ยังไม่มี'} / ความสำคัญ: ${TASK_PRIORITY[t.priority || 'medium'].th}`).join('\n')
      : '- ไม่มีรายการ'
    const dc = B.decide.length ? B.decide.map((d) => `- ${d.label} (${d.reason})`).join('\n') : '- ไม่มีรายการ'
    const ro = reorder.length
      ? reorder.slice(0, 5).map((x) => `- ${x.part}${x.model ? ` (${x.model})` : ''} — ขาย ${x.sold} ครั้ง/90วัน เหลือ ${x.left}${x.urgent ? ' 🔴 ควรหาด่วน' : ''}`).join('\n')
      : '- ไม่มีรายการ'
    return [
      `สรุปงาน ChutiBenz วันนี้ (${new Date().toLocaleDateString('th-TH')})`, '',
      '1) ลูกค้าที่ต้องตามวันนี้', fl, '',
      '2) งานที่ต้องทำวันนี้', tk, '',
      '3) เกินกำหนด', `- Lead overdue: ${B.overdueLeads.length}`, `- Task overdue: ${B.overdueTasks.length}`, '',
      '4) งานยังไม่มีเจ้าของ', `- ${unassignedCount} รายการ`, '',
      '5) เรื่องที่ควรตัดสินใจ', dc, '',
      '6) ของควรหา/สั่งเพิ่ม', ro, '',
      '7) สต็อกเสี่ยง (Risk Guard)',
      `- ค้างนาน ≥${AGED_DAYS}วัน: ${P.aged.length} · ไม่อัปเดต ≥${STALE_DAYS}วัน: ${P.stale.length} · ข้อมูลไม่ครบ: ${P.incomplete.length}`, '',
      'หมายเหตุ: AI ช่วยสรุป เจ้าของเป็นผู้ตัดสินใจ',
    ].join('\n')
  }

  // ===== Exports =====
  function dl(name: string, text: string, type: string) {
    const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u)
  }
  function exportTxt() { dl(`daily-brief-${todayStr()}.txt`, '\uFEFF' + briefText(), 'text/plain;charset=utf-8') }
  function briefData() {
    return {
      generated_at: new Date().toISOString(),
      counts: {
        today_follow_ups: B.todayFollow.length, overdue_leads: B.overdueLeads.length,
        today_tasks: B.todayTasks.length, overdue_tasks: B.overdueTasks.length,
        unassigned: unassignedCount, decision_needed: B.decide.length,
      },
      today_follow_ups: B.todayFollow.map((l) => ({ name: l.name || null, channel: contactOf(l), car_model: l.car_model || null, part: partOf(l), owner: l.owner || null, follow_due: l.follow_due || null, status: normStatus(l.status) })),
      overdue_leads: B.overdueLeads.map((l) => ({ name: l.name || null, part: partOf(l), car_model: l.car_model || null, owner: l.owner || null, follow_due: l.follow_due || null, status: normStatus(l.status) })),
      today_tasks: B.todayTasks.map((t) => ({ title: t.title || null, owner: t.owner || null, due_date: t.due_date || null, priority: t.priority || 'medium', status: t.status || 'todo', linked_lead: leadName(t.linked_lead_id) || null })),
      overdue_tasks: B.overdueTasks.map((t) => ({ title: t.title || null, owner: t.owner || null, due_date: t.due_date || null, priority: t.priority || 'medium', status: t.status || 'todo' })),
      unassigned_work: [
        ...B.unassignedLeads.map((l) => ({ type: 'lead', name: l.name || null, detail: partOf(l), status: normStatus(l.status) })),
        ...B.unassignedTasks.map((t) => ({ type: 'task', name: t.title || null, detail: t.task_type || null, status: t.status || 'todo' })),
      ],
      decision_needed: B.decide.map((d) => ({ item: d.label, reason: d.reason })),
    }
  }
  function exportJson() { dl(`daily-brief-${todayStr()}.json`, JSON.stringify(briefData(), null, 2), 'application/json') }
  function exportCsv() {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows: string[][] = [['section', 'name/title', 'owner', 'due', 'status', 'detail']]
    B.todayFollow.forEach((l) => rows.push(['today_follow', l.name || '', l.owner || '', l.follow_due || '', leadStatusTh(l), partOf(l)]))
    B.overdueLeads.forEach((l) => rows.push(['overdue_lead', l.name || '', l.owner || '', l.follow_due || '', leadStatusTh(l), partOf(l)]))
    B.todayTasks.forEach((t) => rows.push(['today_task', t.title || '', t.owner || '', t.due_date || '', TASK_STATUS[t.status || 'todo'], TASK_PRIORITY[t.priority || 'medium'].th]))
    B.overdueTasks.forEach((t) => rows.push(['overdue_task', t.title || '', t.owner || '', t.due_date || '', TASK_STATUS[t.status || 'todo'], TASK_PRIORITY[t.priority || 'medium'].th]))
    dl(`daily-brief-${todayStr()}.csv`, '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }

  // ===== Risk / Reminder =====
  const risks: string[] = []
  if (B.overdueLeads.length) risks.push(`🔴 Lead เกินกำหนดตาม ${B.overdueLeads.length} รายการ`)
  if (B.overdueTasks.length) risks.push(`🔴 งานเกินกำหนด ${B.overdueTasks.length} รายการ`)
  if (unassignedCount) risks.push(`⚠️ งาน/ลูกค้ายังไม่มีเจ้าของ ${unassignedCount} รายการ`)
  if (B.decide.length) risks.push(`🧭 รอการตัดสินใจ ${B.decide.length} รายการ`)
  if (reorderUrgent) risks.push(`ของขายดีแต่หมดสต็อก ${reorderUrgent} รายการ — ควรหาเพิ่ม`)
  if (P.aged.length) risks.push(`📦 ของค้างนาน ≥${AGED_DAYS} วัน ${P.aged.length} รายการ — เงินจม`)
  if (P.incomplete.length) risks.push(`🖼️ ข้อมูลไม่ครบ (ไม่มีรูป/ราคา) ${P.incomplete.length} รายการ — ขายยากบนเว็บ`)

  // ===== Crisis Watch — สัญญาณเสี่ยงวันนี้ (P0 live: Lead + Task · read-only จาก props) =====
  const daysSinceContact = (l: Row) => daysSince(l.last_activity_at || l.updated_at || l.created_at)
  const crisisLead = leads.filter((l) => leadOpen(l) && (leadOverdue(l) || (!l.follow_due && daysSinceContact(l) >= 1)))
  const crisisTaskNoOwner = tasks.filter(taskNoOwner)
  const crisisTaskOverdueOwned = tasks.filter((t) => taskOverdue(t) && !!t.owner && !!String(t.owner).trim())
  const crisisSignals: { brief: string; sev: 'red' | 'yellow'; title: string }[] = []
  if (crisisLead.length >= 5) crisisSignals.push({ brief: 'lead', sev: 'red', title: `Lead ค้างไม่ได้ตาม >24 ชม. ${crisisLead.length} ราย` })
  else if (crisisLead.length >= 2) crisisSignals.push({ brief: 'lead', sev: 'yellow', title: `Lead ค้างไม่ได้ตาม >24 ชม. ${crisisLead.length} ราย` })
  if (crisisTaskNoOwner.length >= 1) crisisSignals.push({ brief: 'task', sev: 'red', title: `งานไม่มีเจ้าของ ${crisisTaskNoOwner.length} งาน${crisisTaskOverdueOwned.length ? ` · เกินกำหนด ${crisisTaskOverdueOwned.length}` : ''}` })
  else if (crisisTaskOverdueOwned.length >= 3) crisisSignals.push({ brief: 'task', sev: 'yellow', title: `งานเกินกำหนด ${crisisTaskOverdueOwned.length} งาน` })
  // Stock (P2 · read-only จาก props): รุ่นที่ลูกค้าถาม (leads) × ของ published ไม่มีรูป ≥3 ชิ้น = ของมีแต่มองไม่เห็น
  const crisisNorm = (s: any) => String(s || '').trim().toUpperCase()
  const demandByModel: Record<string, number> = {}
  leads.forEach((l) => { if (leadOpen(l) && l.car_model) { const m = crisisNorm(l.car_model); demandByModel[m] = (demandByModel[m] || 0) + 1 } })
  searches.filter((r) => daysSince(r.created_at) <= 30).forEach((r) => { if (r.model) { const m = crisisNorm(r.model); demandByModel[m] = (demandByModel[m] || 0) + 1 } })
  const noPhotoByModel: Record<string, number> = {}
  products.filter((p) => pPublished(p) && !pImg(p)).forEach((p) => { const m = crisisNorm(pModel(p)); if (m) noPhotoByModel[m] = (noPhotoByModel[m] || 0) + 1 })
  const stockHidden = Object.keys(noPhotoByModel)
    .filter((m) => noPhotoByModel[m] >= 3 && (demandByModel[m] || 0) >= 1)
    .map((m) => ({ model: m, noPhoto: noPhotoByModel[m] }))
    .sort((a, b) => b.noPhoto - a.noPhoto)
  if (stockHidden.length >= 1) crisisSignals.push({ brief: 'stock', sev: 'yellow', title: `ของไม่มีรูปตรงรุ่นที่ลูกค้าถาม/ค้น: ${stockHidden.slice(0, 3).map((h) => `${h.model} ${h.noPhoto} ชิ้น`).join(' · ')}` })
  // Web (P2b · read-only จาก search_queries): คำค้นที่ลูกค้าหาแต่ "ไม่เจอ" สะสม = ดีมานด์หลุด/เว็บไม่มีของ
  const searchRecent = searches.filter((r) => daysSince(r.created_at) <= 30)
  const notFoundQ = new Set(searchRecent.filter((r) => !(r.had_results === true || r.had_results === 'true')).map((r) => crisisNorm(r.query_text)).filter((q) => q))
  if (notFoundQ.size >= 3) crisisSignals.push({ brief: 'web', sev: 'yellow', title: `คำค้นที่ลูกค้าหาแต่ไม่เจอ ${notFoundQ.size} คำ (30 วัน) — ดีมานด์หลุด/เว็บไม่มีของ` })
  // Profit (P2b · read-only จาก sales 90 วัน): ขายขาดทุน (แดง) / กำไรบางผิดปกติ <15% (เหลือง) · cost=0 (ของดิจิทัล) ไม่นับ · policy ไม่ลดราคายกเว้นโปร
  const crisisMargin = (r: Row) => { const sp = Number(r.sale_price) || 0; if (sp <= 0) return null; return (sp - (Number(r.cost) || 0)) / sp }
  const salesRecent = sales.filter((r) => r.sale_date && daysSince(r.sale_date) <= 90)
  const lossSales = salesRecent.filter((r) => { const m = crisisMargin(r); return m !== null && m < 0 })
  const thinSales = salesRecent.filter((r) => { const m = crisisMargin(r); return m !== null && m >= 0 && m < 0.15 && (Number(r.cost) || 0) > 0 })
  if (lossSales.length >= 1) crisisSignals.push({ brief: 'profit', sev: 'red', title: `ขายขาดทุน ${lossSales.length} รายการ (90 วัน) — เช็กต้นทุน/ราคาด่วน` })
  else if (thinSales.length >= 1) crisisSignals.push({ brief: 'profit', sev: 'yellow', title: `กำไรบางผิดปกติ (<15%) ${thinSales.length} รายการ — เช็ก landed cost ครบไหม` })

  const goto = (anchor: string) => {
    if (anchor.startsWith('/')) { window.location.href = anchor; return }
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const stat = (label: string, val: number, color: string, anchor?: string) => (
    <div
      onClick={anchor ? () => goto(anchor) : undefined}
      title={anchor ? 'กดเพื่อดูรายละเอียด' : undefined}
      style={{ flex: 1, minWidth: 88, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #e7e3d8', cursor: anchor ? 'pointer' : 'default', transition: 'box-shadow .15s,transform .15s' }}
      onMouseEnter={anchor ? (e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 3px 10px rgba(0,0,0,.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' } : undefined}
      onMouseLeave={anchor ? (e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.transform = 'none' } : undefined}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
      <div style={{ fontSize: 11, color: '#777' }}>{label}</div>
    </div>
  )

  // ===== 🎯 Top 5 วันนี้ (เรียงตาม impact: เงิน>lead มูลค่าสูง>ไม่มีเจ้าของ>overdue>สต็อกหมด) =====
  const hiVal = (m?: string) => /W140|W126|W120|W119|M104|M119|M120|เครื่อง|ล้อ|AMG/i.test(String(m || ''))
  type TopItem = { key: string; icon: string; color: string; bg: string; title: string; detail: string; action: string; owner: string; score: number; copyText?: string }
  const topItems: TopItem[] = []
  const seenLead = new Set<string>(); const seenTask = new Set<string>()
  if (lossSales.length) topItems.push({ key: 'loss', icon: '💰', color: '#A32D2D', bg: '#FCEBEB', title: `ขายขาดทุน ${lossSales.length} รายการ (90 วัน)`, detail: 'ราคาต่ำกว่าต้นทุน — เช็คต้นทุน/การตั้งราคา', action: 'เช็คต้นทุน', owner: 'wait', score: 1000 + Math.min(lossSales.length * 10, 150) })
  else if (thinSales.length) topItems.push({ key: 'thin', icon: '💰', color: '#854F0B', bg: '#FAEEDA', title: `กำไรบางผิดปกติ ${thinSales.length} รายการ (<15%)`, detail: 'อาจมีต้นทุนแฝงตกหล่น — เช็ค landed cost', action: 'เช็คต้นทุน', owner: 'wait', score: 940 })
  crisisLead.forEach((l) => {
    const d = daysSinceContact(l); const v = hiVal(l.car_model) || hiVal(partOf(l))
    topItems.push({ key: 'L' + l.id, icon: '📞', color: '#0C447C', bg: '#E6F1FB', title: `ตามลูกค้า: ${l.name || '(ไม่ระบุ)'}`, detail: `${partOf(l)}${l.car_model ? ` · ${l.car_model}` : ''} · ค้าง ${d} วัน · ${contactOf(l)}`, action: 'โทร/ทักกลับ', owner: leadNoOwner(l) ? 'none' : (l.owner || ''), score: 800 + Math.min(d * 5, 100) + (v ? 60 : 0), copyText: followMsgTH(l) })
    seenLead.add(String(l.id))
  })
  B.unassignedLeads.forEach((l) => { if (seenLead.has(String(l.id))) return; topItems.push({ key: 'UL' + l.id, icon: '🧑‍🔧', color: '#A32D2D', bg: '#FCEBEB', title: `lead ไม่มีเจ้าของ: ${l.name || '(ไม่ระบุ)'}`, detail: `${partOf(l)}${l.car_model ? ` · ${l.car_model}` : ''}`, action: 'Assign owner', owner: 'none', score: 600 }) })
  B.unassignedTasks.forEach((t) => { seenTask.add(String(t.id)); topItems.push({ key: 'UT' + t.id, icon: '🧑‍🔧', color: '#A32D2D', bg: '#FCEBEB', title: `งานไม่มีเจ้าของ: ${t.title || '(ไม่มีชื่องาน)'}`, detail: t.task_type || 'งาน', action: 'Assign owner', owner: 'none', score: 590 }) })
  B.overdueTasks.forEach((t) => { if (seenTask.has(String(t.id))) return; topItems.push({ key: 'OT' + t.id, icon: '⏰', color: '#854F0B', bg: '#FAEEDA', title: `งานเกินกำหนด: ${t.title || '(ไม่มีชื่องาน)'}`, detail: `กำหนด ${fmtDate(t.due_date)}`, action: 'ปิดงาน/เลื่อน', owner: (t.owner && String(t.owner).trim()) ? t.owner : 'none', score: 400 + Math.min(daysSince(t.due_date) * 3, 100) }) })
  sheetStock.filter((x) => x.qty === 0).forEach((x) => { const dem = demandByModel[String(x.model).toUpperCase()] || 0; topItems.push({ key: 'S' + x.sku, icon: '📦', color: '#A32D2D', bg: '#FCEBEB', title: `สต็อกหมด: ${x.name}`, detail: `${x.model} · SKU ${x.sku}${dem ? ` · มีคนถาม/ค้น ${dem}` : ''}`, action: dem ? 'หาเพิ่มด่วน' : 'หาเพิ่ม/ถ่ายรูป', owner: 'wait', score: 200 + (dem ? 80 : 0) }) })
  const top5 = [...topItems].sort((a, b) => b.score - a.score).slice(0, 5)
  const dhLeadNoNext = leads.filter((l) => leadOpen(l) && !l.follow_due).length
  const dhTaskStale = tasks.filter((t) => taskOpen(t) && daysSince(t.updated_at || t.created_at) >= 3).length
  const dhCostMissing = sales.filter((r) => Number(r.sale_price) > 0 && r.cost == null).length
  // 📊 สรุปร้าน (สำหรับภาพรวม/FC demo)
  const _month = new Date().toISOString().slice(0, 7)
  const salesMonth = (sales || []).filter((r) => String(r.sale_date || '').startsWith(_month))
  const revMonth = salesMonth.reduce((a, r) => a + (Number(r.sale_price) || 0), 0)
  const profitMonth = salesMonth.reduce((a, r) => a + ((Number(r.sale_price) || 0) - (Number(r.cost) || 0)), 0)
  const outCount = sheetStock.filter((x) => x.qty <= 0).length
  const sellMap: Record<string, number> = {}; (sales || []).forEach((r) => { const k = String(r.part_sold || r.sku || 'อะไหล่'); sellMap[k] = (sellMap[k] || 0) + 1 })
  const topSellers = Object.entries(sellMap).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const bahtN = (n: number) => '฿' + Math.round(n).toLocaleString()

  return (
    <div style={{ minHeight: '100vh', background: CREAM, fontFamily: '-apple-system,"Segoe UI","Noto Sans Thai",sans-serif', color: '#1a1a1a' }}>
      <div style={{ background: GREEN, color: '#fff', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>☀️ Daily Brief — Command Center</div>
            <div style={{ fontSize: 12, color: '#cbd8cf' }}>สรุปเช้า ChutiBenz · เปิดหน้าเดียวรู้ว่าต้องทำอะไรวันนี้ · {new Date().toLocaleDateString('th-TH')}</div>
            {/* P0.1 legend สีธง — ข้อความเดียวกันทุกหน้า */}
            <div style={{ fontSize: 11.5, color: '#a9bfb1', marginTop: 4 }}>🔴 = ต้องทำทันที · 🟡 = ควรระวัง/ติดตาม · 🟢 = ปกติ/พอใช้</div>
          </div>
          <a href="/ops-x7k2m9/parts-desk" style={{ ...qbtn, textDecoration: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>→ ไป Parts Desk (จัดการ)</a>
        </div>
      </div>

      <div style={{ padding: 12, maxWidth: 960, margin: '0 auto' }}>
        {/* 🎯 Top 5 วันนี้ — hero (มือถืออ่าน 10 วิ) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: GREEN, marginBottom: 8 }}>🎯 วันนี้ทำอะไรก่อน — Top {top5.length}</div>
          {top5.length === 0 ? (
            <div style={{ ...card, color: '#0F6E56' }}>✅ ไม่มีเรื่องด่วนวันนี้ — เยี่ยม!</div>
          ) : top5.map((it, i) => (
            <div key={it.key} style={{ ...card, borderLeft: `4px solid ${it.color}`, padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 20, lineHeight: '22px' }}>{it.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{i + 1}. {it.title}</div>
                  <div style={{ fontSize: 12.5, color: '#555', marginTop: 2 }}>{it.detail}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 7 }}>
                    <span style={{ background: it.bg, color: it.color, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>→ {it.action}</span>
                    {it.owner === 'none' ? <span style={{ fontSize: 11.5, color: '#A32D2D', fontWeight: 600 }}>🔴 ไม่มีเจ้าของ</span>
                      : it.owner === 'wait' ? <span style={{ fontSize: 11.5, color: '#854F0B', fontWeight: 600 }}>⏳ รอเจ้าของตัดสินใจ</span>
                      : <span style={{ fontSize: 11.5, color: '#0F6E56', fontWeight: 600 }}>👤 {it.owner}</span>}
                    {it.copyText && <button onClick={() => copy(it.copyText || '', 'คัดลอกข้อความแล้ว')} style={{ ...qbtn, padding: '3px 9px', fontSize: 11.5 }}>คัดลอกข้อความ</button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div style={{ ...card, background: '#fbfaf6', fontSize: 12, color: '#7c4a13', marginTop: 4 }}>
            🩺 <b>Data Health:</b> lead ไม่มีนัดตาม {dhLeadNoNext} · task ไม่อัปเดต ≥3 วัน {dhTaskStale} · ต้นทุนว่าง {dhCostMissing}{(dhLeadNoNext + dhTaskStale + dhCostMissing) === 0 ? ' · ✅ ข้อมูลครบดี' : ''}
          </div>
          <div style={{ ...card, marginTop: 4, padding: '10px 12px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: GREEN, marginBottom: 6 }}>📊 สรุปร้านเดือนนี้</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 90, textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: GREEN }}>{salesMonth.length}</div><div style={{ fontSize: 11, color: '#777' }}>ขายได้ (รายการ)</div></div>
              <div style={{ flex: 1, minWidth: 90, textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#0C447C' }}>{bahtN(revMonth)}</div><div style={{ fontSize: 11, color: '#777' }}>ยอดขาย</div></div>
              <div style={{ flex: 1, minWidth: 90, textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#0F6E56' }}>{bahtN(profitMonth)}</div><div style={{ fontSize: 11, color: '#777' }}>กำไร</div></div>
              <div style={{ flex: 1, minWidth: 90, textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#A32D2D' }}>{outCount}</div><div style={{ fontSize: 11, color: '#777' }}>ของหมด (SKU)</div></div>
            </div>
            {topSellers.length > 0 && <div style={{ fontSize: 11.5, color: '#666', marginTop: 6 }}>🏆 ขายดี: {topSellers.map(([k, n]) => `${k} (${n})`).join(' · ')}</div>}
          </div>
          <button onClick={() => setShowDetail((s) => !s)} style={{ ...qbtn, marginTop: 8, width: '100%' }}>{showDetail ? '▲ ซ่อนรายละเอียด' : '▼ ดูรายละเอียดทั้งหมด (สัญญาณ / สต็อก / งานค้าง)'}</button>
        </div>

        {showDetail && (<>
        {/* Crisis Watch — สัญญาณเสี่ยงวันนี้ (บนสุด) */}
        <div style={{ marginBottom: 14 }}>
          {crisisSignals.length === 0 ? (
            <div style={{ ...card, color: '#0F6E56', fontSize: 12.5 }}>✅ วันนี้ไม่มีสัญญาณเสี่ยง — ร้านปกติ</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e7e3d8', borderRadius: 10, padding: '11px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: GREEN }}>สัญญาณเสี่ยงวันนี้</span>
                <span style={{ marginLeft: 'auto', background: '#FAEEDA', color: '#854F0B', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999 }}>{crisisSignals.length} เรื่อง</span>
              </div>
              {crisisSignals.map((s) => {
                const b = CRISIS_BRIEFS[s.brief]
                const isRed = s.sev === 'red'
                const isOpen = openBrief === s.brief
                return (
                  <div key={s.brief} style={{ background: isRed ? '#FCEBEB' : '#FAEEDA', borderLeft: `3px solid ${isRed ? '#A32D2D' : '#854F0B'}`, padding: '9px 11px', marginBottom: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: isRed ? '#501313' : '#412402' }}>{s.title}</div>
                    <div style={{ fontSize: 12.5, color: isRed ? '#791F1F' : '#633806', margin: '2px 0 8px' }}>→ เปิด “{b.title}”</div>
                    <button onClick={() => setOpenBrief(isOpen ? '' : s.brief)} style={{ ...qbtn, padding: '5px 11px', fontSize: 12 }}>{isOpen ? 'ซ่อน checklist' : 'ดู checklist 15 นาทีแรก'}</button>
                    {isOpen && (
                      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '9px 11px', marginTop: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: GREEN, marginBottom: 4 }}>15 นาทีแรก</div>
                        <ol style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 12.5, color: '#333', lineHeight: 1.7 }}>
                          {b.first15.map((x, i) => <li key={i}>{x}</li>)}
                        </ol>
                        {b.templates.map((tp, i) => (
                          <div key={i} style={{ marginBottom: 6 }}>
                            <button onClick={() => copy(tp.body, 'คัดลอก ' + tp.label)} style={{ ...qbtn, padding: '4px 10px', fontSize: 11.5 }}>📋 คัดลอก: {tp.label}</button>
                          </div>
                        ))}
                        <div style={{ fontSize: 12, color: '#A32D2D', marginTop: 4 }}><b>ห้ามพูด:</b> {b.notSay.join(' · ')}</div>
                        <div style={{ fontSize: 12, color: '#633806', marginTop: 3 }}><b>Escalation:</b> {b.escalation}</div>
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>เกณฑ์: Lead ≥5 แดง/2–4 เหลือง · งานไม่มีเจ้าของ ≥1 แดง/เกินกำหนด ≥3 เหลือง · ของไม่มีรูป ≥3 ตรงรุ่นที่ลูกค้าถาม/ค้น เหลือง · คำค้นไม่เจอ ≥3 คำ เหลือง · ขายขาดทุน แดง/กำไรต่ำกว่า 15% เหลือง · playbook เต็ม 5 เรื่องในคลัง</div>
            </div>
          )}
        </div>

        {/* stat strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {stat('ตามวันนี้', B.todayFollow.length, '#0C447C', 'sec-today-follow')}
          {stat('งานวันนี้', B.todayTasks.length, GREEN, 'sec-today-tasks')}
          {stat('Lead เกิน', B.overdueLeads.length, '#A32D2D', 'sec-overdue-leads')}
          {stat('Task เกิน', B.overdueTasks.length, '#A32D2D', 'sec-overdue-tasks')}
          {stat('ไม่มีเจ้าของ', unassignedCount, '#854F0B', 'sec-unassigned')}
          {stat('ต้องตัดสินใจ', B.decide.length, '#3C3489', 'sec-decide')}
          {stat('สต็อกเสี่ยง', P.aged.length + P.incomplete.length, '#7A4E12', 'sec-stock-risk')}
          {sheetStock.length > 0 && stat('คงเหลือน้อย/หมด', lowStock.length, '#A32D2D', 'sec-sheet-stock')}
        </div>

        {/* quick actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => copy(briefText(), 'คัดลอกสรุปวันนี้แล้ว')} style={{ flex: 1, minWidth: 160, background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>📋 คัดลอกสรุปวันนี้</button>
          <button onClick={exportTxt} style={qbtn}>⬇ TXT</button>
          <button onClick={exportJson} style={qbtn}>⬇ JSON</button>
          <button onClick={exportCsv} style={qbtn}>⬇ CSV</button>
        </div>

        {/* 7) Risk / Reminder — ขึ้นบนสุดให้เห็นก่อน */}
        <Section title="⚠️ ความเสี่ยง / เตือนความจำ" count={risks.length}>
          {risks.length === 0
            ? <div style={{ ...card, color: '#0F6E56' }}>✅ ยังไม่มีสัญญาณเตือนสำคัญ</div>
            : risks.map((r, i) => <div key={i} style={{ ...card, fontSize: 13.5 }}>{r}</div>)}
        </Section>

        {/* 1) Today Follow-ups */}
        <Section id="sec-today-follow" title="📅 ลูกค้าที่ต้องตามวันนี้" count={B.todayFollow.length}>
          {B.todayFollow.length === 0 ? <Empty /> : B.todayFollow.map((l) => (
            <div key={l.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 14 }}>{l.name || '(ไม่ระบุชื่อ)'}</b>
                <Badge label={leadStatusTh(l)} bg="#E6F1FB" fg="#0C447C" />
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>{partOf(l)} · {l.car_model || 'รุ่น —'} · {contactOf(l)}</div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: leadNoOwner(l) ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>{leadNoOwner(l) ? 'ยังไม่มีเจ้าของ' : `👤 ${l.owner}`}</span>
                <span style={{ color: '#0C447C' }}>📅 ตาม {fmtDate(l.follow_due)}</span>
                <button onClick={() => copy(followMsgTH(l), 'คัดลอกข้อความตาม (ไทย)')} style={{ ...qbtn, padding: '3px 9px', fontSize: 11.5 }}>คัดลอก follow-up</button>
              </div>
            </div>
          ))}
        </Section>

        {/* 2) Overdue Leads */}
        <Section id="sec-overdue-leads" title="🔴 Lead เกินกำหนดตาม" count={B.overdueLeads.length}>
          {B.overdueLeads.length === 0 ? <Empty /> : B.overdueLeads.map((l) => (
            <div key={l.id} style={{ ...card, borderLeft: '4px solid #A32D2D' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 14 }}>{l.name || '(ไม่ระบุชื่อ)'}</b>
                <Badge label={`เลย ${fmtDate(l.follow_due)}`} bg="#FCEBEB" fg="#A32D2D" />
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>{partOf(l)} · {l.car_model || '—'} · {contactOf(l)}</div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: leadNoOwner(l) ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>{leadNoOwner(l) ? 'ยังไม่มีเจ้าของ' : `👤 ${l.owner}`}</span>
                <Badge label={leadStatusTh(l)} bg="#F1EFE8" fg="#5F5E5A" />
                <button onClick={() => copy(followMsgTH(l), 'คัดลอกข้อความตาม (ไทย)')} style={{ ...qbtn, padding: '3px 9px', fontSize: 11.5 }}>คัดลอก follow-up</button>
              </div>
            </div>
          ))}
        </Section>

        {/* 3) Today Tasks */}
        <Section id="sec-today-tasks" title="🗂️ งานที่ต้องทำวันนี้" count={B.todayTasks.length}>
          {B.todayTasks.length === 0 ? <Empty /> : B.todayTasks.map((t) => <TaskRow key={t.id} t={t} leadModelPart={leadModelPart} />)}
        </Section>

        {/* 4) Overdue Tasks */}
        <Section id="sec-overdue-tasks" title="🔴 งานเกินกำหนด" count={B.overdueTasks.length}>
          {B.overdueTasks.length === 0 ? <Empty /> : B.overdueTasks.map((t) => <TaskRow key={t.id} t={t} overdue leadModelPart={leadModelPart} />)}
        </Section>

        {/* 5) Unassigned Work */}
        <Section id="sec-unassigned" title="🧑‍🔧 งานยังไม่มีเจ้าของ" count={unassignedCount}>
          {unassignedCount === 0 ? <Empty /> : (
            <>
              {B.unassignedLeads.map((l) => (
                <div key={'ul' + l.id} style={card}>
                  <span style={{ fontSize: 11, color: '#0C447C', fontWeight: 700 }}>LEAD</span> <b style={{ fontSize: 13.5 }}>{l.name || '(ไม่ระบุ)'}</b>
                  <span style={{ fontSize: 12.5, color: '#555' }}> — {partOf(l)}{l.car_model ? ` (${l.car_model})` : ''} · {leadStatusTh(l)}</span>
                </div>
              ))}
              {B.unassignedTasks.map((t) => (
                <div key={'ut' + t.id} style={card}>
                  <span style={{ fontSize: 11, color: BRASS, fontWeight: 700 }}>TASK</span> <b style={{ fontSize: 13.5 }}>{t.title || '(ไม่มีชื่องาน)'}</b>
                  <span style={{ fontSize: 12.5, color: '#555' }}> — {t.task_type || 'งาน'} · {TASK_STATUS[t.status || 'todo']}</span>
                </div>
              ))}
            </>
          )}
        </Section>

        {/* 6) Decision Needed */}
        <Section id="sec-decide" title="🧭 เรื่องที่ควรตัดสินใจวันนี้" count={B.decide.length}>
          {B.decide.length === 0 ? <Empty /> : B.decide.map((d) => (
            <div key={d.key} style={{ ...card, borderLeft: '4px solid #3C3489' }}>
              <b style={{ fontSize: 13.5 }}>{d.label}</b>
              <div style={{ fontSize: 11.5, color: '#3C3489', marginTop: 2 }}>เหตุผล: {d.reason}</div>
            </div>
          ))}
        </Section>

        {/* 7) ควรสั่งเพิ่ม (จาก Stock Source) */}
        <Section title="🛒 ของควรหา/สั่งเพิ่ม" count={reorder.length}>
          {reorder.length === 0 ? <Empty /> : (
            <>
              {reorder.slice(0, 5).map((x) => (
                <div key={x.key} style={{ ...card, borderLeft: `4px solid ${x.urgent ? '#A32D2D' : '#854F0B'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <b style={{ fontSize: 13.5 }}>{x.part}{x.model ? ` · ${x.model}` : ''}</b>
                    <Badge label={x.urgent ? '🔴 ขายดี ของหมด' : '🟡 เหลือน้อย'} bg={x.urgent ? '#FCEBEB' : '#FAEEDA'} fg={x.urgent ? '#A32D2D' : '#854F0B'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: '#555', marginTop: 2 }}>ขาย {x.sold} ครั้ง/90วัน · เหลือ {x.left} ชิ้น{x.sold > 0 && x.sumProfit > 0 ? ` · กำไรเฉลี่ย ฿${Math.round(x.sumProfit / x.sold).toLocaleString()}/ชิ้น` : ''}</div>
                </div>
              ))}
              <a href="/ops-x7k2m9/stock-source" style={{ ...qbtn, display: 'inline-block', textDecoration: 'none', marginTop: 2 }}>→ ดูทั้งหมดที่ Stock Source</a>
            </>
          )}
        </Section>

        {/* 📦 คงเหลือจากชีต (SKU) — คงเหลือน้อย/หมด · อ่านจาก stock_records.qty ที่ sync จากแท็บ Stock */}
        {sheetStock.length > 0 && (
          <Section id="sec-sheet-stock" title="📦 คงเหลือน้อย/หมด (จากชีต · ตาม SKU)" count={lowStock.length}>
            <div style={{ fontSize: 11.5, color: '#888', marginBottom: 6 }}>คงเหลือจริงรวม {totalUnits} ชิ้น · คงเหลือ = รับเข้า − ขาย (เว็บคิดให้ · Path B) · แสดงเฉพาะคงเหลือ ≤ 1</div>
            {lowStock.length === 0 ? <div style={{ ...card, color: '#0F6E56', fontSize: 12.5 }}>✅ ไม่มีรายการคงเหลือน้อย/หมด</div> : lowStock.map((x) => (
              <div key={x.sku} style={{ ...card, borderLeft: `4px solid ${x.qty === 0 ? '#A32D2D' : '#854F0B'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 13.5 }}>{x.name}{x.model ? ` · ${x.model}` : ''}</b>
                  <Badge label={x.qty === 0 ? '🔴 หมด' : `🟡 เหลือ ${x.qty}`} bg={x.qty === 0 ? '#FCEBEB' : '#FAEEDA'} fg={x.qty === 0 ? '#A32D2D' : '#854F0B'} />
                </div>
                <div style={{ fontSize: 11.5, color: '#888', marginTop: 2 }}>SKU {x.sku}{x.location ? ` · ที่เก็บ ${x.location}` : ''} · รับเข้า {x.received} − ขาย {x.sold}</div>
              </div>
            ))}
          </Section>
        )}

        {/* 8) สต็อกเสี่ยง — Level B merge จาก Risk Guard */}
        <Section id="sec-stock-risk" title="🛡️ สต็อกเสี่ยง (Risk Guard)" count={stockRiskCount}>
          {stockRiskCount === 0 ? <Empty /> : (
            <>
              <RiskMini title="📦 ค้างนาน" items={P.aged} kind="aged" />
              <RiskMini title="🖼️ ข้อมูลไม่ครบ" items={P.incomplete} kind="incomplete" />
              <RiskMini title="🕸️ ไม่อัปเดตนาน" items={P.stale} kind="stale" />
              <a href="/ops-x7k2m9/risk-guard" style={{ ...qbtn, display: 'inline-block', textDecoration: 'none', marginTop: 2 }}>→ ดูทั้งหมด/ปรับเกณฑ์ที่ Risk Guard</a>
            </>
          )}
        </Section>

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '10px 0 30px' }}>
          AI ช่วยสรุป · เจ้าของเป็นผู้ตัดสินใจ · หน้านี้อ่านอย่างเดียว จัดการงานจริงที่ Parts Desk
        </div>
        </>)}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: GREEN, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, zIndex: 20 }}>{toast}</div>}
    </div>
  )
}

function Section({ title, count, children, id }: { title: string; count: number; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} style={{ marginBottom: 16, scrollMarginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: GREEN, marginBottom: 6 }}>{title} <span style={{ color: '#999', fontWeight: 400 }}>({count})</span></div>
      {children}
    </div>
  )
}
function Empty() { return <div style={{ ...card, color: '#aaa', fontSize: 12.5 }}>— ไม่มีรายการ —</div> }

// Level B: มินิรายการสัญญาณเสี่ยงสต็อก (โชว์ 3 อันแรก + ลิงก์ไป Risk Guard)
function RiskMini({ title, items, kind }: { title: string; items: Row[]; kind: 'aged' | 'stale' | 'incomplete' }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7A4E12', margin: '4px 0 3px' }}>{title} ({items.length})</div>
      {items.slice(0, 3).map((p, i) => (
        <div key={p.id || i} style={{ ...card, marginBottom: 4, borderLeft: '4px solid #854F0B' }}>
          <b style={{ fontSize: 13 }}>{pName(p)}</b>
          <span style={{ fontSize: 12, color: '#666' }}>
            {pPart(p) ? ` [${pPart(p)}]` : ''}{pModel(p) ? ` · ${pModel(p)}` : ''}
            {kind === 'aged' ? ` · ค้าง ${pDaysSince(pCreated(p))} วัน`
              : kind === 'stale' ? ` · อัปเดตล่าสุด ${pDaysSince(pUpdated(p))} วัน`
              : (!pImg(p) ? ' · ไม่มีรูป' : ' · ไม่มีราคา')}
          </span>
        </div>
      ))}
      {items.length > 3 && <div style={{ fontSize: 11.5, color: '#999', paddingLeft: 2 }}>…และอีก {items.length - 3} รายการ</div>}
    </div>
  )
}

function TaskRow({ t, overdue, leadModelPart }: { t: Row; overdue?: boolean; leadModelPart: (id?: string) => string }) {
  const pr = TASK_PRIORITY[t.priority || 'medium']
  const link = t.linked_lead_id ? leadModelPart(t.linked_lead_id) : ''
  return (
    <div style={{ ...card, borderLeft: overdue ? '4px solid #A32D2D' : '4px solid ' + BRASS }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <b style={{ fontSize: 14 }}>{t.title || '(ไม่มีชื่องาน)'}</b>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={pr.th} bg={pr.bg} fg={pr.fg} />
          <Badge label={TASK_STATUS[t.status || 'todo']} bg="#EEF0F3" fg="#455" />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: '#999', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {t.task_type && <span>{t.task_type}</span>}
        <span style={{ color: (!t.owner || !String(t.owner).trim()) ? '#A32D2D' : '#0F6E56', fontWeight: 600 }}>{(!t.owner || !String(t.owner).trim()) ? 'ยังไม่มีเจ้าของ' : `👤 ${t.owner}`}</span>
        <span style={{ color: overdue ? '#A32D2D' : '#0C447C' }}>📅 {fmtDate(t.due_date)}{overdue ? ' (เกิน)' : ''}</span>
        {link && <span style={{ color: BRASS }}>🔗 {link}</span>}
      </div>
    </div>
  )
}
