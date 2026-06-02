// app/api/admin/generate-vin-draft/route.ts — V4.4 CLEAN (Phase 1 + 5)
// Phase 2 — 2026-06-01
//
// V4.4 CLEAN — Single-paste full rewrite. No incremental patches.
//
// Architecture (per chutibenz-vin-field-list-schema-pack.md):
// - VIN_STANDARD: NHTSA (free, basic fields)
// - MB_BUILD: Apify Universal Bypasser (free, when lastvin_url provided)
// - MB_OPTION_MASTER: vin_option_master dictionary
// - SHOP_LOGIC: Sonnet 4.6 AI formatter
// - Cache: vin_vehicles + related tables (Mercedes data doesn't change)
//
// POST body accepts:
//   { request_id }              → Phase 1: NHTSA only
//   { request_id, lastvin_url } → Phase 1+5: full datacard via Apify
//
// Required Vercel env vars:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SECRET_KEY
//   ANTHROPIC_API_KEY
//   APIFY_API_TOKEN

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
// CORS — allow HTML tool from local file:// origin
// ════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonWithCors(body: any, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ════════════════════════════════════════════════════════════
// HARDCODED CONTACT INFO (NEVER CHANGE)
// LINE ID: @mr.chuti5988
// Phone:   081-828-5855
// Website: chutibenz.com
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

type SeriesCode = 'W201' | 'W124' | 'W126' | 'W140' | 'W202' | 'W210';

interface VehicleData {
  vin: string;
  fin: string;
  series_code: SeriesCode;
  model_code?: string;
  model_text?: string;
  plant_name?: string;
  country_of_origin?: string;
  model_year?: number;
  delivery_date?: string;
  approx_build_date?: string;
  order_location?: string;
  order_number?: string;
  lastvin_encoded_url?: string;
}

interface PowertrainData {
  engine_code?: string;
  engine_number?: string;
  engine_text?: string;
  transmission_code?: string;
  transmission_number?: string;
  transmission_text?: string;
}

interface ColorsData {
  paint_code_primary?: string;
  paint_text_primary?: string;
  interior_code?: string;
  interior_text?: string;
}

interface OptionItem {
  option_code: string;
  option_seq: number;
  option_description_en: string;
  option_description_th?: string;
  option_category?: string;
}

interface MBBuildData {
  vehicle: Partial<VehicleData>;
  powertrain: PowertrainData;
  colors: ColorsData;
  options: OptionItem[];
}

interface DecodedVin {
  vehicle: VehicleData;
  powertrain: PowertrainData;
  colors: ColorsData;
  options: OptionItem[];
  sources: string[];
  confidence: number;
  cache_hit: boolean;
}

// ════════════════════════════════════════════════════════════
// HELPER: Detect Mercedes series from VIN
// ════════════════════════════════════════════════════════════

function detectSeries(vin: string): SeriesCode {
  const chassis = vin.substring(3, 6);
  const map: Record<string, SeriesCode> = {
    '201': 'W201',
    '124': 'W124',
    '126': 'W126',
    '140': 'W140',
    '202': 'W202',
    '210': 'W210',
  };
  return map[chassis] || 'W140';
}

function parseDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3] || '01'}`;
}

// ════════════════════════════════════════════════════════════
// VIN_STANDARD: NHTSA API
// ════════════════════════════════════════════════════════════

async function fetchNHTSA(vin: string): Promise<{
  plant_name?: string;
  country_of_origin?: string;
  model_year?: number;
}> {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`
    );
    if (!res.ok) return {};
    const data = await res.json();
    const r = data.Results?.[0] || {};
    return {
      plant_name: r.PlantCity || undefined,
      country_of_origin: r.PlantCountry || undefined,
      model_year: r.ModelYear ? parseInt(r.ModelYear) : undefined,
    };
  } catch (err) {
    console.error('[NHTSA] error:', err);
    return {};
  }
}

// ════════════════════════════════════════════════════════════
// MB_BUILD: Apify Universal Bypasser
// ════════════════════════════════════════════════════════════

async function fetchMBBuild(lastvinUrl: string | undefined): Promise<MBBuildData | null> {
  if (!lastvinUrl) return null;

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.error('[Apify] APIFY_API_TOKEN not configured');
    return null;
  }

  // Build full URL — accept encoded ID or full URL
  const fullUrl = lastvinUrl.startsWith('http')
    ? lastvinUrl
    : `https://www.lastvin.com/vin/${lastvinUrl}`;

  try {
    const apiUrl = `https://api.apify.com/v2/acts/macheta~universal-bypasser/run-sync-get-dataset-items?token=${token}&timeout=120`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fullUrl }),
    });

    if (!res.ok) {
      console.error(`[Apify] POST failed: ${res.status}`);
      return null;
    }

    const items = await res.json();
    const html: string | undefined = items?.[0]?.content;
    if (!html) {
      console.error('[Apify] No content in response');
      return null;
    }

    return parseLastVinHtml(html);
  } catch (err) {
    console.error('[Apify] error:', err);
    return null;
  }
}

