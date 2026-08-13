import Link from 'next/link';

import type { Activity } from '@/lib/courts';
import type {
  DayAvailability,
  OptionAvailability,
  SlotAvailability,
  TierGroup,
} from '@/lib/rules';
import { formatPeso } from '@/lib/schedule';

export function SlotList({
  day,
  activity,
}: {
  day: DayAvailability;
  activity: Activity;
}) {
  if (day.groups.length === 0) {
    return (
      <p className="rounded-xl border border-edge bg-surface px-4 py-6 text-center text-sm text-muted">
        {activity === 'basketball'
          ? 'The basketball court is not open for booking.'
          : 'Nothing to book here today.'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {day.groups.map((group) => (
        <TierSection key={group.tier} date={day.date} group={group} />
      ))}
    </div>
  );
}

function TierSection({ date, group }: { date: string; group: TierGroup }) {
  // A slot whose start time has gone is dead weight — on an eighteen-hour day
  // it can push everything bookable past the fold.
  const upcoming = group.slots.filter((slot) => !hasPassed(slot));
  const allPassed = group.slots.every(hasPassed);
  const price = group.slots[0]?.options[0]?.price ?? 0;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{group.label}</h2>
          <p className="text-xs text-muted">{group.rangeLabel}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            price === 0
              ? 'bg-court-soft text-court-dark dark:bg-court/20 dark:text-court-soft'
              : 'bg-orange-100 text-clay dark:bg-orange-950/50'
          }`}
        >
          {price === 0
            ? 'Free for residents'
            : `from ${formatPeso(price)} / hour`}
        </span>
      </div>

      {upcoming.length === 0 ? (
        <p className="rounded-xl border border-edge bg-background px-4 py-3 text-center text-sm text-muted">
          {allPassed ? 'These hours have passed.' : 'Nothing open in this block.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((slot) => (
            <SlotRow key={slot.slotIndex} date={date} slot={slot} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SlotRow({ date, slot }: { date: string; slot: SlotAvailability }) {
  if (slot.openCount === 0) {
    // Say what is in the way. Without it, a court blocked by a booking on the
    // *other* sport just looks broken.
    const reason = slot.options.find((option) => option.reason)?.reason;

    return (
      <li className="rounded-xl border border-edge bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">{slot.label}</span>
          <span className="text-xs font-medium text-muted">Unavailable</span>
        </div>
        {reason ? (
          <p className="mt-1 text-xs text-muted">{reason}</p>
        ) : null}
      </li>
    );
  }

  const single = slot.options.length === 1;
  const sole = slot.options[0];

  return (
    <li className="rounded-xl border border-edge bg-surface p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{slot.label}</h3>
        <span className="text-xs font-medium text-court">
          {slot.openCount} of {slot.options.length} open
        </span>
      </div>

      {single ? (
        <div className="mt-2.5">
          <OptionButton date={date} slot={slot} entry={sole} wide />
        </div>
      ) : (
        <ul
          className={`mt-2.5 grid gap-2 ${
            slot.options.length > 2 ? 'grid-cols-4' : 'grid-cols-2'
          }`}
        >
          {slot.options.map((entry) => (
            <li key={entry.option.key}>
              <OptionButton date={date} slot={slot} entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function OptionButton({
  date,
  slot,
  entry,
  wide = false,
}: {
  date: string;
  slot: SlotAvailability;
  entry: OptionAvailability;
  wide?: boolean;
}) {
  if (entry.status !== 'open') {
    return (
      <div
        title={entry.reason}
        className={`flex flex-col items-center rounded-xl border border-edge bg-background py-2.5 text-muted ${
          wide ? 'px-4' : ''
        }`}
      >
        <span className="text-xs font-medium line-through decoration-1">
          {entry.option.short}
        </span>
        {wide && entry.reason ? (
          <span className="mt-0.5 text-[11px]">{entry.reason}</span>
        ) : null}
      </div>
    );
  }

  const href = `/book/confirm?date=${date}&slot=${slot.slotIndex}&option=${entry.option.key}`;

  if (wide) {
    return (
      <Link
        href={href}
        className="inline-flex w-full items-center justify-center rounded-xl bg-court px-4 py-3 text-sm font-semibold text-white active:bg-court-dark"
      >
        {entry.price > 0
          ? `${entry.option.short} — ${formatPeso(entry.price)}`
          : `Request ${entry.option.short.toLowerCase()}`}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`Request ${entry.option.label} at ${slot.label}`}
      className="flex flex-col items-center rounded-xl border border-court bg-court-soft py-2.5 text-court-dark active:bg-court active:text-white dark:bg-court/15 dark:text-court-soft"
    >
      <span className="text-xs font-semibold">{entry.option.short}</span>
      {entry.price > 0 ? (
        <span className="text-[11px]">{formatPeso(entry.price)}</span>
      ) : null}
    </Link>
  );
}

function hasPassed(slot: SlotAvailability): boolean {
  return slot.options.every((option) => option.status === 'past');
}
