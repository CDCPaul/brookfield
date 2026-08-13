import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BookingForm } from '@/components/booking-form';
import { Notice } from '@/components/ui';
import { activityLabel, findOption } from '@/lib/courts';
import { getDayAvailability } from '@/lib/queries/availability';
import { getSettings } from '@/lib/queries/settings';
import { findSlotAvailability } from '@/lib/rules';
import { formatPeso, getSlot, isValidSlotIndex, tierLabel } from '@/lib/schedule';
import { formatLongDate, isValidDateStr } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; slot?: string; option?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? '';
  const slotIndex = Number(params.slot);
  const option = findOption(params.option ?? '');

  if (!isValidDateStr(date) || !isValidSlotIndex(slotIndex) || !option) {
    notFound();
  }

  const slot = getSlot(slotIndex);
  const now = new Date();
  const [day, { limits, schedule }] = await Promise.all([
    getDayAvailability(date, option.activity, now),
    getSettings(),
  ]);

  const availability = findSlotAvailability(day, slotIndex);
  const entry = availability?.options.find(
    (candidate) => candidate.option.key === option.key,
  );
  const stillOpen = entry?.status === 'open';
  const price = entry?.price ?? 0;
  const tier = availability?.tier ?? 'free';
  const backHref = `/book?date=${date}&sport=${option.activity}`;

  return (
    <div className="space-y-5">
      <section>
        <Link href={backHref} className="text-sm text-muted">
          ← Back to slots
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Request a booking
        </h1>
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-4">
        <p className="text-base font-semibold">{formatLongDate(date)}</p>
        <p className="text-sm text-muted">{slot.label}</p>
        <p className="mt-1 text-sm font-medium">{option.label}</p>

        <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
          <span className="text-sm text-muted">
            {activityLabel(option.activity)} · {tierLabel(tier)}
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
            optionKey={option.key}
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
          {entry?.reason ?? 'This court is no longer available.'}{' '}
          <Link href={backHref} className="underline">
            Pick another slot
          </Link>
          .
        </Notice>
      )}
    </div>
  );
}
