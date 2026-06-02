'use client';

type Props = {
  onClear: () => void;
  hasFilters: boolean;
};

/**
 * EmptyState — shown when filter+search yields zero results
 */
export default function EmptyState({ onClear, hasFilters }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">
        ไม่พบสินค้าที่ตรงกับการค้นหา
      </h3>
      <p className="text-gray-600 max-w-md mb-6">
        {hasFilters
          ? 'ลองปรับการค้นหา หรือล้างตัวกรองดูครับ'
          : 'ลองพิมพ์ชื่อ ชิ้นส่วน หรือ SKU ที่ต่างออกไป'}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg bg-gray-800 px-6 py-3 text-white font-semibold hover:bg-gray-900 mb-4"
        >
          ล้างตัวกรองทั้งหมด
        </button>
      )}

      <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 px-6 py-4 max-w-md">
        <p className="text-sm text-gray-700">
          💬 ทักทาย Line:{' '}
          <a
            href="https://line.me/R/ti/p/~mr.chuti5988"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-yellow-700 underline"
          >
            mr.chuti5988
          </a>
          <br />
          บอกเราว่าคุณหาอะไรอยู่ เราอาจช่วยหาให้ได้
        </p>
      </div>
    </div>
  );
}
