/**
 * Deletes every booking and unit — for wiping test data before go-live.
 *
 *   npm run db:clear -- --yes
 *
 * Closures and settings are left alone. Requires --yes so it cannot run by
 * accident.
 */

import { bookings, db, units } from '../lib/db';

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error(
      'Refusing to run without --yes.\n' +
        'This deletes ALL bookings and units.\n' +
        '  npm run db:clear -- --yes',
    );
    process.exit(1);
  }

  const deletedBookings = await db
    .delete(bookings)
    .returning({ id: bookings.id });
  const deletedUnits = await db.delete(units).returning({ id: units.id });

  const remainingBookings = await db.select({ id: bookings.id }).from(bookings);
  const remainingUnits = await db.select({ id: units.id }).from(units);

  console.log(
    `Deleted ${deletedBookings.length} booking(s) and ${deletedUnits.length} unit(s).`,
  );
  console.log(
    `Remaining: ${remainingBookings.length} booking(s), ${remainingUnits.length} unit(s).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
