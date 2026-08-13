/**
 * Remembers the resident's own details on their phone.
 *
 * There are no accounts, so this is what makes the second booking quick and
 * what lets "My bookings" open straight to the right household.
 */

const STORAGE_KEY = 'brookfield.unit.v1';

export type StoredUnit = {
  phase: string;
  block: string;
  lot: string;
  name: string;
  phone: string;
};

function isStoredUnit(value: unknown): value is StoredUnit {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (['phase', 'block', 'lot', 'name', 'phone'] as const).every(
    (key) => typeof candidate[key] === 'string',
  );
}

export function loadUnit(): StoredUnit | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredUnit(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export const STORED_UNIT_FIELDS = [
  'name',
  'phase',
  'block',
  'lot',
  'phone',
] as const;

/** Merges into whatever is already remembered, so a partial form keeps the rest. */
export function mergeUnit(partial: Partial<StoredUnit>): void {
  const current = loadUnit() ?? {
    phase: '',
    block: '',
    lot: '',
    name: '',
    phone: '',
  };
  saveUnit({ ...current, ...partial });
}

export function saveUnit(unit: StoredUnit): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unit));
  } catch {
    // Private browsing or a full quota — not worth interrupting the booking.
  }
}

export function clearUnit(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
