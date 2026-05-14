'use client';

import { useEffect, useState } from 'react';

type Props = {
  value: string;
  onChange: (q: string) => void;
  placeholder?: string;
};

/**
 * SearchBar — debounced search input
 * - Debounces 200ms before calling onChange to reduce re-renders
 * - Shows clear (✕) button when input has value
 */
export default function SearchBar({ value, onChange, placeholder }: Props) {
  const [local, setLocal] = useState(value);

  // Sync prop -> local when external state changes (e.g. URL nav)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Debounce local -> onChange
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="relative w-full">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        🔍
      </span>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder ?? 'ค้นหาอะไหล่ เช่น ไฟท้าย W140, กันชน, 140-001'}
        className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-10 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
        aria-label="ค้นหาสินค้า"
      />
      {local && (
        <button
          type="button"
          onClick={() => {
            setLocal('');
            onChange('');
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-gray-100 px-2 py-1 text-sm text-gray-600 hover:bg-gray-200"
          aria-label="ล้างคำค้น"
        >
          ✕
        </button>
      )}
    </div>
  );
}
