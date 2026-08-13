/**
 * End-to-end check of the booking pipeline against the real database.
 *
 *   npm run smoke
 *
 * Creates bookings, asserts every rule fires, then deletes everything it made.
 */

import { eq, inArray } from 'drizzle-orm';

import { bookings, db, units } from '../lib/db';
import { getDayAvailability } from '../lib/queries/availability';
import {
  cancelBookingAsResident,
  createBooking,
} from '../lib/queries/bookings';
import { addDays, manilaNow } from '../lib/time';
import { buildUnitKey } from '../lib/unit-key';

const UNIT_A = { phase: 'ZZTEST', block: '1', lot: '1' };
const UNIT_B = { phase: 'ZZTEST', block: '2', lot: '2' };

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
}

async function main() {
  await cleanup();

  const today = manilaNow().date;
  // Pick a day far enough out that no slot has started yet.
  const target = addDays(today, 2);

  console.log(`\nBooking pipeline — target date ${target}\n`);

  const before = await getDayAvailability(target);
  const openBefore = before.openCount;
  const court = before.slots[0].courts[0].courtNo;

  const first = await createBooking({
    ...UNIT_A,
    date: target,
    slotIndex: 0,
    courtNo: court,
    name: 'Smoke Test A',
    phone: '09171234567',
  });
  check('creates a valid booking', first.ok, !first.ok ? first.message : '');
  if (!first.ok) {
    await cleanup();
    process.exit(1);
  }

  const afterOne = await getDayAvailability(target);
  check(
    'availability drops by one',
    afterOne.openCount === openBefore - 1,
    `${openBefore} -> ${afterOne.openCount}`,
  );

  const sameSlot = await createBooking({
    ...UNIT_B,
    date: target,
    slotIndex: 0,
    courtNo: court,
    name: 'Smoke Test B',
    phone: '09171234568',
  });
  check(
    'rejects a second booking on the same court and slot',
    !sameSlot.ok && sameSlot.code === 'taken',
    sameSlot.ok ? 'was accepted' : sameSlot.code,
  );

  const sameDay = await createBooking({
    ...UNIT_A,
    date: target,
    slotIndex: 2,
    courtNo: court,
    name: 'Smoke Test A',
    phone: '09171234567',
  });
  check(
    'rejects a second booking by the same unit on the same day',
    !sameDay.ok && sameDay.code === 'day_limit',
    sameDay.ok ? 'was accepted' : sameDay.code,
  );

  const tooFar = await createBooking({
    ...UNIT_B,
    date: addDays(today, 30),
    slotIndex: 0,
    courtNo: 1,
    name: 'Smoke Test B',
    phone: '09171234568',
  });
  check(
    'rejects a date beyond the booking window',
    !tooFar.ok && tooFar.code === 'too_far',
    tooFar.ok ? 'was accepted' : tooFar.code,
  );

  const badPhone = await createBooking({
    ...UNIT_B,
    date: target,
    slotIndex: 1,
    courtNo: court,
    name: 'Smoke Test B',
    phone: '123',
  });
  check(
    'rejects an invalid mobile number',
    !badPhone.ok && badPhone.code === 'invalid_input',
    badPhone.ok ? 'was accepted' : badPhone.code,
  );

  // The same address written differently must resolve to the same household.
  const messyUnitA = { phase: 'ph-zztest', block: 'Block 1', lot: '#1' };
  const messy = await createBooking({
    ...messyUnitA,
    date: target,
    slotIndex: 1,
    courtNo: court,
    name: 'Smoke Test A',
    phone: '09171234567',
  });
  check(
    'treats a differently-spelled address as the same unit',
    !messy.ok && messy.code === 'day_limit',
    messy.ok ? 'was accepted as a new unit' : messy.code,
  );

  const cancelled = await cancelBookingAsResident(
    first.booking.id,
    buildUnitKey(UNIT_A),
  );
  check('resident can cancel their own booking', cancelled.ok);

  const wrongUnit = await cancelBookingAsResident(
    first.booking.id,
    buildUnitKey(UNIT_B),
  );
  check(
    'another unit cannot cancel it',
    !wrongUnit.ok,
    wrongUnit.ok ? 'was allowed' : '',
  );

  const afterCancel = await getDayAvailability(target);
  check(
    'cancelling releases the slot',
    afterCancel.openCount === openBefore,
    `${afterCancel.openCount} vs ${openBefore}`,
  );

  const rebook = await createBooking({
    ...UNIT_A,
    date: target,
    slotIndex: 0,
    courtNo: court,
    name: 'Smoke Test A',
    phone: '09171234567',
  });
  check(
    'the freed slot can be booked again',
    rebook.ok,
    !rebook.ok ? rebook.message : '',
  );

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
