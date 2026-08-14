import { eq } from 'drizzle-orm';

import { db, units, type Unit } from '@/lib/db';
import { buildUnitKey, type UnitInput } from '@/lib/unit-key';

/**
 * Households, kept only to ration free court time.
 *
 * There is no admin screen for them: blocking and booking history are tracked
 * by mobile number instead, because that is the identity everyone has — an
 * address is asked for only when the court time is free.
 */
export async function findUnitByKey(unitKey: string): Promise<Unit | null> {
  const [row] = await db
    .select()
    .from(units)
    .where(eq(units.unitKey, unitKey))
    .limit(1);
  return row ?? null;
}

/**
 * Units are not pre-registered; the first free booking from an address creates
 * one. The raw spelling is refreshed each time so the latest form is kept.
 */
export async function findOrCreateUnit(input: UnitInput): Promise<Unit> {
  const [row] = await db
    .insert(units)
    .values({
      phase: input.phase.trim(),
      block: input.block.trim(),
      lot: input.lot.trim(),
      unitKey: buildUnitKey(input),
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
