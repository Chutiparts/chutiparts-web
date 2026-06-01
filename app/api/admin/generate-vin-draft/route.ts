// app/api/admin/generate-vin-draft/route.ts — V4.3 + LASTVIN
// Phase 2 — 2026-06-01
// V4.3 Changes (over V4.2):
// - SCOPE: VIN decode ONLY (no maintenance, no pricing, no warnings)
// - SOURCE: LastVIN.com (POST + scrape) as primary, AI fallback
// - OUTPUT: LastVIN-style English tables + Thai footer + soft CTAs
// - REMOVED: market prices, maintenance advice, common problems
// - ADDED: complete option code listing (paint, interior, all factory options)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ════════════════════════════════════════════════════════════
// HARDCODED CONTACT INFO (NEVER CHANGE THESE)
// LINE ID: @mr.chuti5988
// Phone:   081-828-5855
// Website: chutibenz.com
// Email:   tookjai5988@gmail.com
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// LASTVIN.COM INTEGRATION
// ════════════════════════════════════════════════════════════

interface LastVinData {
  general: Record<string, string>;
  options: Array<{ code: string; description: string }>;
  sourceUrl: string;
}

async function fetchLastVin(vin: string): Promise<LastVinData | null> {
  try {
    const formData = new URLSearchParams();
    formData.append('vin', vin);

    const res = await fetch('https://www.lastvin.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: formData.toString(),
      redirect: 'follow',
    });

    if (!res.ok) {
      console.error(`[LastVIN] POST failed: ${res.status}`);
      return null;
    }

    const finalUrl = res.url;
    if (!finalUrl.includes('/vin/')) {
      console.error('[LastVIN] No redirect to /vin/ — VIN not in LastVIN DB');
      return null;
    }

    const html = await res.text();
    return parseLastVinHtml(html, finalUrl);
  } catch (err: any) {
    console.error(`[LastVIN] Error: ${err.message}`);
    return null;
  }
}

function parseLastVinHtml(html: string, sourceUrl: string): LastVinData {
  const general: Record<string, string> = {};
  const options: Array<{ code: string; description: string }> = [];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      cells.push(text);
    }

    if (cells.length !== 2) continue;
    const [a, b] = cells;
    if (a === 'Code' && b === 'Description') continue;
    if (a === 'General Data') continue;
    if (!a || !b) continue;

    if (/^\d{3,4}[A-Z]?$/.test(a)) {
      options.push({ code: a, description: b });
    } else {
      general[a] = b;
    }
  }

  return { general, options, sourceUrl };
}

// ════════════════════════════════════════════════════════════
// STOCK QUERY (for soft CTA)
// ════════════════════════════════════════════════════════════

async function getRelevantStock(chassis: string | null): Promise<any[]> {
  if (!chassis) return [];

  const variants = [chassis, chassis.toUpperCase(), chassis.toLowerCase()]
    .filter((v, i, arr) => arr.indexOf(v) === i);

  try {
    const orFilter = variants.map((v) => `chassis.cs.{${v}}`).join(',');
    const { data } = await supabase
      .from('products')
      .select('part_number, name, price, stock_status, chassis')
      .or(orFilter)
      .limit(5);
    return data || [];
  } catch (err) {
    console.error('[Stock] query failed:', err);
    return [];
  }
}

// ════════════════════════════════════════════════════════════
// SYSTEM PROMPT (V4.3)
// ════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are Mr.Chuti, owner of ChutiBenz (chutibenz.com).
Thailand's leading Mercedes-Benz classic parts specialist with 10+ years experience.
You personally own a Mercedes W140 S70 AMG (V12, 7L) — 1 of only 27 made worldwide.
Author of "W140 Buyer Guide" (80+ pages) and "W124 M119 eBook".

You're responding to a Mercedes enthusiast's VIN check request.

═══════════════════════════════════════════════
ABSOLUTE RULES (V4.3 — DO NOT VIOLATE)
═══════════════════════════════════════════════

1. SCOPE = VIN DECODE ONLY (factual data)
   ✓ Model, engine code, transmission, paint, interior, options, dates, order location
   ✗ NEVER discuss: maintenance, common problems, biodegradable wiring, oil leaks
   ✗ NEVER discuss: market prices, repair costs, service estimates, "what to watch for"
   ✗ NEVER add: investment opinions, buyer advice, comparisons

   If customer asks about problems → redirect to "ส่งอาการรถ" feature (in footer).

2. FORMAT = LASTVIN-STYLE
   - Markdown tables exactly mirroring LastVIN.com structure
   - English technical data (codes, model names, paint codes)
   - DO NOT translate option descriptions to Thai
   - Thai language ONLY in footer (greetings + CTAs + signature)

3. DATA COMPLETENESS = CRITICAL
   - Paint · interior · options are THE CORE VALUE (like seeing inside a house before buying)
   - If LastVIN data available → list ALL options (every single code)
   - Never abbreviate, never say "and more" — list everything

4. HARDCODED CONTACT (NEVER CHANGE)
   LINE ID: @mr.chuti5988
   Phone:   081-828-5855
   Website: chutibenz.com

5. SPELLING
   ✓ Mercedes (not BMW)
   ✓ แชสซี / W140 / S-Class
   ✓ Professional Thai — no slang

═══════════════════════════════════════════════
OUTPUT TEMPLATE (PRIMARY — WITH LASTVIN DATA)
═══════════════════════════════════════════════

สวัสดีครับ คุณ {customer_name}
ขอบคุณที่ส่ง VIN มาตรวจสอบครับ

## Datacard

