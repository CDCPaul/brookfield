import { DEFAULT_COURT_CONFIG, type CourtConfig } from '@/lib/courts';
import { db, settings } from '@/lib/db';
import { DEFAULT_PAYMENT, type PaymentConfig } from '@/lib/payment';
import { DEFAULT_LIMITS, type BookingLimits } from '@/lib/rules';
import {
  DEFAULT_PRICING,
  DEFAULT_SCHEDULE,
  OPEN_HOUR,
  LAST_HOUR,
  type Pricing,
  type ScheduleConfig,
} from '@/lib/schedule';

const KEYS = {
  enabled: 'limits_enabled',
  maxPerDay: 'max_per_day',
  maxPerWeek: 'max_per_week',
  advanceDays: 'advance_days',
  schedule: 'schedule',
  pricing: 'pricing',
  payment: 'payment',
  courts: 'courts',
} as const;

export type { PaymentConfig } from '@/lib/payment';

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readPositiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function readHour(value: unknown, fallback: number): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= OPEN_HOUR &&
    value <= LAST_HOUR
    ? value
    : fallback;
}

async function readAll(): Promise<Map<string, unknown>> {
  const rows = await db.select().from(settings);
  return new Map(rows.map((row) => [row.key, row.value]));
}

async function write(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export type AssociationSettings = {
  limits: BookingLimits;
  schedule: ScheduleConfig;
  pricing: Pricing;
  payment: PaymentConfig;
  courts: CourtConfig;
};

function toCourts(stored: Map<string, unknown>): CourtConfig {
  const raw = stored.get(KEYS.courts);
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;

  return {
    paidTennisEnabled: readBoolean(
      source.paidTennisEnabled,
      DEFAULT_COURT_CONFIG.paidTennisEnabled,
    ),
    basketballEnabled: readBoolean(
      source.basketballEnabled,
      DEFAULT_COURT_CONFIG.basketballEnabled,
    ),
  };
}

function readText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function toPayment(stored: Map<string, unknown>): PaymentConfig {
  const raw = stored.get(KEYS.payment);
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;

  return {
    gcashName: readText(source.gcashName, DEFAULT_PAYMENT.gcashName),
    gcashNumber: readText(source.gcashNumber, DEFAULT_PAYMENT.gcashNumber),
    notes: readText(source.notes, DEFAULT_PAYMENT.notes),
  };
}

function toLimits(stored: Map<string, unknown>): BookingLimits {
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

function toSchedule(stored: Map<string, unknown>): ScheduleConfig {
  const raw = stored.get(KEYS.schedule);
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;

  const schedule: ScheduleConfig = {
    freeUntilHour: readHour(
      source.freeUntilHour,
      DEFAULT_SCHEDULE.freeUntilHour,
    ),
    dayUntilHour: readHour(source.dayUntilHour, DEFAULT_SCHEDULE.dayUntilHour),
    closeHour: readHour(source.closeHour, DEFAULT_SCHEDULE.closeHour),
  };

  // A stored config with crossed boundaries would silently make whole tiers
  // vanish, so fall back rather than serve nonsense.
  const ordered =
    schedule.freeUntilHour <= schedule.dayUntilHour &&
    schedule.dayUntilHour <= schedule.closeHour;
  return ordered ? schedule : DEFAULT_SCHEDULE;
}

function toPricing(stored: Map<string, unknown>): Pricing {
  const raw = stored.get(KEYS.pricing);
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;

  const tier = (name: 'day' | 'night') => {
    const value = source[name];
    const entry = (
      typeof value === 'object' && value !== null ? value : {}
    ) as Record<string, unknown>;
    return {
      tennis: readPositiveInt(entry.tennis, DEFAULT_PRICING[name].tennis),
      pickleball: readPositiveInt(
        entry.pickleball,
        DEFAULT_PRICING[name].pickleball,
      ),
    };
  };

  return { day: tier('day'), night: tier('night') };
}

/** Everything the booking rules need, in one round trip. */
export async function getSettings(): Promise<AssociationSettings> {
  const stored = await readAll();
  return {
    limits: toLimits(stored),
    schedule: toSchedule(stored),
    pricing: toPricing(stored),
    payment: toPayment(stored),
    courts: toCourts(stored),
  };
}

export async function getLimits(): Promise<BookingLimits> {
  return toLimits(await readAll());
}

export async function saveLimits(limits: BookingLimits): Promise<void> {
  await write(KEYS.enabled, limits.enabled);
  await write(KEYS.maxPerDay, limits.maxPerDay);
  await write(KEYS.maxPerWeek, limits.maxPerWeek);
  await write(KEYS.advanceDays, limits.advanceDays);
}

export async function saveSchedule(schedule: ScheduleConfig): Promise<void> {
  await write(KEYS.schedule, schedule);
}

export async function savePricing(pricing: Pricing): Promise<void> {
  await write(KEYS.pricing, pricing);
}

export async function savePayment(payment: PaymentConfig): Promise<void> {
  await write(KEYS.payment, payment);
}

export async function saveCourts(courts: CourtConfig): Promise<void> {
  await write(KEYS.courts, courts);
}
