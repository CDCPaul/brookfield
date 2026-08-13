/**
 * End-to-end check of the booking pipeline against the real database.
 *
 *   npm run smoke
 *
 * Creates bookings, asserts every rule fires, then deletes everything it made.
 */

import { eq, inArray, like, sql } from 'drizzle-orm';

import { bookings, db, units } from '../lib/db';
import { phoneOwner, unitOwner } from '../lib/owner';
import { getDayAvailability } from '../lib/queries/availability';
import {
  approveBooking,
  cancelBookingAsOwner,
  createBooking,
  getPendingBookings,
  rejectBooking,
  submitPaymentReference,
} from '../lib/queries/bookings';
import { addDays, manilaNow } from '../lib/time';
import { buildUnitKey } from '../lib/unit-key';

const UNIT_A = { phase: 'ZZTEST', block: '1', lot: '1' };
const UNIT_B = { phase: 'ZZTEST', block: '2', lot: '2' };

const RESIDENT_A = { ...UNIT_A, bookerType: 'resident' as const };
const RESIDENT_B = { ...UNIT_B, bookerType: 'resident' as const };

// Reserved test range numbers, so a real resident can never collide.
const PHONE_A = '09990000001';
const PHONE_B = '09990000002';
const GUEST_PHONE = '09990000003';

// Slot index n starts at hour 6 + n.
const FREE_SLOT = 0; // 06:00
const FREE_SLOT_2 = 1; // 07:00
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
  const keys = [buildUnitKey(UNIT_A), buildUnitKey(UNIT_B)];
  const rows = await db.select().from(units).where(inArray(units.unitKey, keys));
  for (const unit of rows) {
    await db.delete(bookings).where(eq(bookings.unitId, unit.id));
    await db.delete(units).where(eq(units.id, unit.id));
  }
  // Guest bookings have no unit to hang off, so clear them by number.
  await db.delete(bookings).where(like(bookings.phone, '0999%'));
}

/**
 * `drizzle-kit push` silently ignores changes to a partial index predicate, so
 * the guard against double-booking can rot without anything failing. Check it
 * directly rather than trusting the migration.
 */
async function checkSlotGuard() {
  const [row] = (
    await db.execute(
      sql`select indexdef from pg_indexes
          where indexname = 'bookings_active_slot_idx'`,
    )
  ).rows as { indexdef: string }[];

  const definition = row?.indexdef ?? '';
  const covers = (status: string) =>
    definition.includes('<> ALL') && !definition.includes(`'${status}'::text`);

  check(
    'the double-booking guard covers pending and confirmed bookings',
    covers('pending') && covers('confirmed'),
    definition || 'index missing — run npm run db:repair',
  );
}

