// app/articles/[slug]/page.tsx — Article detail
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { LINE_OA_URL } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('content').select('title, excerpt, meta_title, meta_description, cover_image').eq('slug', slug).single()
  if (!data) return { title: 'ไม่พบบทความ' }
  return {
    title: data.meta_title || data.title,
    description: data.meta_description || data.excerpt,
    openGraph: {
      images: data.cover_image ? [data.cover_image] : undefined,
    },
  }
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: article } = await supabase.from('content').select('*').eq('slug', slug).eq('is_published', true).single()
  if (!article) notFound()

  // Increment view count (fire and forget)
  supabase.from('content').update({ views_count: (article.views_count || 0) + 1 }).eq('id', article.id).then(() => {})

  // Related products
  const related = article.related_parts && article.related_parts.length > 0
    ? await supabase.from('products').select('*').in('id', article.related_parts).limit(6)
    : await supabase.from('products').select('*').contains('compatible_models', article.related_models || []).eq('is_published', true).limit(6)

  return (
    <article className="max-w-3xl mx-auto px-4 py-6">
      {/* Cover */}
      {article.cover_image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.cover_image} alt={article.title} className="w-full h-64 md:h-96 object-cover rounded-2xl mb-6" />
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-2 mb-3">
        {article.related_models?.map((m: string) => (
          <Link key={m} href={`/articles?model=${m}`} className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-2 py-1 rounded">{m}</Link>
        ))}
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{article.type}</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">{article.title}</h1>
      <p className="text-gray-500 text-sm mb-6">
        {article.published_at && new Date(article.published_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
        {article.views_count > 0 && <> · 👁 {article.views_count.toLocaleString()} views</>}
      </p>

      {article.excerpt && (
        <p className="text-lg text-gray-700 leading-relaxed mb-6 border-l-4 border-yellow-400 pl-4 italic">{article.excerpt}</p>
      )}

      {/* Body — markdown rendered as plain prose (basic) */}
      <div
        className="prose prose-lg max-w-none article-body"
        dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(article.body || '') }}
      />

      {/* Related products */}
      {related?.data && related.data.length > 0 && (
        <section className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-xl font-bold mb-4">🛒 อะไหล่ที่เกี่ยวข้อง</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {related.data.map((p: any) => (
              <Link key={p.id} href={`/products/${p.slug}`} className="block bg-white rounded-lg border border-gray-100 hover:shadow-md transition p-3">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover rounded mb-2" />
                )}
                <h3 className="font-semibold text-sm line-clamp-2">{p.name}</h3>
                <p className="text-green-600 font-bold text-sm mt-1">฿{p.price?.toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mt-12 rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-500 p-6 text-center">
        <h2 className="text-xl font-bold mb-2">มีคำถามหรืออาการคล้ายๆ นี้?</h2>
        <p className="mb-4">ทีม ChutiBenz ช่วยได้ — ส่งอาการมา ตอบกลับใน 4 ชั่วโมง</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/intake" className="rounded-lg bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 font-bold">📋 ส่งอาการรถ</Link>
          <a href={LINE_OA_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-green-500 hover:bg-green-600 text-white px-6 py-3 font-bold">💬 ทักทาย LINE</a>
        </div>
      </section>
    </article>
  )
}

// VERY simple markdown → HTML
function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
}
