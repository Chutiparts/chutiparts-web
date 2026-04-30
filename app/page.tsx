  import { createClient } from '@/utils/supabase/server'
import Image from 'next/image'
import Link from 'next/link'

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
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                ChutiParts <span className="text-yellow-400">⭐</span>
              </h1>
              <p className="text-gray-300 mt-2 text-sm md:text-base">
                คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี | OEM แท้ 100%
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {products?.length || 0} รายการพร้อมขาย • รับประกัน 15 วัน • ส่งทั่วไทย
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <a 
                href="https://line.me/ti/p/~mr.chuti5988"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition text-center"
              >
                💬 Line: mr.chuti5988
              </a>
              <a 
                href="tel:0818285855"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition text-center"
              >
                📞 081-828-5855
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products?.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group block"
            >
              <article 
                className="bg-white rounded-xl shadow-sm group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col h-full cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                  {product.image_url ? (
                    <img 
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-6xl">🚗</span>
                    </div>
                  )}
                  {/* Stock badge */}
                  {product.stock <= 1 && (
                    <span className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                      เหลือชิ้นสุดท้าย!
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-grow">
                  {/* Category Tag */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                      {product.category}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded font-medium">
                      {product.condition === 'used-good' ? 'มือสอง สภาพดี' : 
                       product.condition === 'oem' ? 'OEM แท้' :
                       product.condition === 'aftermarket' ? 'Aftermarket' : 
                       product.condition}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors">
                    {product.name}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2 flex-grow">
                    {product.description}
                  </p>

                  {/* Compatible Models */}
                  {product.compatible_models?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="text-xs text-gray-500 mr-1">รองรับ:</span>
                      {product.compatible_models.map((model: string) => (
                        <span 
                          key={model} 
                          className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded font-medium"
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Price + View Detail Hint */}
                  <div className="flex items-end justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500">ราคา</p>
                      <p className="text-2xl font-bold text-green-600">
                        ฿{product.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">
                        มี {product.stock} ชิ้น
                      </p>
                      <p className="text-xs text-green-600 font-semibold group-hover:text-green-700 transition-colors">
                        ดูรายละเอียด →
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">ChutiParts</h3>
              <p className="text-sm">
                คลังอะไหล่ Mercedes-Benz มือสองคุณภาพดี<br/>
                เชี่ยวชาญรุ่นคลาสสิค W124, W126, W140, W202, W210, W220
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">ติดต่อเรา</h3>
              <ul className="space-y-2 text-sm">
                <li>💬 Line: mr.chuti5988</li>
                <li>📞 081-828-5855</li>
                <li>🚚 จัดส่งทั่วประเทศ</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">รับประกัน</h3>
              <ul className="space-y-2 text-sm">
                <li>✅ อะไหล่แท้ OEM 100%</li>
                <li>✅ รับประกัน 15 วัน</li>
                <li>✅ เสียเปลี่ยนได้</li>
                <li>✅ ตรวจสอบก่อนส่ง</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 text-center text-sm">
            <p>© 2026 ChutiParts. คลังอะไหล่เบนซ์มือสองคุณภาพดี</p>
          </div>
        </div>
      </footer>
    </div>
  )
}