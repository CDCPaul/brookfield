/**
 * Moves the database onto phone-based blocking and hour-range closures.
 *
 *   npm run db:migrate-bookers
 *
 * Three changes:
 *  - `blocked_phones`, because the mobile number is the one identity every
 *    booker has; an address is only given up for free court time.
 *  - closures gain an inclusive slot range instead of one slot.
 *  - `sport` is corrected to what was actually played. It used to be derived
 *    from the date, so every basketball booking was filed as tennis or
 *    pickleball depending on the day.
 *
 * Safe to run repeatedly.
 */

import { sql } from 'drizzle-orm';

import { db } from '../lib/db';

async function main() {
  console.log('Creating blocked_phones…');
  await db.execute(sql`
    create table if not exists blocked_phones (
      phone text primary key,
      reason text,
      created_at timestamptz not null default now()
    )
  `);

  // Carry over anything already blocked by household.
  const carried = await db.execute(sql`
    insert into blocked_phones (phone, reason)
    select distinct on (b.phone) b.phone, u.blocked_reason
      from bookings b
      join units u on u.id = b.unit_id
     where u.is_blocked = true
    on conflict (phone) do nothing
    returning phone
  `);
  console.log(`Carried over ${carried.rows.length} blocked number(s).`);

  console.log('Widening closures to an hour range…');
  await db.execute(
    sql`alter table closures add column if not exists slot_from smallint`,
  );
  await db.execute(
    sql`alter table closures add column if not exists slot_to smallint`,
  );
  // A closure that named one slot covered exactly that hour.
  await db.execute(sql`
    update closures
       set slot_from = slot_index, slot_to = slot_index
     where slot_index is not null and slot_from is null
  `);
  await db.execute(sql`alter table closures drop column if exists slot_index`);

  console.log('Correcting the sport on existing bookings…');
  const fixed = await db.execute(sql`
    update bookings
       set sport = case
             when court_option like 'bb%' then 'basketball'
             when court_option = 'tennis' then 'tennis'
             else 'pickleball'
           end
     where sport <> case
             when court_option like 'bb%' then 'basketball'
             when court_option = 'tennis' then 'tennis'
             else 'pickleball'
           end
    returning id
  `);
  console.log(`Corrected ${fixed.rows.length} booking(s).`);

  const [counts] = (
    await db.execute(
      sql`select
            (select count(*) from blocked_phones)::int as blocked,
            (select count(*) from closures)::int as closures`,
    )
  ).rows as { blocked: number; closures: number }[];

  console.log(
    `\n${counts.blocked} blocked number(s), ${counts.closures} closure(s).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
