// lib/intake-schema.ts — Zod schema for intake form validation
// Install: npm i zod

import { z } from 'zod'
import { CHASSIS_MODELS, INTAKE_TYPES, SYMPTOM_CATEGORIES, PARTS_CATEGORIES } from './constants'

const intake_type_values = Object.keys(INTAKE_TYPES) as [keyof typeof INTAKE_TYPES, ...(keyof typeof INTAKE_TYPES)[]]
const symptom_values = SYMPTOM_CATEGORIES.map(s => s.value) as [string, ...string[]]
const parts_values = PARTS_CATEGORIES.map(p => p.value) as [string, ...string[]]

// Step 1: Vehicle
export const Step1Schema = z.object({
  chassis: z.enum(CHASSIS_MODELS as readonly [string, ...string[]], {
    errorMap: () => ({ message: 'เลือกรุ่นรถ' })
  }),
  year: z.number()
    .int()
    .min(1979, 'ปีต้องอยู่ระหว่าง 1979-2002')
    .max(2002, 'ปีต้องอยู่ระหว่าง 1979-2002'),
  engine_code: z.string().optional(),
  body_style: z.enum(['sedan','wagon','coupe','cabrio']).optional(),
})

// Step 2: Intake type (just a radio selection)
export const Step2Schema = z.object({
  intake_type: z.enum(intake_type_values),
})

// Step 3: Conditional based on intake_type
export const Step3FindPartsSchema = z.object({
  part_name: z.string().min(1, 'ระบุชื่ออะไหล่'),
  part_number: z.string().optional(),
  part_category: z.enum(parts_values).optional(),
})

export const Step3SymptomSchema = z.object({
  symptom_category: z.enum(symptom_values, { errorMap: () => ({ message: 'เลือกหมวดอาการ' }) }),
  symptom_detail: z.string()
    .min(10, 'อธิบายอาการให้ละเอียดอย่างน้อย 10 ตัวอักษร')
    .max(500, 'อธิบายไม่เกิน 500 ตัวอักษร'),
  warning_light: z.boolean().default(false),
  stop_drive: z.boolean().default(false),
})

// Step 4: Photos
export const Step4Schema = z.object({
  photo_urls: z.array(z.string().url()).max(5, 'ได้สูงสุด 5 ไฟล์').default([]),
})

// Step 5: Contact
const phoneRegex = /^0[0-9]{8,9}$/

export const Step5Schema = z.object({
  contact_name: z.string().min(2, 'ใส่ชื่อ').max(100),
  contact_phone: z.string().regex(phoneRegex, 'เบอร์ไม่ถูกต้อง (เช่น 0812345678)').optional().or(z.literal('')),
  contact_line_id: z.string().max(50).optional().or(z.literal('')),
  contact_province: z.string().min(1, 'เลือกจังหวัด'),
  consent: z.boolean().refine(v => v === true, { message: 'ต้องยินยอมการใช้ข้อมูล' }),
  send_to_line: z.boolean().default(true),
}).refine(d => d.contact_phone || d.contact_line_id, {
  message: 'ใส่เบอร์โทรหรือ LINE ID อย่างน้อย 1 อย่าง',
  path: ['contact_phone'],
})

// Full intake schema (combined)
export const IntakeSchema = z.object({
  // Step 1
  chassis: z.enum(CHASSIS_MODELS as readonly [string, ...string[]]),
  year: z.number().int().min(1979).max(2002),
  engine_code: z.string().optional(),
  body_style: z.string().optional(),

  // Step 2
  intake_type: z.enum(intake_type_values),

  // Step 3 (one of)
  part_name: z.string().optional(),
  part_number: z.string().optional(),
  part_category: z.string().optional(),
  symptom_category: z.string().optional(),
  symptom_detail: z.string().optional(),
  warning_light: z.boolean().default(false),
  stop_drive: z.boolean().default(false),

  // Step 4
  photo_urls: z.array(z.string()).max(5).default([]),

  // Step 5
  contact_name: z.string().min(2),
  contact_phone: z.string().optional(),
  contact_line_id: z.string().optional(),
  contact_province: z.string().min(1),
  consent: z.literal(true),
  send_to_line: z.boolean().default(true),

  // Tracking
  source: z.string().default('web_form'),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
})

export type IntakeData = z.infer<typeof IntakeSchema>
