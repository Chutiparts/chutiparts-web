'use server'

import { createClient } from '@/utils/supabase/server'
import { IntakeSchema, type IntakeData } from '@/lib/intake-schema'
import { MODEL_INFO, INTAKE_TYPES, buildLineOAMessageUrl } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

export async function submitIntake(input: IntakeData) {
  // 1. Validate
  const parsed = IntakeSchema.parse(input)

  const supabase = await createClient()

  // 2. Create or get vehicle
  // (No user_id since this is anonymous intake)
  const { data: vehicle, error: vErr } = await supabase
    .from('vehicles')
    .insert({
      chassis: parsed.chassis,
      year_from: parsed.year,
      year_to: parsed.year,
      engine_code: parsed.engine_code || null,
      body_style: parsed.body_style || null,
    })
    .select()
    .single()

  if (vErr) {
    console.error('vehicle insert error', vErr)
    throw new Error('ไม่สามารถบันทึกข้อมูลรถได้')
  }

  // 3. Determine priority
  let priority = 'normal'
  if (parsed.stop_drive) priority = 'urgent'
  else if (parsed.warning_light) priority = 'high'

  // 4. Insert case
  const { data: caseRow, error: cErr } = await supabase
    .from('cases')
    .insert({
      vehicle_id: vehicle.id,
      intake_type: parsed.intake_type,
      part_name: parsed.part_name || null,
      part_number: parsed.part_number || null,
      part_category: parsed.part_category || null,
      symptom_category: parsed.symptom_category || null,
      symptom_detail: parsed.symptom_detail || null,
      warning_light: parsed.warning_light,
      stop_drive: parsed.stop_drive,
      photos: parsed.photo_urls.map(url => ({ url })),
      contact_name: parsed.contact_name,
      contact_phone: parsed.contact_phone || null,
      contact_line_id: parsed.contact_line_id || null,
      contact_province: parsed.contact_province,
      priority,
      status: 'new',
      source: parsed.source || 'web_form',
      utm_source: parsed.utm_source || null,
      utm_medium: parsed.utm_medium || null,
      utm_campaign: parsed.utm_campaign || null,
    })
    .select()
    .single()

  if (cErr || !caseRow) {
    console.error('case insert error', cErr)
    throw new Error('ไม่สามารถบันทึกเคสได้')
  }

  // 5. Build LINE deep link
  const modelLabel = `${parsed.chassis} (${parsed.year})${parsed.engine_code ? ` ${parsed.engine_code}` : ''}`
  const typeLabel = INTAKE_TYPES[parsed.intake_type as keyof typeof INTAKE_TYPES].label
  const detail = parsed.intake_type === 'find_parts'
    ? `อะไหล่: ${parsed.part_name}`
    : `อาการ: ${parsed.symptom_detail?.slice(0, 100)}`

  const lineUrl = buildLineOAMessageUrl(
    caseRow.case_number,
    typeLabel,
    `รุ่น: ${modelLabel}\n${detail}`
  )

  // 6. Log analytics event
  await supabase.from('events').insert({
    event_name: 'intake_submitted',
    event_data: {
      case_number: caseRow.case_number,
      intake_type: parsed.intake_type,
      chassis: parsed.chassis,
    },
    source: parsed.source,
    utm_source: parsed.utm_source,
    utm_medium: parsed.utm_medium,
    utm_campaign: parsed.utm_campaign,
  })

  // 7. Revalidate admin inbox
  revalidatePath('/admin/inbox')

  return {
    case_number: caseRow.case_number,
    line_url: parsed.send_to_line ? lineUrl : null,
  }
}
