'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { Activity } from '@/lib/courts';
import type {
  DayAvailability,
  OptionAvailability,
  SlotAvailability,
  TierGroup,
} from '@/lib/rules';
import { formatPeso } from '@/lib/schedule';

type Pick = { slotIndex: number; optionKey: string };

const keyOf = (pick: Pick) => `${pick.slotIndex}:${pick.optionKey}`;

/**
 * Lets several hours be chosen before committing.
 *
 * People book two or three hours together far more often than one, and making
 * each hour its own trip through the form turned that into three payments to
 * reconcile. Picks accumulate here and go to the request screen as one.
 */
export function SlotPicker({
  day,
  activity,
}: {
  day: DayAvailability;
  activity: Activity;
}) {
  const [picks, setPicks] = useState<Pick[]>([]);

  const selected = useMemo(
    () => new Set(picks.map(keyOf)),
    [picks],
  );

  const total = useMemo(() => {
    let sum = 0;
    for (const group of day.groups) {
      for (const slot of group.slots) {
        for (const entry of slot.options) {
          if (selected.has(keyOf({ slotIndex: slot.slotIndex, optionKey: entry.option.key }))) {
            sum += entry.price;
          }
        }
      }
    }
    return sum;
  }, [day, selected]);

  function toggle(pick: Pick) {
    setPicks((current) =>
      current.some((entry) => keyOf(entry) === keyOf(pick))
        ? current.filter((entry) => keyOf(entry) !== keyOf(pick))
        : [...current, pick],
    );
  }

  if (day.groups.length === 0) {
    return (
      <p className="rounded-xl border border-edge bg-surface px-4 py-6 text-center text-sm text-muted">
        {activity === 'basketball'
          ? 'The basketball court is not open for booking.'
          : 'Nothing to book here today.'}
      </p>
    );
  }

  const href = `/book/confirm?date=${day.date}&picks=${picks
    .map(keyOf)
    .join(',')}`;

  return (
    <>
      <div className={`space-y-6 ${picks.length > 0 ? 'pb-24' : ''}`}>
        {day.groups.map((group) => (
          <TierSection
            key={group.tier}
            group={group}
            selected={selected}
            onToggle={toggle}
          />
        ))}
      </div>

      {picks.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[64px] z-30 border-t border-edge bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[480px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {picks.length} hour{picks.length === 1 ? '' : 's'} selected
              </p>
              <p className="text-xs text-muted">
                {total > 0 ? `Total ${formatPeso(total)}` : 'Free'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPicks([])}
              className="shrink-0 rounded-xl border border-edge px-3 py-2.5 text-sm font-medium active:bg-background"
            >
              Clear
            </button>
            <Link
              href={href}
              className="shrink-0 rounded-xl bg-court px-5 py-2.5 text-sm font-semibold text-white active:bg-court-dark"
            >
              Continue
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TierSection({
  group,
  selected,
  onToggle,
}: {
  group: TierGroup;
  selected: Set<string>;
  onToggle: (pick: Pick) => void;
}) {
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
            <SlotRow
              key={slot.slotIndex}
              slot={slot}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SlotRow({
  slot,
  selected,
  onToggle,
}: {
  slot: SlotAvailability;
  selected: Set<string>;
  onToggle: (pick: Pick) => void;
}) {
  const taken = slot.options.filter((entry) => entry.status === 'taken');

  if (slot.openCount === 0) {
    return (
      <li className="rounded-xl border border-edge bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">{slot.label}</span>
          <span className="text-xs font-medium text-muted">Unavailable</span>
        </div>
        {taken.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {taken.map((entry) => (
              <li key={entry.option.key} className="text-xs text-muted">
                {entry.option.short} — {entry.heldBy ?? 'booked'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted">
            {slot.options.find((entry) => entry.reason)?.reason}
          </p>
        )}
      </li>
    );
  }

  const single = slot.options.length === 1;

  return (
    <li className="rounded-xl border border-edge bg-surface p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{slot.label}</h3>
        <span className="text-xs font-medium text-court">
          {slot.openCount} of {slot.options.length} open
        </span>
      </div>

      <ul
        className={`mt-2.5 grid gap-2 ${
          single ? 'grid-cols-1' : slot.options.length > 2 ? 'grid-cols-4' : 'grid-cols-2'
        }`}
      >
        {slot.options.map((entry) => (
          <li key={entry.option.key}>
            <OptionButton
              slotIndex={slot.slotIndex}
              entry={entry}
              wide={single}
              isSelected={selected.has(
                keyOf({ slotIndex: slot.slotIndex, optionKey: entry.option.key }),
              )}
              onToggle={onToggle}
            />
          </li>
        ))}
      </ul>

      {taken.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-edge pt-2">
          {taken.map((entry) => (
            <li key={entry.option.key} className="text-xs text-muted">
              {entry.option.short} — {entry.heldBy ?? 'booked'}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function OptionButton({
  slotIndex,
  entry,
  wide,
  isSelected,
  onToggle,
}: {
  slotIndex: number;
  entry: OptionAvailability;
  wide: boolean;
  isSelected: boolean;
  onToggle: (pick: Pick) => void;
}) {
  if (entry.status !== 'open') {
    return (
      <div
        title={entry.reason}
        className="flex flex-col items-center rounded-xl border border-edge bg-background py-2.5 text-muted"
      >
        <span className="text-xs font-medium line-through decoration-1">
          {entry.option.short}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onToggle({ slotIndex, optionKey: entry.option.key })}
      className={`flex w-full flex-col items-center rounded-xl border py-2.5 transition-colors ${
        isSelected
          ? 'border-court bg-court text-white'
          : 'border-court bg-court-soft text-court-dark dark:bg-court/15 dark:text-court-soft'
      }`}
    >
      <span className="text-xs font-semibold">
        {isSelected ? '✓ ' : ''}
        {wide ? entry.option.label : entry.option.short}
      </span>
      {entry.price > 0 ? (
        <span className="text-[11px]">{formatPeso(entry.price)}</span>
      ) : null}
    </button>
  );
}

function hasPassed(slot: SlotAvailability): boolean {
  return slot.options.every((option) => option.status === 'past');
}