function parseLastVinHtml(html: string): MBBuildData {
  const general: Record<string, string> = {};
  const options: OptionItem[] = [];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;
  let seq = 0;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      cells.push(text);
    }

    if (cells.length !== 2) continue;
    const [a, b] = cells;
    if (a === 'Code' && b === 'Description') continue;
    if (a === 'General Data' || !a || !b) continue;

    if (/^\d{3,4}[A-Z]?$/.test(a)) {
      options.push({
        option_code: a,
        option_seq: seq++,
        option_description_en: b,
      });
    } else {
      general[a] = b;
    }
  }

  return {
    vehicle: {
      fin: general['FIN'],
      model_text: general['Model'],
      order_number: general['Order Number'],
      order_location: general['Order Location'],
      delivery_date: parseDate(general['Delivery Date']),
      approx_build_date: parseDate(general['Approx. Build Date']),
    },
    powertrain: {
      engine_number: general['Engine'],
      transmission_number: general['Transmission'],
    },
    colors: {
      paint_text_primary: general['Paint 1'],
      interior_text: general['Interior'],
    },
    options,
  };
}

// ════════════════════════════════════════════════════════════
// MB_OPTION_MASTER: Enrich options with dictionary
// ════════════════════════════════════════════════════════════

async function enrichOptions(
  options: OptionItem[],
  series: SeriesCode
): Promise<OptionItem[]> {
  if (options.length === 0) return options;

  const codes = options.map((o) => o.option_code);
  const { data } = await supabase
    .from('vin_option_master')
    .select('option_code, description_en, description_th, category')
    .eq('series_code', series)
    .in('option_code', codes);

  const dict = new Map((data || []).map((m) => [m.option_code, m]));
  return options.map((o) => {
    const m = dict.get(o.option_code);
    return {
      option_code: o.option_code,
      option_seq: o.option_seq,
      option_description_en: m?.description_en || o.option_description_en,
      option_description_th: m?.description_th || undefined,
      option_category: m?.category || undefined,
    };
  });
}

// ════════════════════════════════════════════════════════════
// CACHE LAYER
// ════════════════════════════════════════════════════════════

async function getCached(vin: string): Promise<DecodedVin | null> {
  const { data: vehicle } = await supabase
    .from('vin_vehicles')
    .select('*')
    .eq('vin', vin)
    .maybeSingle();

  if (!vehicle) return null;

  const [pt, cl, opts] = await Promise.all([
    supabase.from('vin_powertrains').select('*').eq('vehicle_id', vehicle.id).maybeSingle(),
    supabase.from('vin_colors_trim').select('*').eq('vehicle_id', vehicle.id).maybeSingle(),
    supabase
      .from('vin_option_items')
      .select('option_code, option_seq, option_description_en, option_description_th, option_category')
      .eq('vehicle_id', vehicle.id)
      .order('option_seq'),
  ]);

  return {
    vehicle: vehicle as VehicleData,
    powertrain: (pt.data as PowertrainData) || {},
    colors: (cl.data as ColorsData) || {},
    options: (opts.data as OptionItem[]) || [],
    sources: ['cache'],
    confidence: vehicle.record_confidence || 0.5,
    cache_hit: true,
  };
}

