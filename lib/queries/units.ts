import { asc, eq, ilike, or, sql } from 'drizzle-orm';

import { bookings, db, units, type Unit } from '@/lib/db';
import { buildUnitKey, type UnitInput } from '@/lib/unit-key';

export async function findUnitByKey(unitKey: string): Promise<Unit | null> {
  const [row] = await db
    .select()
    .from(units)
    .where(eq(units.unitKey, unitKey))
    .limit(1);
  return row ?? null;
}

/**
 * Units are not pre-registered; the first booking from an address creates it.
 * The raw spelling is refreshed each time so the admin sees the latest form.
 */
export async function findOrCreateUnit(input: UnitInput): Promise<Unit> {
  const unitKey = buildUnitKey(input);
  const [row] = await db
    .insert(units)
    .values({
      phase: input.phase.trim(),
      block: input.block.trim(),
      lot: input.lot.trim(),
      unitKey,
    })
    .onConflictDoUpdate({
      target: units.unitKey,
      set: {
        phase: input.phase.trim(),
        block: input.block.trim(),
        lot: input.lot.trim(),
      },
    })
    .returning();
  return row;
}

export type UnitSummary = Unit & {
  bookingCount: number;
  noShowCount: number;
  lastBookingDate: string | null;
};

/** Units with their booking history, for the admin roster. */
export async function listUnits(search?: string): Promise<UnitSummary[]> {
  const term = search?.trim();
  const filter = term
    ? or(
        ilike(units.phase, `%${term}%`),
        ilike(units.block, `%${term}%`),
        ilike(units.lot, `%${term}%`),
        ilike(units.unitKey, `%${term}%`),
      )
    : undefined;

  const rows = await db
    .select({
      id: units.id,
      phase: units.phase,
      block: units.block,
      lot: units.lot,
      unitKey: units.unitKey,
      isBlocked: units.isBlocked,
      blockedReason: units.blockedReason,
      createdAt: units.createdAt,
      bookingCount: sql<number>`count(*) filter (where ${bookings.status} = 'booked')::int`,
      noShowCount: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')::int`,
      lastBookingDate: sql<string | null>`max(${bookings.bookingDate})::text`,
    })
    .from(units)
    .leftJoin(bookings, eq(bookings.unitId, units.id))
    .where(filter)
    .groupBy(units.id)
    .orderBy(asc(units.unitKey));

  return rows;
}

export async function setUnitBlocked(
  id: number,
  isBlocked: boolean,
  reason: string | null,
): Promise<void> {
  await db
    .update(units)
    .set({ isBlocked, blockedReason: isBlocked ? reason : null })
    .where(eq(units.id, id));
}
