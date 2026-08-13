import Link from 'next/link';

import type { Activity } from '@/lib/courts';
import type { DaySummary } from '@/lib/queries/availability';
import { formatShortDate, weekdayShort } from '@/lib/time';

export function DateStrip({
  days,
  selected,
  activity,
}: {
  days: DaySummary[];
  selected: string;
  activity: Activity;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2">
        {days.map((day) => {
          const active = day.date === selected;
          const unavailable = day.openCount === 0;
          const label =
            day.capacity === 0
              ? 'Not today'
              : day.allPast
                ? 'Over'
                : unavailable
                  ? 'Full'
                  : `${day.openCount} left`;

          return (
            <li key={day.date}>
              <Link
                href={`/book?date=${day.date}&sport=${activity}`}
                aria-current={active ? 'date' : undefined}
                className={`flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 text-center transition-colors ${
                  active
                    ? 'border-court bg-court text-white'
                    : 'border-edge bg-surface'
                }`}
              >
                <span
                  className={`text-[11px] font-medium ${
                    active ? 'text-white/80' : 'text-muted'
                  }`}
                >
                  {day.isToday ? 'Today' : weekdayShort(day.date)}
                </span>
                <span className="text-sm font-semibold">
                  {formatShortDate(day.date).split(' ')[1]}
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    active
                      ? 'text-white/80'
                      : unavailable && !day.allPast
                        ? 'text-clay'
                        : 'text-muted'
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
