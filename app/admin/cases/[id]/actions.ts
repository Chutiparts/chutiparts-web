'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateCase(id: string, updates: any) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Unauthorized')

  // Mark first_responded_at if going from new → other status
  const { data: current } = await supabase.from('cases').select('status, first_responded_at').eq('id', id).single()
  if (current && current.status === 'new' && updates.status !== 'new' && !current.first_responded_at) {
    updates.first_responded_at = new Date().toISOString()
  }

  // Closed → set closed_at
  if (updates.status?.startsWith('closed_')) {
    updates.closed_at = new Date().toISOString()
  }

  const { error } = await supabase.from('cases').update(updates).eq('id', id)
  if (error) throw error

  revalidatePath(`/admin/cases/${id}`)
  revalidatePath('/admin/inbox')
}

export async function addNote(caseId: string, text: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()

  // Append to notes jsonb array
  const { data: current } = await supabase.from('cases').select('notes').eq('id', caseId).single()
  const notes = (current?.notes as any[]) || []
  notes.push({
    text,
    author: profile?.full_name || profile?.email || 'admin',
    at: new Date().toISOString(),
  })

  await supabase.from('cases').update({ notes }).eq('id', caseId)
  revalidatePath(`/admin/cases/${caseId}`)
}

export async function sendQuote(caseId: string, amount: number, message: string) {
  // Placeholder — could send LINE message via API in the future
  const supabase = await createClient()
  await supabase.from('cases').update({
    quoted_amount: amount,
    status: 'quoted',
  }).eq('id', caseId)

  await addNote(caseId, `เสนอราคา ฿${amount.toLocaleString()} — ${message}`)

  revalidatePath(`/admin/cases/${caseId}`)
}