async function main() {
  await cleanup();
  await checkSlotGuard();

  const today = manilaNow().date;
  // Pick a day far enough out that no slot has started yet.
  const target = addDays(today, 2);

  const before = await getDayAvailability(target);
  const openBefore = before.openCount;
  const court = before.groups[0].slots[0].courts[0].courtNo;
  const sport = before.sport;

  console.log(`\nTarget date ${target} (${sport})\n`);
  console.log('Free morning\n');

  const first = await createBooking({
    ...RESIDENT_A,
    date: target,
    slotIndex: FREE_SLOT,
    courtNo: court,
    name: 'Smoke Test A',
    phone: PHONE_A,
  });
  check(
    'a resident can request a free slot',
    first.ok,
    !first.ok ? first.message : '',
  );
  if (!first.ok) {
    await cleanup();
    process.exit(1);
  }

  check(
    'the request starts pending and costs nothing',
    first.booking.status === 'pending' &&
      first.booking.amount === 0 &&
      first.booking.tier === 'free' &&
      first.booking.paymentStatus === 'none',
    `${first.booking.status}/${first.booking.amount}/${first.booking.paymentStatus}`,
  );

  const afterOne = await getDayAvailability(target);
  check(
    'a pending request already holds the slot',
    afterOne.openCount === openBefore - 1,
    `${openBefore} -> ${afterOne.openCount}`,
  );

  const sameSlot = await createBooking({
    ...RESIDENT_B,
    date: target,
    slotIndex: FREE_SLOT,
    courtNo: court,
    name: 'Smoke Test B',
    phone: PHONE_B,
  });
  check(
    'nobody else can take a slot that is pending',
    !sameSlot.ok && sameSlot.code === 'taken',
    sameSlot.ok ? 'was accepted' : sameSlot.code,
  );

  const sameDay = await createBooking({
    ...RESIDENT_A,
    date: target,
    slotIndex: FREE_SLOT_2,
    courtNo: court,
    name: 'Smoke Test A',
    phone: PHONE_A,
  });
  check(
    'the daily free limit applies to the same unit',
    !sameDay.ok && sameDay.code === 'day_limit',
    sameDay.ok ? 'was accepted' : sameDay.code,
  );

  console.log('\nPaid hours\n');

  const paid = await createBooking({
    ...RESIDENT_A,
    date: target,
    slotIndex: DAY_SLOT,
    courtNo: court,
    name: 'Smoke Test A',
    phone: PHONE_A,
  });
  check(
    'a paid slot is not blocked by the free-hour limit',
    paid.ok,
    !paid.ok ? paid.message : '',
  );

  const expectedDay = sport === 'tennis' ? 350 : 200;
  if (paid.ok) {
    check(
      `the daytime fee is charged (${expectedDay})`,
      paid.booking.amount === expectedDay &&
        paid.booking.tier === 'day' &&
        paid.booking.paymentStatus === 'unpaid',
      `${paid.booking.amount}/${paid.booking.tier}/${paid.booking.paymentStatus}`,
    );
  }

  const night = await createBooking({
    ...RESIDENT_B,
    date: target,
    slotIndex: NIGHT_SLOT,
    courtNo: court,
    name: 'Smoke Test B',
    phone: PHONE_B,
  });
  const expectedNight = sport === 'tennis' ? 400 : 250;
  check(
    `the evening fee is higher (${expectedNight})`,
    night.ok && night.booking.amount === expectedNight,
    night.ok ? String(night.booking.amount) : night.message,
  );

  console.log('\nGuests\n');

  const guestFree = await createBooking({
    bookerType: 'guest',
    date: target,
    slotIndex: FREE_SLOT_2,
    courtNo: court,
    name: 'Smoke Guest',
    phone: GUEST_PHONE,
  });
  check(
    'a guest cannot take the free morning',
    !guestFree.ok && guestFree.code === 'guest_free_hours',
    guestFree.ok ? 'was accepted' : guestFree.code,
  );

  const guestPaid = await createBooking({
    bookerType: 'guest',
    date: target,
    slotIndex: DAY_SLOT + 1,
    courtNo: court,
    name: 'Smoke Guest',
    phone: GUEST_PHONE,
  });
  check(
    'a guest can book and is charged for a paid hour',
    guestPaid.ok &&
      guestPaid.booking.amount === expectedDay &&
      guestPaid.booking.unitId === null,
    guestPaid.ok ? String(guestPaid.booking.amount) : guestPaid.message,
  );

  console.log('\nPayment and approval\n');

  if (paid.ok) {
    const wrongOwner = await submitPaymentReference(
      paid.booking.id,
      unitOwner(UNIT_B),
      '1234567890123',
    );
    check(
      'someone else cannot attach a payment reference',
      !wrongOwner.ok,
      wrongOwner.ok ? 'was allowed' : '',
    );

    const reference = await submitPaymentReference(
      paid.booking.id,
      unitOwner(UNIT_A),
      '1234567890123',
    );
    check('the payer can submit a GCash reference', reference.ok);
  }

  const queue = await getPendingBookings(today);
  const ourPending = queue.filter((booking) =>
    booking.phone.startsWith('0999'),
  );
  check(
    'every request shows up in the approval queue',
    ourPending.length === 4,
    `found ${ourPending.length}`,
  );

  if (paid.ok) {
    const approved = await approveBooking(paid.booking.id, true);
    check('the association can approve and record payment', approved.ok);

    const twice = await approveBooking(paid.booking.id, true);
    check(
      'approving twice is refused',
      !twice.ok,
      twice.ok ? 'was allowed' : '',
    );
  }

  if (night.ok) {
    const declined = await rejectBooking(night.booking.id, 'Court reserved');
    check('the association can decline a request', declined.ok);

    const afterReject = await getDayAvailability(target);
    const nightSlot = afterReject.groups
      .flatMap((group) => group.slots)
      .find((slot) => slot.slotIndex === NIGHT_SLOT);
    check(
      'declining releases the slot',
      nightSlot?.courts.find((c) => c.courtNo === court)?.status === 'open',
      nightSlot?.courts.find((c) => c.courtNo === court)?.status,
    );

    const rebook = await createBooking({
      ...RESIDENT_B,
      date: target,
      slotIndex: NIGHT_SLOT,
      courtNo: court,
      name: 'Smoke Test B',
      phone: PHONE_B,
    });
    check(
      'the released slot can be requested again',
      rebook.ok,
      !rebook.ok ? rebook.message : '',
    );
  }

  console.log('\nCancellation\n');

  const wrongUnit = await cancelBookingAsOwner(
    first.booking.id,
    unitOwner(UNIT_B),
  );
  check(
    'another unit cannot cancel it',
    !wrongUnit.ok,
    wrongUnit.ok ? 'was allowed' : '',
  );

  const cancelled = await cancelBookingAsOwner(
    first.booking.id,
    unitOwner(UNIT_A),
  );
  check('the booker can cancel their own request', cancelled.ok);

  if (guestPaid.ok) {
    const guestCancel = await cancelBookingAsOwner(
      guestPaid.booking.id,
      phoneOwner(GUEST_PHONE),
    );
    check('a guest can cancel with their own number', guestCancel.ok);
  }

  await cleanup();

  const final = await getDayAvailability(target);
  check(
    'cleanup restored the original availability',
    final.openCount === openBefore,
    `${final.openCount} vs ${openBefore}`,
  );

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
