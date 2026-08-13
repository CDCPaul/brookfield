import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BookingForm } from '@/components/booking-form';
import { Notice, SportBadge } from '@/components/ui';
import { getDayAvailability } from '@/lib/queries/availability';
import { getSettings } from '@/lib/queries/settings';
import { findSlotAvailability } from '@/lib/rules';
import {
  formatPeso,
  getSlot,
  isValidCourtNo,
  isValidSlotIndex,
  sportForDate,
  tierLabel,
} from '@/lib/schedule';
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

  if (!isValidDateStr(date) || !isValidSlotIndex(slotIndex)) notFound();

  const sport = sportForDate(date);
  if (!isValidCourtNo(sport, courtNo)) notFound();

  const slot = getSlot(slotIndex);
  const now = new Date();
  const [day, { limits, schedule }] = await Promise.all([
    getDayAvailability(date, now),
    getSettings(),
  ]);

  const availability = findSlotAvailability(day, slotIndex);
  const court = availability?.courts.find((c) => c.courtNo === courtNo);
  const stillOpen = court?.status === 'open';
  const price = availability?.price ?? 0;
  const tier = availability?.tier ?? 'free';

  return (
    <div className="space-y-5">
      <section>
        <Link href={`/book?date=${date}`} className="text-sm text-muted">
          ← Back to slots
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Request a booking
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

        <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
          <span className="text-sm text-muted">
            {tierLabel(tier)}
            {tier === 'free' ? ' · residents only' : ''}
          </span>
          <span className="text-lg font-bold">
            {price > 0 ? formatPeso(price) : 'Free'}
          </span>
        </div>
      </section>

      {stillOpen ? (
        <>
          <Notice>
            Every booking is a <strong>request</strong>. The association reviews
            it and you will see it confirmed here once approved.
          </Notice>

          <BookingForm
            date={date}
            slotIndex={slotIndex}
            courtNo={courtNo}
            price={price}
            freeUntilHour={schedule.freeUntilHour}
          />

          <p className="text-center text-xs text-muted">
            {limits.enabled
              ? `Free morning slots are limited to ${limits.maxPerDay} per day and ${limits.maxPerWeek} per week — per household for residents. Paid hours are not limited.`
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
