// app/api/admin/generate-vin-draft/route.ts — V4.4 MULTI-SOURCE
// Phase 2 — 2026-06-01
//
// V4.4 Architecture (per chutibenz-vin-field-list-schema-pack.md):
// - Source classes: VIN_STANDARD (NHTSA), MB_BUILD (Apify+LastVIN cache),
//   MB_OPTION_MASTER (vin_option_master dict), SHOP_LOGIC (Sonnet), MANUAL_REVIEW (admin)
// - Caching: vin_vehicles + related tables (Mercedes data doesn't change)
// - Output: English (LastVIN-style) + Thai footer
//
// Required Vercel env vars:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SECRET_KEY
//   ANTHROPIC_API_KEY
//   APIFY_API_TOKEN  ← NEW

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
// HARDCODED CONTACT INFO (NEVER CHANGE)
// LINE ID: @mr.chuti5988
// Phone:   081-828-5855
// Website: chutibenz.com
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// TYPES (per schema pack)
// ════════════════════════════════════════════════════════════

type SeriesCode = 'W201' | 'W124' | 'W126' | 'W140' | 'W202' | 'W210';

interface VehicleRecord {
  id?: string;
  vin: string;
  fin?: string;
  series_code?: SeriesCode;
  model_code?: string;
  model_text?: string;
  plant_name?: string;
  country_of_origin?: string;
  serial_number?: string;
  model_year?: number;
  production_date?: string;
  delivery_date?: string;
  approx_build_date?: string;
  order_location?: string;
  order_number?: string;
  lastvin_encoded_url?: string;
}

interface PowertrainRecord {
  engine_code?: string;
  engine_number?: string;
  engine_text?: string;
  transmission_code?: string;
  transmission_number?: string;
  transmission_text?: string;
  fuel_type?: string;
  cylinder_count?: number;
}

interface ColorsTrimRecord {
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

interface DecodedVin {
  vehicle: VehicleRecord;
  powertrain: PowertrainRecord;
  colors: ColorsTrimRecord;
  options: OptionItem[];
  sources: string[];
  confidence: number;
  cache_hit: boolean;
}

// ════════════════════════════════════════════════════════════
// VIN_STANDARD: NHTSA API (free, basic fields)
// ════════════════════════════════════════════════════════════

async function fetchNHTSA(vin: string): Promise<Partial<VehicleRecord>> {
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;
    const res = await fetch(url);
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
// MB_BUILD: Apify Universal Bypasser (FREE)
// Only works for VINs with known encoded URL (cached or previously scraped)
// ════════════════════════════════════════════════════════════

async function fetchApifyDatacard(encodedUrl: string): Promise<string | null> {
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      console.error('[Apify] No APIFY_API_TOKEN env var');
      return null;
    }
    const apiUrl = `https://api.apify.com/v2/acts/macheta~universal-bypasser/run-sync-get-dataset-items?token=${token}&timeout=120`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: encodedUrl }),
    });
    if (!res.ok) {
      console.error(`[Apify] POST failed: ${res.status}`);
      return null;
    }
    const items = await res.json();
    return items[0]?.content || null;
  } catch (err: any) {
    console.error('[Apify] error:', err.message);
    return null;
  }
}

