/**
 * End-to-end check of the booking pipeline against the real database.
 *
 *   npm run smoke
 *
 * Creates bookings, asserts every rule fires, then deletes everything it made.
 */

import { eq, inArray, like, sql } from 'drizzle-orm';

import { bookingResources, bookings, db, units } from '../lib/db';
import { isTennisDay } from '../lib/courts';
import { listBookers, setPhoneBlocked } from '../lib/queries/bookers';
import { phoneOwner, unitOwner } from '../lib/owner';
import { getDayAvailability } from '../lib/queries/availability';
import {
  approveBooking,
  cancelBookingAsOwner,
  createBooking,
  createRequest,
  getBookingGroup,
  getPendingBookings,
  rejectBooking,
  releaseExpiredHolds,
} from '../lib/queries/bookings';
import { PAYMENT_HOLD_MINUTES } from '../lib/payment';
import { saveCourts } from '../lib/queries/settings';
import { addDays, manilaNow } from '../lib/time';
import { buildUnitKey } from '../lib/unit-key';

const UNIT_A = { phase: 'ZZTEST', block: '1', lot: '1' };
const UNIT_B = { phase: 'ZZTEST', block: '2', lot: '2' };
const RESIDENT_A = { ...UNIT_A, bookerType: 'resident' as const };
const RESIDENT_B = { ...UNIT_B, bookerType: 'resident' as const };

const PHONE_A = '09990000001';
const PHONE_B = '09990000002';
const GUEST_PHONE = '09990000003';

const FREE_SLOT = 0; // 06:00
const DAY_SLOT = 4; // 10:00
const NIGHT_SLOT = 13; // 19:00

let failures = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function cleanup() {
  await setPhoneBlocked(PHONE_A, false, null);
  await setPhoneBlocked(PHONE_B, false, null);
  await setPhoneBlocked(GUEST_PHONE, false, null);

  const keys = [buildUnitKey(UNIT_A), buildUnitKey(UNIT_B)];
  const rows = await db.select().from(units).where(inArray(units.unitKey, keys));
  for (const unit of rows) {
    await db.delete(bookings).where(eq(bookings.unitId, unit.id));
    await db.delete(units).where(eq(units.id, unit.id));
  }
  await db.delete(bookings).where(like(bookings.phone, '0999%'));
}

/**
 * The unique index on the resource rows is what actually stops two people
 * taking overlapping courts. Check it rather than trusting the migration.
 */
async function checkResourceGuard() {
  const [row] = (
    await db.execute(
      sql`select indexdef from pg_indexes
          where indexname = 'booking_resources_slot_idx'`,
    )
  ).rows as { indexdef: string }[];

  const definition = row?.indexdef ?? '';
  check(
    'the double-booking guard is a unique index on date, slot and resource',
    definition.includes('UNIQUE') &&
      definition.includes('booking_date') &&
      definition.includes('slot_index') &&
      definition.includes('resource_key'),
    definition || 'index missing — run npm run db:push',
  );
}

