'use client';

import { useState, useEffect } from 'react';
import FilterChips from './FilterChips';

type Props = {
  models: string[];
  categories: string[];
  model: string | null;
  category: string | null;
  onChangeModel: (v: string | null) => void;
  onChangeCategory: (v: string | null) => void;
};

/**
 * FilterDrawer — mobile-only collapsible filter panel
 * On desktop (md:), filters render inline above the grid instead.
 *
 * Active filter count badge appears on the trigger button.
 */
export default function FilterDrawer({
  models,
  categories,
  model,
  category,
  onChangeModel,
  onChangeCategory,
}: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = (model ? 1 : 0) + (category ? 1 : 0);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Trigger button — mobile only */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-white font-semibold"
        aria-label="เปิดตัวกรอง"
      >
        <span>🎚 ตัวกรอง</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-yellow-500 px-2 text-xs">
            {activeCount}
          </span>
        )}
      </button>

      {/* Desktop inline filters */}
      <div className="hidden md:flex flex-col gap-3">
        <FilterChips
          label="รุ่น"
          options={models}
          value={model}
          onChange={onChangeModel}
        />
        <FilterChips
          label="หมวด"
          options={categories}
          value={category}
          onChange={onChangeCategory}
        />
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className={[
          'md:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform',
          'rounded-t-2xl bg-white p-6 shadow-2xl max-h-[80vh] overflow-y-auto',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label="ตัวกรองสินค้า"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">🎚 ตัวกรอง</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 hover:bg-gray-200"
            aria-label="ปิดตัวกรอง"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          <FilterChips
            label="รุ่น"
            options={models}
            value={model}
            onChange={onChangeModel}
          />
          <FilterChips
            label="หมวด"
            options={categories}
            value={category}
            onChange={onChangeCategory}
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-6 w-full rounded-lg bg-yellow-500 px-4 py-3 font-bold text-white hover:bg-yellow-600"
        >
          ดูผลลัพธ์
        </button>
      </div>
    </>
  );
}