function parseLastVinHtml(html: string): {
  vehicle: Partial<VehicleRecord>;
  powertrain: Partial<PowertrainRecord>;
  colors: Partial<ColorsTrimRecord>;
  options: OptionItem[];
} {
  const general: Record<string, string> = {};
  const options: OptionItem[] = [];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;
  let seq = 0;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
    let cellMatch;
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

function parseDate(s?: string): string | undefined {
  if (!s) return undefined;
  // LastVIN formats: "1992-10-02" or "1992-07"
  const match = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return undefined;
  return `${match[1]}-${match[2]}-${match[3] || '01'}`;
}

// ════════════════════════════════════════════════════════════
// MB_OPTION_MASTER: Lookup option descriptions from dictionary
// ════════════════════════════════════════════════════════════

async function enrichOptionsFromMaster(
  options: OptionItem[],
  series: SeriesCode
): Promise<OptionItem[]> {
  if (options.length === 0) return options;
  const codes = options.map((o) => o.option_code);
  const { data: master } = await supabase
    .from('vin_option_master')
    .select('option_code, description_en, description_th, category')
    .eq('series_code', series)
    .in('option_code', codes);

  const masterMap = new Map((master || []).map((m) => [m.option_code, m]));
  return options.map((o) => {
    const m = masterMap.get(o.option_code);
    return {
      ...o,
      option_description_en: m?.description_en || o.option_description_en,
      option_description_th: m?.description_th || undefined,
      option_category: m?.category || undefined,
    };
  });
}

// ════════════════════════════════════════════════════════════
// CACHE: Check + save vin_vehicles
// ════════════════════════════════════════════════════════════

async function getCachedVehicle(vin: string): Promise<DecodedVin | null> {
  const { data: vehicle } = await supabase
    .from('vin_vehicles')
    .select('*')
    .eq('vin', vin)
    .single();

  if (!vehicle) return null;

  const [powertrain, colors, optionsData] = await Promise.all([
    supabase.from('vin_powertrains').select('*').eq('vehicle_id', vehicle.id).single(),
    supabase.from('vin_colors_trim').select('*').eq('vehicle_id', vehicle.id).single(),
    supabase
      .from('vin_option_items')
      .select('*')
      .eq('vehicle_id', vehicle.id)
      .order('option_seq'),
  ]);

  return {
    vehicle,
    powertrain: powertrain.data || {},
    colors: colors.data || {},
    options: optionsData.data || [],
    sources: ['cache'],
    confidence: vehicle.record_confidence || 0.5,
    cache_hit: true,
  };
}

async function saveDecodedToCache(
  vin: string,
  series: SeriesCode,
  data: {
    vehicle: Partial<VehicleRecord>;
    powertrain: Partial<PowertrainRecord>;
    colors: Partial<ColorsTrimRecord>;
    options: OptionItem[];
    sources: string[];
  }
): Promise<string | null> {
  try {
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
          record_confidence: 0.85,
          review_status: 'pending',
        },
        { onConflict: 'vin' }
      )
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('[Cache] vehicle save failed:', error);
      return null;
    }

    const vehicleId = inserted.id;

    // Save powertrain
    if (data.powertrain.engine_number || data.powertrain.transmission_number) {
      await supabase.from('vin_powertrains').upsert(
        {
          vehicle_id: vehicleId,
          ...data.powertrain,
          source_class: 'MB_BUILD',
          source_name: data.sources.join(','),
        },
        { onConflict: 'vehicle_id' }
      );
    }

    // Save colors
    if (data.colors.paint_text_primary || data.colors.interior_text) {
      await supabase.from('vin_colors_trim').upsert(
        {
          vehicle_id: vehicleId,
          ...data.colors,
          source_class: 'MB_BUILD',
          source_name: data.sources.join(','),
        },
        { onConflict: 'vehicle_id' }
      );
    }

    // Save options (delete + reinsert)
    if (data.options.length > 0) {
      await supabase.from('vin_option_items').delete().eq('vehicle_id', vehicleId);
      const optionRows = data.options.map((o) => ({
        vehicle_id: vehicleId,
        option_code: o.option_code,
        option_seq: o.option_seq,
        option_description_en: o.option_description_en,
        option_description_th: o.option_description_th,
        option_category: o.option_category,
        source_class: 'MB_BUILD',
        source_name: data.sources.join(','),
        confidence: 0.85,
      }));
      await supabase.from('vin_option_items').insert(optionRows);
    }

    return vehicleId;
  } catch (err) {
    console.error('[Cache] save error:', err);
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// SERIES DETECTION from VIN
// ════════════════════════════════════════════════════════════

function detectSeries(vin: string): SeriesCode | null {
  // Mercedes chassis code is at positions 4-6 of VIN
  const chassis = vin.substring(3, 6);
  const map: Record<string, SeriesCode> = {
    '201': 'W201',
    '124': 'W124',
    '126': 'W126',
    '140': 'W140',
    '202': 'W202',
    '210': 'W210',
  };
  return map[chassis] || null;
}

// ════════════════════════════════════════════════════════════
// SYSTEM PROMPT (V4.4)
// ════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are formatting a VIN check response for ChutiBenz (chutibenz.com),
Thailand's leading Mercedes-Benz classic parts specialist.

ABSOLUTE RULES:

1. SCOPE = VIN DECODE ONLY (factual data)
   - Display all provided data fields cleanly
   - NEVER add maintenance advice, common problems, repair costs
   - NEVER hallucinate fields not in the provided data
   - If field is missing, show "—" or omit

2. FORMAT = LASTVIN-STYLE (English tables + Thai footer only)
   - General Data table
   - Option Codes table (list ALL options provided)
   - Thai only in footer

3. HARDCODED CONTACT (NEVER CHANGE)
   LINE ID: @mr.chuti5988
   Phone:   081-828-5855

4. OUTPUT TEMPLATE EXACTLY:

สวัสดีครับ คุณ {customer_name}
ขอบคุณที่ส่ง VIN มาตรวจสอบครับ

## Datacard

| Field | Value |
|---|---|
| FIN | {vin} |
| Model | {model_text or "—"} |
| Series | {series_code} ({model_code if available}) |
| Engine | {engine_number or engine_code or "—"} |
| Transmission | {transmission_number or "—"} |
| Order Number | {order_number or "—"} |
| Order Location | {order_location or "—"} |
| Interior | {interior_text or "—"} |
| Paint 1 | {paint_text_primary or "—"} |
| Delivery Date | {delivery_date or "—"} |
| Build Date | {approx_build_date or "—"} |
| Plant | {plant_name}, {country_of_origin} |

## Option Codes ({option_count})

| Code | Description |
|---|---|
{ALL options from data — list every single one}

---

💡 บริการเพิ่มเติม

🔧 อยากปรึกษาอาการรถ → "ส่งอาการรถ" (กำลังเปิดให้บริการ)
📦 ดูอะไหล่ ChutiBenz → https://chutibenz.com/products
📱 LINE: @mr.chuti5988

— Mr.Chuti, ChutiBenz
Thailand's Mercedes Classic Parts Specialist
10+ ปีในวงการ · W140 S70 AMG (1 of 27 worldwide)`;

// ════════════════════════════════════════════════════════════
// AI DRAFT GENERATION (SHOP_LOGIC)
// ════════════════════════════════════════════════════════════

async function generateAIDraft(
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
${decoded.options.map((o) => `  ${o.option_code} — ${o.option_description_en}`).join('\n')}

Sources used: ${decoded.sources.join(', ')}
Confidence: ${decoded.confidence}
Cache hit: ${decoded.cache_hit}

Format into the exact output template. List ALL options.`;

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
// MAIN DECODER (multi-source)
// ════════════════════════════════════════════════════════════

async function decodeVIN(vin: string): Promise<DecodedVin> {
  // Layer 1: Cache check
  const cached = await getCachedVehicle(vin);
  if (cached) {
    cached.options = await enrichOptionsFromMaster(
      cached.options,
      cached.vehicle.series_code || detectSeries(vin) || 'W140'
    );
    return cached;
  }

  const series = detectSeries(vin) || 'W140';
  const sources: string[] = [];

  // Layer 2: NHTSA (VIN_STANDARD)
  const nhtsa = await fetchNHTSA(vin);
  if (nhtsa.plant_name) sources.push('NHTSA');

  // Layer 3: Apify Bypasser (MB_BUILD) — only if we have encoded URL
  // For NEW VINs without encoded URL, skip this layer.
  // Mr.Chuti can manually paste encoded URL in admin to enable for future requests.
  let mbBuildData: ReturnType<typeof parseLastVinHtml> | null = null;
  // (Will be populated later when admin provides encoded URL)

  // Combine all data
  const combined = {
    vehicle: {
      vin,
      fin: mbBuildData?.vehicle.fin || vin,
      series_code: series,
      model_code: `${series.slice(1)}.???`,
      model_text: mbBuildData?.vehicle.model_text,
      plant_name: nhtsa.plant_name,
      country_of_origin: nhtsa.country_of_origin,
      model_year: nhtsa.model_year,
      delivery_date: mbBuildData?.vehicle.delivery_date,
      approx_build_date: mbBuildData?.vehicle.approx_build_date,
      order_location: mbBuildData?.vehicle.order_location,
      order_number: mbBuildData?.vehicle.order_number,
    },
    powertrain: mbBuildData?.powertrain || {},
    colors: mbBuildData?.colors || {},
    options: mbBuildData?.options || [],
    sources,
  };

  // Enrich options from dictionary
  combined.options = await enrichOptionsFromMaster(combined.options, series);

  // Save to cache for next time
  await saveDecodedToCache(vin, series, combined);

  return {
    vehicle: combined.vehicle,
    powertrain: combined.powertrain,
    colors: combined.colors,
    options: combined.options,
    sources,
    confidence: sources.length > 0 ? 0.7 : 0.4,
    cache_hit: false,
  };
}

// ════════════════════════════════════════════════════════════
// POST HANDLER
// ════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 });
    }

    // Get request from old vin_check_requests table (admin form)
    const { data: vinRequest, error: fetchError } = await supabase
      .from('vin_check_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchError || !vinRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Log lookup
    await supabase.from('vin_lookup_requests').insert({
      vin: vinRequest.vin,
      series_hint: vinRequest.car_model,
      request_source: 'admin',
      resolution_status: 'pending',
    });

    // Multi-source decode
    const decoded = await decodeVIN(vinRequest.vin);

    // Generate AI draft
    const draft = await generateAIDraft(vinRequest.name, vinRequest.vin, decoded);

    // Save back to vin_check_requests
    const aiModel = decoded.cache_hit
      ? 'claude-sonnet-4-6-v4.4-cache'
      : `claude-sonnet-4-6-v4.4-${decoded.sources.join('+') || 'partial'}`;

    await supabase
      .from('vin_check_requests')
      .update({
        ai_draft: draft,
        ai_generated_at: new Date().toISOString(),
        ai_model: aiModel,
        external_lookup_result: `sources: ${decoded.sources.join(',') || 'none'} | options: ${decoded.options.length} | cache: ${decoded.cache_hit}`,
      })
      .eq('id', request_id);

    return NextResponse.json({
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
