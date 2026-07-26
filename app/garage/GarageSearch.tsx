// app/garage/GarageSearch.tsx — ช่องค้นหาอู่ (ฝั่ง client) กรองทันทีตามจังหวัด/อำเภอ/ชื่ออู่
// ใช้ในหน้า /benz-garages-thailand · รับลิสต์ที่ server เรียงมาแล้ว → กรองด้วย useState
'use client'

import { useState, useMemo } from 'react'
import { GarageCard, type Garage } from './_components'

export function GarageSearch({ garages }: { garages: Garage[] }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!query) return garages
    return garages.filter((g) => {
      const hay = [g.province, g.district, g.name_th, g.name_en]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(query)
    })
  }, [query, garages])

  return (
    <div>
      <div className="relative mb-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 พิมพ์ชื่อจังหวัด / อำเภอ / ชื่ออู่ เช่น เชียงใหม่, ภูเก็ต, บางกะปิ"
          className="w-full rounded-xl border px-4 py-3 text-sm focus:border-[#C9A961] focus:outline-none focus:ring-1 focus:ring-[#C9A961]"
          aria-label="ค้นหาอู่เบนซ์ตามจังหวัดหรือชื่ออู่"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            aria-label="ล้างคำค้นหา"
          >
            ✕
          </button>
        )}
      </div>

      <div className="text-sm text-gray-500 mb-4">
        {query ? (
          <>พบ <b className="text-gray-700">{filtered.length}</b> อู่ จากคำค้น “{q}”</>
        ) : (
          <>ดูอู่เบนซ์ทั้งหมด <b className="text-gray-700">{garages.length}</b> อู่ — หรือพิมพ์ชื่อจังหวัดเพื่อค้นหา</>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-gray-500">
          ไม่พบอู่ที่ตรงกับ “{q}” — ลองพิมพ์ชื่อจังหวัดอื่น เช่น กรุงเทพมหานคร เชียงใหม่ ภูเก็ต
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((g) => (
            <GarageCard key={g.id} g={g} />
          ))}
        </div>
      )}
    </div>
  )
}