async function saveCache(
  vin: string,
  series: SeriesCode,
  data: {
    vehicle: VehicleData;
    powertrain: PowertrainData;
    colors: ColorsData;
    options: OptionItem[];
    sources: string[];
  }
): Promise<void> {
  const sourceLabel = data.sources.join(',') || 'partial';

  const { data: inserted, error } = await supabase
    .from('vin_vehicles')
    .upsert(
      {
        vin,
        fin: data.vehicle.fin || vin,
        series_code: series,
        model_code: data.vehicle.model_code,
        model_text: data.vehicle.model_text,
        plant_name: data.vehicle.plant_name,
        country_of_origin: data.vehicle.country_of_origin,
        model_year: data.vehicle.model_year,
        delivery_date: data.vehicle.delivery_date,
        approx_build_date: data.vehicle.approx_build_date,
        order_location: data.vehicle.order_location,
        order_number: data.vehicle.order_number,
        lastvin_encoded_url: data.vehicle.lastvin_encoded_url,
        record_confidence: data.sources.length >= 2 ? 0.9 : 0.6,
        review_status: 'pending',
      },
      { onConflict: 'vin' }
    )
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('[Cache] vehicle save error:', error);
    return;
  }

  const vehicleId = inserted.id;

  if (data.powertrain.engine_number || data.powertrain.transmission_number) {
    await supabase.from('vin_powertrains').upsert(
      {
        vehicle_id: vehicleId,
        engine_code: data.powertrain.engine_code,
        engine_number: data.powertrain.engine_number,
        engine_text: data.powertrain.engine_text,
        transmission_code: data.powertrain.transmission_code,
        transmission_number: data.powertrain.transmission_number,
        transmission_text: data.powertrain.transmission_text,
        source_class: 'MB_BUILD',
        source_name: sourceLabel,
        confidence: 0.85,
      },
      { onConflict: 'vehicle_id' }
    );
  }

  if (data.colors.paint_text_primary || data.colors.interior_text) {
    await supabase.from('vin_colors_trim').upsert(
      {
        vehicle_id: vehicleId,
        paint_code_primary: data.colors.paint_code_primary,
        paint_text_primary: data.colors.paint_text_primary,
        interior_code: data.colors.interior_code,
        interior_text: data.colors.interior_text,
        source_class: 'MB_BUILD',
        source_name: sourceLabel,
        confidence: 0.85,
      },
      { onConflict: 'vehicle_id' }
    );
  }

  if (data.options.length > 0) {
    await supabase.from('vin_option_items').delete().eq('vehicle_id', vehicleId);
    const rows = data.options.map((o) => ({
      vehicle_id: vehicleId,
      option_code: o.option_code,
      option_seq: o.option_seq,
      option_description_en: o.option_description_en,
      option_description_th: o.option_description_th,
      option_category: o.option_category,
      source_class: 'MB_BUILD',
      source_name: sourceLabel,
      confidence: 0.85,
    }));
    await supabase.from('vin_option_items').insert(rows);
  }
}

// ════════════════════════════════════════════════════════════
// MAIN DECODER (multi-source)
// ════════════════════════════════════════════════════════════

async function decodeVIN(vin: string, lastvinUrl?: string): Promise<DecodedVin> {
  const series = detectSeries(vin);
  const sources: string[] = [];

  // Layer 1: Cache — return early if already has rich data (options >= 5)
  const cached = await getCached(vin);
  if (cached && cached.options.length >= 5 && !lastvinUrl) {
    cached.options = await enrichOptions(cached.options, series);
    return cached;
  }

  // Layer 2: NHTSA (free, always try)
  const nhtsa = await fetchNHTSA(vin);
  if (nhtsa.plant_name) sources.push('NHTSA');

  // Layer 3: Apify Bypasser (only if lastvinUrl provided)
  const mbBuild = await fetchMBBuild(lastvinUrl);
  if (mbBuild) sources.push('Apify+LastVIN');

  // Combine
  const vehicle: VehicleData = {
    vin,
    fin: mbBuild?.vehicle.fin || vin,
    series_code: series,
    model_code: mbBuild?.vehicle.model_code,
    model_text: mbBuild?.vehicle.model_text,
    plant_name: nhtsa.plant_name,
    country_of_origin: nhtsa.country_of_origin,
    model_year: nhtsa.model_year,
    delivery_date: mbBuild?.vehicle.delivery_date,
    approx_build_date: mbBuild?.vehicle.approx_build_date,
    order_location: mbBuild?.vehicle.order_location,
    order_number: mbBuild?.vehicle.order_number,
    lastvin_encoded_url: lastvinUrl,
  };

  const powertrain: PowertrainData = mbBuild?.powertrain || {};
  const colors: ColorsData = mbBuild?.colors || {};
  let options: OptionItem[] = mbBuild?.options || [];

  // Enrich from dictionary
  options = await enrichOptions(options, series);

  // Save cache
  await saveCache(vin, series, { vehicle, powertrain, colors, options, sources });

  return {
    vehicle,
    powertrain,
    colors,
    options,
    sources,
    confidence: sources.length === 0 ? 0.3 : sources.length === 1 ? 0.6 : 0.9,
    cache_hit: false,
  };
}

