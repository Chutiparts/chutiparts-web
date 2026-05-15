// app/articles/page.tsx — Articles list
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { CHASSIS_MODELS } from '@/lib/constants'

export const metadata = {
  title: 'บทความความรู้ Mercedes-Benz',
  description: 'อ่านบทความเกี่ยวกับการดูแล Mercedes-Benz รุ่นเก่า W124, W126, W140, W201, W202, W210',
}

export const dynamic = 'force-dynamic'

export default async function ArticlesPage({ searchParams }: { searchParams: { model?: string; tag?: string } }) {
  const supabase = await createClient()
  let q = supabase.from('content').select('*').eq('is_published', true).order('published_at', { ascending: false })

  if (searchParams.model) q = q.contains('related_models', [searchParams.model])
  if (searchParams.tag) q = q.contains('tags', [searchParams.tag])

  const { data: articles } = await q

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📖 บทความความรู้</h1>
        <p className="text-gray-600">ความรู้เรื่อง Mercedes-Benz รุ่นเก่า จากประสบการณ์จริง</p>
      </header>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <Link href="/articles" className={`rounded-full px-4 py-2 text-sm font-semibold ${!searchParams.model ? 'bg-yellow-500 text-white' : 'bg-white border'}`}>
          ทั้งหมด
        </Link>
        {CHASSIS_MODELS.map(m => (
          <Link key={m} href={`/articles?model=${m}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${searchParams.model === m ? 'bg-yellow-500 text-white' : 'bg-white border'}`}
          >{m}</Link>
        ))}
      </div>

      {/* List */}
      {!articles || articles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-gray-500">ยังไม่มีบทความ — ติดตามได้เร็วๆ นี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map(a => (
            <Link key={a.id} href={`/articles/${a.slug}`}
              className="block bg-white rounded-xl border border-gray-100 hover:shadow-lg transition overflow-hidden"
            >
              {a.cover_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.cover_image} alt={a.title} className="w-full h-48 object-cover" />
              )}
              <div className="p-4">
                <div className="flex flex-wrap gap-1 mb-2">
                  {a.related_models?.slice(0,3).map((m: string) => (
                    <span key={m} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">{m}</span>
                  ))}
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{a.type}</span>
                </div>
                <h2 className="font-bold text-lg leading-tight line-clamp-2">{a.title}</h2>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{a.excerpt}</p>
                <p className="text-xs text-gray-400 mt-3">
                  {a.published_at && new Date(a.published_at).toLocaleDateString('th-TH')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
