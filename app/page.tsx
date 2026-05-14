import { createClient } from '@/utils/supabase/server'
import HomeClient from './HomeClient'

export const revalidate = 300

export default async function Home() {
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">เกิดข้อผิดพลาด</h1>
          <pre className="text-sm p-4 bg-red-50 rounded text-left overflow-auto">{error.message}</pre>
        </div>
      </div>
    )
  }

  return <HomeClient products={products ?? []} />
}
