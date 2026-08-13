/**
 * Moves the database onto the shared-resource court model.
 *
 *   npm run db:migrate-courts
 *
 * Bookings used to conflict on a court number, which cannot express that the
 * tennis court *is* the four pickleball courts. Conflicts now live in
 * booking_resources, one row per piece of court held.
 *
 * Safe to run repeatedly.
 */

import { sql } from 'drizzle-orm';

import { db } from '../lib/db';

async function main() {
  console.log('Adding columns…');
  await db.execute(
    sql`alter table bookings add column if not exists court_option text not null default 'tennis'`,
  );
  await db.execute(sql`alter table bookings alter column court_no set default 1`);
  await db.execute(sql`alter table closures add column if not exists venue text`);

  console.log('Creating booking_resources…');
  await db.execute(sql`
    create table if not exists booking_resources (
      booking_id integer not null references bookings(id) on delete cascade,
      booking_date date not null,
      slot_index smallint not null,
      resource_key text not null,
      primary key (booking_id, resource_key)
    )
  `);
  await db.execute(
    sql`create unique index if not exists booking_resources_slot_idx
        on booking_resources (booking_date, slot_index, resource_key)`,
  );
  await db.execute(
    sql`create index if not exists booking_resources_date_idx
        on booking_resources (booking_date)`,
  );
  await db.execute(
    sql`create index if not exists bookings_status_idx on bookings (status)`,
  );

  // Old rows carry a sport and a court number. Tennis used the whole court;
  // pickleball used the quarter matching its number.
  console.log('Backfilling court_option…');
  await db.execute(
    sql`update bookings set court_option = 'tennis'
        where sport = 'tennis' and court_option = 'tennis'`,
  );
  await db.execute(
    sql`update bookings set court_option = 'pb' || court_no
        where sport <> 'tennis' and court_no between 1 and 4`,
  );

  console.log('Backfilling resources for bookings that still hold a slot…');
  await db.execute(sql`
    insert into booking_resources (booking_id, booking_date, slot_index, resource_key)
    select b.id, b.booking_date, b.slot_index,
           case when b.court_option = 'tennis' then q.key
                when b.court_option like 'pb%' then 'T' || right(b.court_option, 1)
                when b.court_option = 'bbA' then 'B1'
                when b.court_option = 'bbB' then 'B2'
                else q.key end
      from bookings b
      cross join lateral (
        select unnest(
          case when b.court_option = 'tennis' then array['T1','T2','T3','T4']
               when b.court_option = 'bbFull' then array['B1','B2']
               else array['X'] end
        ) as key
      ) q
     where b.status not in ('cancelled', 'rejected')
    on conflict do nothing
  `);

  // The old guard is replaced by the resource index.
  console.log('Dropping the old slot index…');
  await db.execute(sql`drop index if exists bookings_active_slot_idx`);
  await db.execute(sql`alter table closures drop column if exists court_no`);

  const [counts] = (
    await db.execute(
      sql`select
            (select count(*) from bookings where status not in ('cancelled','rejected'))::int as live,
            (select count(*) from booking_resources)::int as resources`,
    )
  ).rows as { live: number; resources: number }[];

  console.log(
    `\n${counts.live} live booking(s) holding ${counts.resources} resource row(s).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
