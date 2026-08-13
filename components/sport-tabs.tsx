'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import type { Activity } from '@/lib/courts';

const TABS: { activity: Activity; label: string }[] = [
  { activity: 'pickleball', label: 'Pickleball' },
  { activity: 'tennis', label: 'Tennis' },
  { activity: 'basketball', label: 'Basketball' },
];

const STORAGE_KEY = 'brookfield.activity.v1';

export function rememberedActivity(): Activity | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return TABS.some((tab) => tab.activity === value)
      ? (value as Activity)
      : null;
  } catch {
    return null;
  }
}

/**
 * Sport tabs with the number of open places on each.
 *
 * The count matters more than it looks: the courts overlap, so tennis can read
 * zero purely because someone booked a pickleball court. Showing the number
 * saves opening a tab to find nothing.
 */
export function SportTabs({
  active,
  counts,
  date,
  basePath,
}: {
  active: Activity;
  counts: Record<Activity, number>;
  date: string;
  basePath: string;
}) {
  // Remember the sport so a regular player lands on their own tab next time.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, active);
    } catch {
      // Private browsing — the tab just will not be remembered.
    }
  }, [active]);

  return (
    <nav>
      <ul className="flex gap-2">
        {TABS.map((tab) => {
          const isActive = tab.activity === active;
          const open = counts[tab.activity];

          return (
            <li key={tab.activity} className="flex-1">
              <Link
                href={`${basePath}?date=${date}&sport=${tab.activity}`}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center rounded-xl border px-2 py-2 text-center transition-colors ${
                  isActive
                    ? 'border-court bg-court text-white'
                    : 'border-edge bg-surface'
                }`}
              >
                <span className="text-sm font-semibold">{tab.label}</span>
                <span
                  className={`text-[11px] ${
                    isActive
                      ? 'text-white/80'
                      : open === 0
                        ? 'text-clay'
                        : 'text-muted'
                  }`}
                >
                  {open === 0 ? 'None open' : `${open} open`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
