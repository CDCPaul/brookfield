/**
 * Remembers who is booking, on their own phone.
 *
 * There are no accounts, so this is what makes the second booking quick and
 * what lets "My bookings" open straight to the right person. Guests have no
 * address, so their entry only carries a name and number.
 */

import type { BookerType } from './owner';

const STORAGE_KEY = 'brookfield.booker.v1';

export type StoredBooker = {
  bookerType: BookerType;
  name: string;
  phone: string;
  phase: string;
  block: string;
  lot: string;
};

export const EMPTY_BOOKER: StoredBooker = {
  bookerType: 'resident',
  name: '',
  phone: '',
  phase: '',
  block: '',
  lot: '',
};

export const ADDRESS_FIELDS = ['phase', 'block', 'lot'] as const;
export const BOOKER_FIELDS = [
  'name',
  'phone',
  'phase',
  'block',
  'lot',
] as const;

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

/** Lenient on purpose: an entry saved by an older version still prefills. */
function parse(value: unknown): StoredBooker | null {
  if (typeof value !== 'object' || value === null) return null;
  const source = value as Record<string, unknown>;

  const bookerType = source.bookerType === 'guest' ? 'guest' : 'resident';

  return {
    bookerType,
    name: readString(source, 'name'),
    phone: readString(source, 'phone'),
    phase: readString(source, 'phase'),
    block: readString(source, 'block'),
    lot: readString(source, 'lot'),
  };
}

export function loadBooker(): StoredBooker | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveBooker(booker: StoredBooker): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(booker));
  } catch {
    // Private browsing or a full quota — not worth interrupting the booking.
  }
}

/** Merges into whatever is already remembered, so a partial form keeps the rest. */
export function mergeBooker(partial: Partial<StoredBooker>): void {
  saveBooker({ ...(loadBooker() ?? EMPTY_BOOKER), ...partial });
}
