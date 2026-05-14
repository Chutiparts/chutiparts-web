'use client';

type Props = {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
};

/**
 * FilterChips — single-select chips with active state
 * Click an active chip again to deselect (set to null).
 */
export default function FilterChips({ label, options, value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-gray-600 shrink-0">{label}:</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? null : opt)}
              className={[
                'rounded-full px-4 py-1.5 text-sm font-semibold transition border-2',
                active
                  ? 'bg-yellow-500 text-white border-yellow-500 shadow'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-yellow-400 hover:bg-yellow-50',
              ].join(' ')}
              aria-pressed={active}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
