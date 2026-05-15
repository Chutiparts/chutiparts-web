// lib/search-utils.ts — Search alias resolution + utilities

import type { SupabaseClient } from '@supabase/supabase-js'

export type AliasResolution = {
  canonical?: string
  type?: string
  matched: boolean
}

/**
 * Resolve user query against search_aliases table.
 * Returns canonical form if match found (e.g., "ปลาวาฬ" → "W140")
 *
 * Strategy:
 * 1. Try exact match (case-insensitive) on alias
 * 2. Try substring match
 * 3. Fall back to original query
 */
export async function resolveAliases(
  query: string,
  supabase: SupabaseClient
): Promise<AliasResolution> {
  if (!query || query.length < 2) {
    return { matched: false }
  }

  const lower = query.toLowerCase().trim()

  // Try exact match first
  const { data: exact } = await supabase
    .from('search_aliases')
    .select('canonical, type')
    .ilike('alias', lower)
    .eq('active', true)
    .order('weight', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (exact) {
    return { canonical: exact.canonical, type: exact.type, matched: true }
  }

  // Try substring match
  const { data: partial } = await supabase
    .from('search_aliases')
    .select('canonical, type')
    .ilike('alias', `%${lower}%`)
    .eq('active', true)
    .order('weight', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (partial) {
    return { canonical: partial.canonical, type: partial.type, matched: true }
  }

  return { matched: false }
}

/**
 * Normalize Thai text for search (remove extra spaces, lowercase, etc.)
 */
export function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFC')
}

/**
 * Score search relevance (0-100). Used for ranking results.
 */
export function scoreMatch(query: string, target: string): number {
  if (!query) return 0
  const q = normalizeText(query)
  const t = normalizeText(target)
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.includes(q)) return 60
  // Word-by-word match
  const qWords = q.split(' ')
  const matched = qWords.filter((w) => t.includes(w)).length
  return Math.round((matched / qWords.length) * 40)
}