| Field | Value |
|---|---|
| FIN | {vin} |
| Model | {Model from LastVIN} |
| Engine | {Engine from LastVIN} |
| Transmission | {Transmission from LastVIN} |
| Order Number | {Order Number from LastVIN} |
| Order Location | {Order Location from LastVIN} |
| Interior | {Interior from LastVIN} |
| Paint 1 | {Paint 1 from LastVIN} |
| Delivery Date | {Delivery Date from LastVIN} |
| Approx. Build Date | {Approx. Build Date from LastVIN} |

## Option Codes ({total_count})

| Code | Description |
|---|---|
{ALL options from LastVIN, one row each — do NOT abbreviate}

---

💡 บริการเพิ่มเติม

🔧 อยากปรึกษาอาการรถ → "ส่งอาการรถ" (กำลังเปิดให้บริการ)
📦 ดูอะไหล่ W140 ในสต็อก → https://chutibenz.com/products
📱 LINE: @mr.chuti5988

— Mr.Chuti, ChutiBenz
Thailand's Mercedes Classic Parts Specialist
10+ ปีในวงการ · W140 S70 AMG (1 of 27 worldwide)
ผู้เขียน W140 Buyer Guide (80+ pages) & W124 M119 eBook

═══════════════════════════════════════════════
FALLBACK TEMPLATE (NO LASTVIN DATA)
═══════════════════════════════════════════════

If LastVIN lookup failed, use:

สวัสดีครับ คุณ {customer_name}
ขอบคุณที่ส่ง VIN มาตรวจสอบครับ

⚠ ขออภัย ระบบ datacard ไม่สามารถค้น VIN นี้ได้ในขณะนี้

## VIN Structure (Basic Decode)

| Field | Value |
|---|---|
| FIN | {vin} |
| Manufacturer | WDB = Mercedes-Benz AG Germany |
| Chassis Series | {chassis from pos 4-6} |
| Body Code | {body code from pos 7-9} |
| Plant | {pos 11 = factory letter} |
| Serial | {pos 12-17} |

## ต้องการข้อมูลครบ?

📷 Upload Data Card → ผมถอด options + สี + ภายใน ครบทุก code ภายใน 10 วินาที

[footer same as primary template]
`;

// ════════════════════════════════════════════════════════════
// POST HANDLER
// ════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return NextResponse.json({ error: .eq('id', request_id) }, { status: 400 });
    }

    // 1. Get request from DB
    const { data: vinRequest, error: fetchError } = await supabase
      .from('vin_check_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchError || !vinRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // 2. Fetch LastVIN data (primary source)
    let lastVinData: LastVinData | null = null;
    try {
      lastVinData = await fetchLastVin(vinRequest.vin);
    } catch (err: any) {
      console.error('LastVIN fetch failed:', err.message);
    }

    // 3. Get stock context (for soft CTA)
    const stock = await getRelevantStock(vinRequest.car_model);

    // 4. Build user message
    let userMessage = `Customer info:
- Name: ${vinRequest.name}
- Contact: ${vinRequest.contact}
- VIN: ${vinRequest.vin}
- Stated model: ${vinRequest.car_model || '(not provided)'}
- Stated year: ${vinRequest.car_year || '(not provided)'}
- Question: ${vinRequest.questions || '(none)'}

`;

    if (lastVinData) {
      userMessage += `═══ LASTVIN DATACARD (USE AS PRIMARY SOURCE) ═══
Source: ${lastVinData.sourceUrl}

GENERAL DATA:
${Object.entries(lastVinData.general)
  .map(([k, v]) => `  ${k}: ${v}`)
  .join('\n')}

OPTION CODES (${lastVinData.options.length} total):
${lastVinData.options.map((o) => `  ${o.code} — ${o.description}`).join('\n')}

═══ END LASTVIN DATA ═══

Use PRIMARY TEMPLATE. Format the data into the exact markdown tables.
Keep all technical fields in English. Thai only in footer.
List ALL ${lastVinData.options.length} option codes — do not abbreviate.`;
    } else {
      userMessage += `═══ NO LASTVIN DATA (lookup failed) ═══

Use FALLBACK TEMPLATE. Decode VIN structure from your Mercedes knowledge (basic only).
Strongly recommend Upload Data Card.`;
    }

    if (stock.length > 0) {
      userMessage += `\n\nNOTE: ${stock.length} parts available for this chassis in our catalog. Do NOT list them in main output — the soft CTA link is sufficient.`;
    }

    // 5. Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errorText = await claudeRes.text();
      console.error('Claude API error:', errorText);
      return NextResponse.json(
        { error: 'AI service error', detail: errorText },
        { status: 500 }
      );
    }

    const result = await claudeRes.json();
    const draft = result.content[0].text;

    // 6. Save draft to DB
    const aiModel = lastVinData
      ? 'claude-sonnet-4-6-v4.3-lastvin'
      : 'claude-sonnet-4-6-v4.3-fallback';

    await supabase
      .from('vin_check_requests')
      .update({
        ai_draft: draft,
        ai_generated_at: new Date().toISOString(),
        ai_model: aiModel,
        external_lookup_result: lastVinData
          ? `lastvin-ok: ${lastVinData.sourceUrl} (${lastVinData.options.length} options)`
          : 'lastvin-failed',
      })
      .eq('id', request_id);

    return NextResponse.json({
      success: true,
      draft,
      model: 'claude-sonnet-4-6',
      lastvin_used: !!lastVinData,
      option_count: lastVinData?.options.length ?? 0,
    });
  } catch (err: any) {
    console.error('VIN draft generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
