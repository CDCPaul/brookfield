import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BookingForm } from '@/components/booking-form';
import { Notice, SportBadge } from '@/components/ui';
import { getDayAvailability } from '@/lib/queries/availability';
import { getLimits } from '@/lib/queries/settings';
import { getSlot, isValidCourtNo, sportForDate } from '@/lib/schedule';
import { formatLongDate, isValidDateStr } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; slot?: string; court?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? '';
  const slotIndex = Number(params.slot);
  const courtNo = Number(params.court);

  if (!isValidDateStr(date)) notFound();

  const sport = sportForDate(date);
  if (!isValidCourtNo(sport, courtNo)) notFound();

  let slot;
  try {
    slot = getSlot(slotIndex);
  } catch {
    notFound();
  }

  const now = new Date();
  const [day, limits] = await Promise.all([
    getDayAvailability(date, now),
    getLimits(),
  ]);

  const court = day.slots[slotIndex]?.courts.find((c) => c.courtNo === courtNo);
  const stillOpen = court?.status === 'open';

  return (
    <div className="space-y-5">
      <section>
        <Link href={`/book?date=${date}`} className="text-sm text-muted">
          ← Back to slots
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Confirm booking
        </h1>
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">{formatLongDate(date)}</p>
            <p className="text-sm text-muted">{slot.label}</p>
            <p className="mt-1 text-sm font-medium">
              {sport === 'tennis' ? 'Tennis court' : `Pickleball court ${courtNo}`}
            </p>
          </div>
          <SportBadge sport={sport} />
        </div>
      </section>

      {stillOpen ? (
        <>
          <BookingForm date={date} slotIndex={slotIndex} courtNo={courtNo} />
          <p className="text-center text-xs text-muted">
            {limits.enabled
              ? `Limit of ${limits.maxPerDay} booking per day and ${limits.maxPerWeek} per week — per household for residents, per mobile number for guests.`
              : 'Please be considerate so everyone gets a turn.'}
          </p>
        </>
      ) : (
        <Notice tone="error">
          This slot is no longer available. Please{' '}
          <Link href={`/book?date=${date}`} className="underline">
            pick another one
          </Link>
          .
        </Notice>
      )}
    </div>
  );
}
