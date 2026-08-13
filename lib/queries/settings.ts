import { db, settings } from '@/lib/db';
import { DEFAULT_LIMITS, type BookingLimits } from '@/lib/rules';

const KEYS = {
  enabled: 'limits_enabled',
  maxPerDay: 'max_per_day',
  maxPerWeek: 'max_per_week',
  advanceDays: 'advance_days',
} as const;

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readPositiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

/** Booking limits as configured by the association, falling back to defaults. */
export async function getLimits(): Promise<BookingLimits> {
  const rows = await db.select().from(settings);
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  return {
    enabled: readBoolean(stored.get(KEYS.enabled), DEFAULT_LIMITS.enabled),
    maxPerDay: readPositiveInt(
      stored.get(KEYS.maxPerDay),
      DEFAULT_LIMITS.maxPerDay,
    ),
    maxPerWeek: readPositiveInt(
      stored.get(KEYS.maxPerWeek),
      DEFAULT_LIMITS.maxPerWeek,
    ),
    advanceDays: readPositiveInt(
      stored.get(KEYS.advanceDays),
      DEFAULT_LIMITS.advanceDays,
    ),
  };
}

export async function saveLimits(limits: BookingLimits): Promise<void> {
  const entries: [string, unknown][] = [
    [KEYS.enabled, limits.enabled],
    [KEYS.maxPerDay, limits.maxPerDay],
    [KEYS.maxPerWeek, limits.maxPerWeek],
    [KEYS.advanceDays, limits.advanceDays],
  ];

  for (const [key, value] of entries) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}