async function main() {
  await cleanup();
  await checkResourceGuard();

  // Paid tennis has no published rate, so it ships off. Turn it on to exercise
  // the tennis-versus-pickleball conflict, then put it back.
  await saveCourts({ paidTennisEnabled: true, basketballEnabled: true });

  const today = manilaNow().date;

  // Run against a day nobody has booked, so real reservations neither break
  // the checks nor get disturbed by them.
  let target = addDays(today, 2);
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(today, offset);
    const day = await getDayAvailability(candidate);
    if (day.capacity > 0 && day.openCount === day.capacity) {
      target = candidate;
      break;
    }
  }

  const freeOption = isTennisDay(target) ? 'tennis' : 'pb1';

  console.log(`\nTarget ${target} (free morning: ${freeOption})\n`);
  console.log('Free morning\n');

  const before = await getDayAvailability(target);
  const openBefore = before.openCount;

  const first = await createBooking({
    ...RESIDENT_A,
    date: target,
    slotIndex: FREE_SLOT,
    optionKey: freeOption,
    name: 'Smoke Test A',
    phone: PHONE_A,
  });
  check(
    'a resident can request the free morning',
    first.ok,
    !first.ok ? first.message : '',
  );
  if (!first.ok) {
    await cleanup();
    process.exit(1);
  }

  check(
    'the request starts pending and costs nothing',
    first.booking.status === 'pending' && first.booking.amount === 0,
    `${first.booking.status}/${first.booking.amount}`,
  );

  const resourceRows = await db
    .select()
    .from(bookingResources)
    .where(eq(bookingResources.bookingId, first.booking.id));
  check(
    'it claims one resource row per piece of court',
    resourceRows.length === (freeOption === 'tennis' ? 4 : 1),
    `${resourceRows.length} row(s)`,
  );

  const guestFree = await createBooking({
    bookerType: 'guest',
    date: target,
    slotIndex: 1,
    optionKey: freeOption,
    name: 'Smoke Guest',
    phone: GUEST_PHONE,
  });
  check(
    'a guest cannot take the free morning',
    !guestFree.ok && guestFree.code === 'guest_free_hours',
    guestFree.ok ? 'was accepted' : guestFree.code,
  );

  const missingAddress = await createBooking({
    bookerType: 'resident',
    date: target,
    slotIndex: 1,
    optionKey: freeOption,
    name: 'No Address',
    phone: PHONE_B,
  });
  check(
    'a free booking still needs the household address',
    !missingAddress.ok && missingAddress.code === 'invalid_input',
    missingAddress.ok ? 'was accepted' : missingAddress.code,
  );

  console.log('\nShared courts\n');

  const pickleball = await createBooking({
    ...RESIDENT_A,
    date: target,
    slotIndex: DAY_SLOT,
    optionKey: 'pb2',
    name: 'Smoke Test A',
    phone: PHONE_A,
  });
  check(
    'a paid pickleball court can be booked',
    pickleball.ok && pickleball.booking.amount === 200,
    pickleball.ok ? String(pickleball.booking.amount) : pickleball.message,
  );

  const tennisBlocked = await createBooking({
    ...RESIDENT_B,
    date: target,
    slotIndex: DAY_SLOT,
    optionKey: 'tennis',
    name: 'Smoke Test B',
    phone: PHONE_B,
  });
  check(
    'one pickleball court blocks tennis for that hour',
    !tennisBlocked.ok && tennisBlocked.code === 'taken',
    tennisBlocked.ok ? 'was accepted' : tennisBlocked.code,
  );
  if (!tennisBlocked.ok) {
    check(
      'and it says which court is in the way',
      tennisBlocked.message.includes('Pickleball court 2'),
      tennisBlocked.message,
    );
  }

  // Paid hours are not rationed, so the address is not asked for and not kept.
  const otherCourt = await createBooking({
    bookerType: 'resident',
    date: target,
    slotIndex: DAY_SLOT,
    optionKey: 'pb4',
    name: 'Smoke Test B',
    phone: PHONE_B,
  });
  check(
    'a resident can book a paid court without an address',
    otherCourt.ok,
    !otherCourt.ok ? otherCourt.message : '',
  );
  if (otherCourt.ok) {
    check(
      'and no household is recorded against it',
      otherCourt.booking.unitId === null,
      `unitId=${otherCourt.booking.unitId}`,
    );
  }

  console.log('\nBasketball\n');

  const half = await createBooking({
    bookerType: 'guest',
    date: target,
    slotIndex: NIGHT_SLOT,
    optionKey: 'bbA',
    name: 'Smoke Guest',
    phone: GUEST_PHONE,
  });
  check(
    'a guest can book a basketball half court at the pickleball rate',
    half.ok && half.booking.amount === 350,
    half.ok ? String(half.booking.amount) : half.message,
  );

  const fullBlocked = await createBooking({
    ...RESIDENT_A,
    date: target,
    slotIndex: NIGHT_SLOT,
    optionKey: 'bbFull',
    name: 'Smoke Test A',
    phone: PHONE_A,
  });
  check(
    'one half makes the full court unbookable',
    !fullBlocked.ok && fullBlocked.code === 'taken',
    fullBlocked.ok ? 'was accepted' : fullBlocked.code,
  );

  const otherHalf = await createBooking({
    ...RESIDENT_A,
    date: target,
    slotIndex: NIGHT_SLOT,
    optionKey: 'bbB',
    name: 'Smoke Test A',
    phone: PHONE_A,
  });
  check(
    'the other half is still free',
    otherHalf.ok,
    !otherHalf.ok ? otherHalf.message : '',
  );

  console.log('\nBooking several hours at once\n');

  const many = await createRequest({
    bookerType: 'guest',
    date: target,
    picks: [
      { slotIndex: DAY_SLOT + 2, optionKey: 'pb1' },
      { slotIndex: DAY_SLOT + 3, optionKey: 'pb1' },
      { slotIndex: DAY_SLOT + 4, optionKey: 'pb1' },
    ],
    name: 'Smoke Multi',
    phone: PHONE_A,
  });
  check(
    'three hours can be requested together',
    many.ok && many.bookings.length === 3,
    many.ok ? `${many.bookings.length}` : many.message,
  );
  if (many.ok) {
    check(
      'they share a group and one total',
      many.total === 600 &&
        many.bookings.every((entry) => entry.groupCode === many.groupCode),
      `total ${many.total}`,
    );
    check(
      'the group reads back as one request',
      (await getBookingGroup(many.groupCode)).length === 3,
    );
  }

  const selfConflict = await createRequest({
    bookerType: 'guest',
    date: target,
    picks: [
      { slotIndex: NIGHT_SLOT + 1, optionKey: 'pb1' },
      { slotIndex: NIGHT_SLOT + 1, optionKey: 'tennis' },
    ],
    name: 'Smoke Multi',
    phone: PHONE_B,
  });
  check(
    'a request cannot conflict with itself',
    !selfConflict.ok && selfConflict.code === 'taken',
    selfConflict.ok ? 'was accepted' : selfConflict.code,
  );

  const partial = await createRequest({
    bookerType: 'guest',
    date: target,
    picks: [
      { slotIndex: NIGHT_SLOT + 2, optionKey: 'pb1' },
      { slotIndex: DAY_SLOT, optionKey: 'pb2' }, // already taken above
    ],
    name: 'Smoke Multi',
    phone: PHONE_B,
  });
  check(
    'one unavailable hour rejects the whole request',
    !partial.ok,
    partial.ok ? 'was accepted' : '',
  );
  if (!partial.ok) {
    const leaked = await getDayAvailability(target);
    const slot = leaked.groups
      .flatMap((group) => group.slots)
      .find((entry) => entry.slotIndex === NIGHT_SLOT + 2);
    check(
      'and leaves nothing behind',
      slot?.options.find((o) => o.option.key === 'pb1')?.status === 'open',
      slot?.options.find((o) => o.option.key === 'pb1')?.status,
    );
  }

  console.log('\nUnpaid holds expire\n');

  const holdSlot = NIGHT_SLOT + 4;
  const stale = await createRequest({
    bookerType: 'guest',
    date: target,
    picks: [{ slotIndex: holdSlot, optionKey: 'pb1' }],
    name: 'Smoke Hold',
    phone: GUEST_PHONE,
  });
  check('a paid request holds its court', stale.ok, stale.ok ? '' : stale.message);

  if (stale.ok) {
    const blockedWhileHeld = await createRequest({
      bookerType: 'guest',
      date: target,
      picks: [{ slotIndex: holdSlot, optionKey: 'pb1' }],
      name: 'Smoke Other',
      phone: PHONE_A,
    });
    check(
      'nobody else can take it while the hold stands',
      !blockedWhileHeld.ok && blockedWhileHeld.code === 'taken',
      blockedWhileHeld.ok ? 'was accepted' : blockedWhileHeld.code,
    );

    // Age the request past the payment window.
    await db
      .update(bookings)
      .set({
        createdAt: new Date(Date.now() - (PAYMENT_HOLD_MINUTES + 1) * 60_000),
      })
      .where(eq(bookings.id, stale.bookings[0].id));

    const released = await releaseExpiredHolds();
    check('the sweep releases it', released >= 1, `${released} released`);

    const rebooked = await createRequest({
      bookerType: 'guest',
      date: target,
      picks: [{ slotIndex: holdSlot, optionKey: 'pb1' }],
      name: 'Smoke Other',
      phone: PHONE_A,
    });
    check(
      'and the court can be booked again',
      rebooked.ok,
      rebooked.ok ? '' : rebooked.message,
    );

    const [after] = await db
      .select({ status: bookings.status, by: bookings.cancelledBy })
      .from(bookings)
      .where(eq(bookings.id, stale.bookings[0].id));
    check(
      'the expired request is recorded as cancelled by the system',
      after?.status === 'cancelled' && after.by === 'system',
      `${after?.status}/${after?.by}`,
    );
  }

  console.log('\nBlocking\n');

  await setPhoneBlocked(PHONE_B, true, 'Smoke test');
  const blocked = await createRequest({
    bookerType: 'guest',
    date: target,
    picks: [{ slotIndex: NIGHT_SLOT + 3, optionKey: 'pb3' }],
    name: 'Smoke Test B',
    phone: PHONE_B,
  });
  check(
    'a blocked number cannot book',
    !blocked.ok && blocked.code === 'booker_blocked',
    blocked.ok ? 'was accepted' : blocked.code,
  );

  // Residents are identified by household, so blocking has to reach them too.
  const blockedResident = await createRequest({
    ...RESIDENT_B,
    date: target,
    picks: [{ slotIndex: NIGHT_SLOT + 3, optionKey: 'pb3' }],
    name: 'Smoke Test B',
    phone: PHONE_B,
  });
  check(
    'and cannot book as a resident either',
    !blockedResident.ok && blockedResident.code === 'booker_blocked',
    blockedResident.ok ? 'was accepted' : blockedResident.code,
  );

  await setPhoneBlocked(PHONE_B, false, null);
  const unblocked = await createRequest({
    bookerType: 'guest',
    date: target,
    picks: [{ slotIndex: NIGHT_SLOT + 3, optionKey: 'pb3' }],
    name: 'Smoke Test B',
    phone: PHONE_B,
  });
  check(
    'unblocking lets them book again',
    unblocked.ok,
    unblocked.ok ? '' : unblocked.message,
  );

  const listed = (await listBookers()).filter((entry) =>
    entry.phone.startsWith('0999'),
  );
  check(
    'bookers are listed by mobile number',
    listed.length > 0 && listed.every((entry) => entry.bookings > 0),
    `${listed.length} booker(s)`,
  );

  console.log('\nApproval\n');

  const queue = await getPendingBookings(today);
  const ours = queue.filter((entry) => entry.phone.startsWith('0999'));
  check('requests reach the approval queue', ours.length >= 5, `${ours.length}`);

  if (pickleball.ok) {
    check(
      'the association can approve and record payment',
      (await approveBooking(pickleball.booking.id, true)).ok,
    );
  }

  if (otherCourt.ok) {
    check(
      'the association can decline',
      (await rejectBooking(otherCourt.booking.id, 'Court reserved')).ok,
    );

    const freed = await db
      .select()
      .from(bookingResources)
      .where(eq(bookingResources.bookingId, otherCourt.booking.id));
    check('declining releases the court', freed.length === 0, `${freed.length}`);
  }

  console.log('\nCancellation\n');

  check(
    'another unit cannot cancel it',
    !(await cancelBookingAsOwner(first.booking.id, unitOwner(UNIT_B))).ok,
  );
  check(
    'the booker can cancel their own request',
    (await cancelBookingAsOwner(first.booking.id, unitOwner(UNIT_A))).ok,
  );

  if (half.ok) {
    check(
      'a guest can cancel with their own number',
      (await cancelBookingAsOwner(half.booking.id, phoneOwner(GUEST_PHONE))).ok,
    );
  }

  const rebooked = await createBooking({
    ...RESIDENT_B,
    date: target,
    slotIndex: FREE_SLOT,
    optionKey: freeOption,
    name: 'Smoke Test B',
    phone: PHONE_B,
  });
  check(
    'the released slot can be requested again',
    rebooked.ok,
    !rebooked.ok ? rebooked.message : '',
  );

  await cleanup();

  // Measure before restoring the setting: turning paid tennis back off removes
  // an option from every paid hour, which would look like a leak.
  const final = await getDayAvailability(target);
  check(
    'cleanup restored the original availability',
    final.openCount === openBefore,
    `${final.openCount} vs ${openBefore}`,
  );

  await saveCourts({ paidTennisEnabled: false, basketballEnabled: true });

  console.log(
    failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await cleanup();
  process.exit(1);
});
