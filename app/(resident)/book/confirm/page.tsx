import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BookingForm } from '@/components/booking-form';
import { Notice } from '@/components/ui';
import { type CourtOption, activityLabel, findOption } from '@/lib/courts';
import { getDayAvailability } from '@/lib/queries/availability';
import { getSettings } from '@/lib/queries/settings';
import { findSlotAvailability, type DayAvailability } from '@/lib/rules';
import { formatPeso, getSlot, isValidSlotIndex } from '@/lib/schedule';
import { mergeSlotSpans } from '@/lib/slot-spans';
import { formatClock, formatLongDate, isValidDateStr } from '@/lib/time';

export const dynamic = 'force-dynamic';

/** '12:00 PM – 2:00 PM' across a merged run of hours. */
function spanLabel(span: { fromSlot: number; toSlot: number }): string {
  return `${formatClock(getSlot(span.fromSlot).startMinutes)} – ${formatClock(
    getSlot(span.toSlot).endMinutes,
  )}`;
}

type Pick = { slotIndex: number; option: CourtOption };

/** 'picks' is a comma-separated list of slotIndex:optionKey. */
function parsePicks(raw: string | undefined): Pick[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const picks: Pick[] = [];

  for (const entry of raw.split(',')) {
    if (seen.has(entry)) continue;
    seen.add(entry);

    const [rawSlot, optionKey] = entry.split(':');
    const slotIndex = Number(rawSlot);
    const option = findOption(optionKey ?? '');
    if (!isValidSlotIndex(slotIndex) || !option) return [];
    picks.push({ slotIndex, option });
  }

  return picks.sort((a, b) => a.slotIndex - b.slotIndex);
}

function statusOf(day: DayAvailability, pick: Pick) {
  const slot = findSlotAvailability(day, pick.slotIndex);
  return slot?.options.find((entry) => entry.option.key === pick.option.key);
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; picks?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? '';
  const picks = parsePicks(params.picks);

  if (!isValidDateStr(date) || picks.length === 0) notFound();

  const activity = picks[0].option.activity;
  const now = new Date();
  const [day, { limits, schedule }] = await Promise.all([
    getDayAvailability(date, undefined, now),
    getSettings(),
  ]);

  const entries = picks.map((pick) => ({
    pick,
    availability: statusOf(day, pick),
  }));

  const unavailable = entries.filter(
    (entry) => entry.availability?.status !== 'open',
  );
  const spans = mergeSlotSpans(
    entries.map(({ pick, availability }) => ({
      slotIndex: pick.slotIndex,
      optionKey: pick.option.key,
      price: availability?.price ?? 0,
    })),
  );
  const total = entries.reduce(
    (sum, entry) => sum + (entry.availability?.price ?? 0),
    0,
  );
  const backHref = `/book?date=${date}&sport=${activity}`;

  return (
    <div className="space-y-5">
      <section>
        <Link href={backHref} className="text-sm text-muted">
          ← Back to slots
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Request {picks.length === 1 ? 'a booking' : `${picks.length} hours`}
        </h1>
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-4">
        <p className="text-base font-semibold">{formatLongDate(date)}</p>

        <ul className="mt-3 space-y-2 border-t border-edge pt-3 text-sm">
          {spans.map((span) => (
            <li
              key={`${span.fromSlot}:${span.optionKey}`}
              className="flex items-baseline justify-between gap-3"
            >
              <span>
                {spanLabel(span)} · {findOption(span.optionKey)?.short}
              </span>
              <span className="shrink-0 font-medium">
                {span.total > 0 ? formatPeso(span.total) : 'Free'}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
          <span className="text-sm text-muted">
            {activityLabel(activity)} · {picks.length} hour
            {picks.length === 1 ? '' : 's'}
          </span>
          <span className="text-lg font-bold">
            {total > 0 ? formatPeso(total) : 'Free'}
          </span>
        </div>
      </section>

      {unavailable.length > 0 ? (
        <Notice tone="error">
          {unavailable[0].availability?.reason ??
            'One of these courts is no longer available.'}{' '}
          <Link href={backHref} className="underline">
            Pick again
          </Link>
          .
        </Notice>
      ) : (
        <>
          <Notice>
            Every booking is a <strong>request</strong>. The association reviews
            it and you will see it confirmed here once approved.
          </Notice>

          <BookingForm
            date={date}
            picks={picks.map((pick) => ({
              slotIndex: pick.slotIndex,
              optionKey: pick.option.key,
            }))}
            total={total}
            freeUntilHour={schedule.freeUntilHour}
          />

          <p className="text-center text-xs text-muted">
            {limits.enabled
              ? `Free morning slots are limited to ${limits.maxPerDay} per day and ${limits.maxPerWeek} per week — per household for residents. Paid hours are not limited.`
              : 'Please be considerate so everyone gets a turn.'}
          </p>
        </>
      )}
    </div>
  );
}
