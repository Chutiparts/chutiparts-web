// app/search/page.tsx — Full search page
import { createClient } from '@/utils/supabase/server'
import SearchClient from './SearchClient'
import { resolveAliases } from '@/lib/search-utils'

export const metadata = {
  title: 'ค้นหาอะไหล่',
  description: 'ค้นหาอะไหล่ Mercedes-Benz มือสอง — รุ่น W124, W126, W140, W201, W202, W210',
}

export const dynamic = 'force-dynamic'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; model?: string; cat?: string; type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const q = (params.q || '').trim()
  const model = params.model
  const cat = params.cat
  const type = params.type || 'all'

  // Resolve aliases (e.g., ปลาวาฬ → W140)
  const resolvedQuery = await resolveAliases(q, supabase)
  const searchQuery = resolvedQuery.canonical || q

  // Search Products
  let productsQuery = supabase
    .from('products')
    .select('*')
    .eq('is_published', true)
    .limit(20)

  if (searchQuery) {
    productsQuery = productsQuery.or(
      `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,part_number.ilike.%${searchQuery}%,oem_number.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%`
    )
  }
  if (model) {
    productsQuery = productsQuery.contains('compatible_models', [model])
  }
  if (cat) {
    productsQuery = productsQuery.eq('category', cat)
  }

  // Search Articles
  const articlesQuery = supabase
    .from('content')
    .select('*')
    .eq('is_published', true)
    .limit(10)
  let articles_q = articlesQuery
  if (searchQuery) {
    articles_q = articles_q.or(`title.ilike.%${searchQuery}%,body.ilike.%${searchQuery}%`)
  }
  if (model) {
    articles_q = articles_q.contains('related_models', [model])
  }

  // Search Businesses
  let bizQuery = supabase
    .from('businesses')
    .select('*')
    .limit(10)
  if (searchQuery) {
    bizQuery = bizQuery.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
  }
  if (model) {
    bizQuery = bizQuery.contains('models_expertise', [model])
  }

  const [productsRes, articlesRes, bizRes] = await Promise.all([
    productsQuery,
    articles_q,
    bizQuery,
  ])

  // Log analytics
  if (q) {
    await supabase.from('events').insert({
      event_name: 'search_query',
      event_data: { q, resolved: searchQuery, model, cat },
    }).then(() => {})
  }

  return (
    <SearchClient
      initialQuery={q}
      initialModel={model || ''}
      initialCategory={cat || ''}
      initialType={type}
      products={productsRes.data || []}
      articles={articlesRes.data || []}
      businesses={bizRes.data || []}
      resolved={resolvedQuery}
    />
  )
}
