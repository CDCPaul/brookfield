/**
 * Repairs the partial unique index that prevents double-booking.
 *
 *   npm run db:repair
 *
 * `drizzle-kit push` does not notice when the WHERE clause of a partial index
 * changes — it leaves the old predicate in place and reports success. When the
 * approval workflow landed, the statuses changed from 'booked' to
 * 'pending'/'confirmed', so the stale predicate matched nothing and the guard
 * was silently doing nothing.
 *
 * Safe to run repeatedly.
 */

import { sql } from 'drizzle-orm';

import { db } from '../lib/db';

const INDEX = 'bookings_active_slot_idx';
const PREDICATE = `(status <> ALL (ARRAY['cancelled'::text, 'rejected'::text]))`;

async function main() {
  // Bookings made before the approval workflow existed were already agreed.
  const migrated = await db.execute(
    sql`update bookings set status = 'confirmed' where status = 'booked' returning id`,
  );
  console.log(`Migrated ${migrated.rows.length} 'booked' row(s) to 'confirmed'.`);

  await db.execute(sql`drop index if exists ${sql.identifier(INDEX)}`);
  await db.execute(
    sql`create unique index ${sql.identifier(INDEX)}
        on bookings (booking_date, sport, court_no, slot_index)
        where status not in ('cancelled', 'rejected')`,
  );

  const [row] = (
    await db.execute(
      sql`select indexdef from pg_indexes where indexname = ${INDEX}`,
    )
  ).rows as { indexdef: string }[];

  console.log(`\n${row?.indexdef ?? 'index missing'}\n`);

  const correct = row?.indexdef.includes(PREDICATE) ?? false;
  console.log(
    correct
      ? 'Double-booking guard is in place.'
      : 'WARNING: predicate does not look right — check manually.',
  );

  process.exit(correct ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
