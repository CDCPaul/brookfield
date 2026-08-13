'use client';

import Link from 'next/link';
import { useActionState, useEffect, useTransition } from 'react';

import { lookupBookingsAction, type LookupState } from '@/app/actions';
import { getSlot } from '@/lib/schedule';
import { loadUnit } from '@/lib/stored-unit';
import { formatLongDate } from '@/lib/time';

/**
 * Shows the household's next reservation on the home screen.
 *
 * Renders nothing until this phone has booked at least once, so a first-time
 * visitor never sees an empty placeholder.
 */
export function NextBooking() {
  const [state, formAction] = useActionState<LookupState, FormData>(
    lookupBookingsAction,
    {},
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    const stored = loadUnit();
    if (!stored) return;

    const formData = new FormData();
    formData.set('phase', stored.phase);
    formData.set('block', stored.block);
    formData.set('lot', stored.lot);
    startTransition(() => formAction(formData));
  }, [formAction]);

  // Bookings arrive sorted by date then slot, so the first is the next one.
  const next = state.bookings?.[0];
  if (!next) return null;

  const slot = getSlot(next.slotIndex);

  return (
    <Link
      href="/my"
      className="flex items-center gap-3 rounded-2xl border border-court bg-court-soft p-4 dark:bg-court/15"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-court text-lg"
      >
        {next.sport === 'tennis' ? '🎾' : '🏓'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wider text-court-dark dark:text-court-soft">
          Your next booking
        </span>
        <span className="block truncate text-sm font-semibold">
          {formatLongDate(next.bookingDate)} · {slot.label}
        </span>
        <span className="block text-xs text-muted">
          {next.sport === 'tennis' ? 'Tennis court' : `Court ${next.courtNo}`}
          {state.bookings && state.bookings.length > 1
            ? ` · +${state.bookings.length - 1} more`
            : ''}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-muted">
        ›
      </span>
    </Link>
  );
}