// ════════════════════════════════════════════════════════════
// AI DRAFT (Sonnet 4.6)
// ════════════════════════════════════════════════════════════

 
const SYSTEM_PROMPT = `You are formatting a VIN check response for ChutiBenz (chutibenz.com),
Thailand's Mercedes-Benz classic parts specialist.
Do NOT mention "S70 AMG" or "1 of 27" or "10+ ปีในวงการ" anywhere in the output.

ABSOLUTE RULES:

1. SCOPE = VIN DECODE ONLY
   - Display only provided data fields
   - NEVER add maintenance advice, common problems, repair costs
   - NEVER hallucinate fields not in the data
   - Use "—" for missing fields

2. FORMAT = LINE-FRIENDLY (emoji + bullet, NO markdown tables)
   - LINE app does not render markdown tables — use emoji + plain text
   - Keep field labels short and scannable
   - One field per line, no | characters

3. HARDCODED CONTACT (NEVER CHANGE)
   LINE ID: @mr.chuti5988
   Phone:   081-828-5855

4. OUTPUT TEMPLATE EXACTLY:

สวัสดีครับ คุณ {customer_name}
ขอบคุณที่ส่ง VIN มาตรวจสอบครับ

🚗 ข้อมูลรถ
━━━━━━━━━━━━━━━
🔢 FIN: {vin}
🚙 รุ่น: {model_text or "—"}
📋 Series: {series_code}
⚙️ เครื่องยนต์: {engine_number or engine_code or "—"}
🔧 เกียร์: {transmission_number or "—"}
📦 Order Number: {order_number or "—"}
🌏 Order Location: {order_location or "—"}
🪑 ภายใน: {interior_text or "—"}
🎨 สี: {paint_text_primary or "—"}
📅 ส่งมอบ: {delivery_date or "—"}
🏗 ผลิตวันที่: {approx_build_date or "—"}
🏭 โรงงาน: {plant_name}, {country_of_origin}

🔧 Option Codes ({option_count} รายการ)
━━━━━━━━━━━━━━━
{ALL options from data — list every single one, format: "• {code} — {description_en}", one per line}

━━━━━━━━━━━━━━━

💡 บริการเพิ่มเติม

🔧 อยากปรึกษาอาการรถ → "ส่งอาการรถ" (กำลังเปิดให้บริการ)
📦 ดูอะไหล่ ChutiBenz → https://chutibenz.com/products
📱 LINE: @mr.chuti5988

— Mr.Chuti, ChutiBenz
Thailand's Mercedes Classic Parts Specialist`;

async function generateDraft(
  customerName: string,
  vin: string,
  decoded: DecodedVin
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const userMessage = `Customer: ${customerName}

DECODED DATA (use as-is, do not hallucinate):

Vehicle:
${JSON.stringify(decoded.vehicle, null, 2)}

Powertrain:
${JSON.stringify(decoded.powertrain, null, 2)}

Colors:
${JSON.stringify(decoded.colors, null, 2)}

Options (${decoded.options.length} total):
${decoded.options.map((o) => `  ${o.option_code} — ${o.option_description_en}`).join('\n') || '  (none)'}

Sources: ${decoded.sources.join(', ') || 'none'}
Cache hit: ${decoded.cache_hit}

Format using the EXACT template. List ALL ${decoded.options.length} options.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
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

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Claude API: ${errorText}`);
  }

  const result = await res.json();
  return result.content[0].text;
}

// ════════════════════════════════════════════════════════════
// POST HANDLER
// ════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId: string | undefined = body.request_id;
    const lastvinUrl: string | undefined = body.lastvin_url;

    if (!requestId) {
      return jsonWithCors({ error: 'Missing request_id' }, { status: 400 });
    }

    // Fetch existing request
    const { data: vinRequest, error: fetchError } = await supabase
      .from('vin_check_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !vinRequest) {
      return jsonWithCors({ error: 'Request not found' }, { status: 404 });
    }

    // Log lookup
    await supabase.from('vin_lookup_requests').insert({
      vin: vinRequest.vin,
      series_hint: vinRequest.car_model,
      request_source: 'admin',
      resolution_status: 'pending',
    });

    // Multi-source decode
    const decoded = await decodeVIN(vinRequest.vin, lastvinUrl);

    // Generate AI draft
    const draft = await generateDraft(vinRequest.name, vinRequest.vin, decoded);

    // Save back to vin_check_requests
    const modelLabel = decoded.cache_hit
      ? 'claude-sonnet-4-6-v4.4-cache'
      : `claude-sonnet-4-6-v4.4-${decoded.sources.join('+') || 'partial'}`;

    await supabase
      .from('vin_check_requests')
      .update({
        ai_draft: draft,
        ai_generated_at: new Date().toISOString(),
        ai_model: modelLabel,
        external_lookup_result: `sources: ${decoded.sources.join(',') || 'none'} | options: ${decoded.options.length} | cache: ${decoded.cache_hit}`,
      })
      .eq('id', requestId);

    return jsonWithCors({
      success: true,
      draft,
      model: 'claude-sonnet-4-6',
      sources: decoded.sources,
      cache_hit: decoded.cache_hit,
      option_count: decoded.options.length,
      confidence: decoded.confidence,
    });
  } catch (err: any) {
    console.error('VIN draft generation error:', err);
    return jsonWithCors({ error: err.message }, { status: 500 });
  }
}
