'use client';

import { useRouter } from 'next/navigation';

import { addDays, formatLongDate } from '@/lib/time';

export function DateNav({ date, basePath }: { date: string; basePath: string }) {
  const router = useRouter();

  function go(next: string) {
    router.push(`${basePath}?date=${next}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => go(addDays(date, -1))}
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-edge active:bg-background"
      >
        ‹
      </button>

      <label className="flex-1">
        <span className="sr-only">Date</span>
        <input
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value) go(event.target.value);
          }}
          className="w-full rounded-xl border border-edge bg-surface px-3 py-2.5 text-center text-sm font-semibold"
        />
        <span className="mt-1 block text-center text-xs text-muted">
          {formatLongDate(date)}
        </span>
      </label>

      <button
        type="button"
        aria-label="Next day"
        onClick={() => go(addDays(date, 1))}
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-edge active:bg-background"
      >
        ›
      </button>
    </div>
  );
}
