import { and, desc, eq, gte, lte } from 'drizzle-orm';

import type { Venue } from '@/lib/courts';
import { closures, db } from '@/lib/db';
import type { Closure } from '@/lib/rules';
import type { DateStr } from '@/lib/time';

function toClosure(row: typeof closures.$inferSelect): Closure {
  return {
    dateFrom: row.dateFrom,
    dateTo: row.dateTo,
    slotFrom: row.slotFrom,
    slotTo: row.slotTo,
    venue: (row.venue as Venue | null) ?? null,
    reason: row.reason,
  };
}

/** Closures overlapping the inclusive date range. */
export async function getClosures(
  from: DateStr,
  to: DateStr,
): Promise<Closure[]> {
  const rows = await db
    .select()
    .from(closures)
    .where(and(lte(closures.dateFrom, to), gte(closures.dateTo, from)));
  return rows.map(toClosure);
}

export async function listClosures() {
  return db.select().from(closures).orderBy(desc(closures.dateFrom));
}

export async function createClosure(input: {
  dateFrom: DateStr;
  dateTo: DateStr;
  slotFrom: number | null;
  slotTo: number | null;
  venue: Venue | null;
  reason: string;
}) {
  const [row] = await db.insert(closures).values(input).returning();
  return row;
}

export async function deleteClosure(id: number): Promise<void> {
  await db.delete(closures).where(eq(closures.id, id));
}
