'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';

import {
  cancelBookingAction,
  lookupBookingsAction,
  type LookupState,
} from '@/app/actions';
import {
  Field,
  Notice,
  PrimaryButton,
  SecondaryButton,
  SportBadge,
  inputClass,
} from '@/components/ui';
import type { BookingWithUnit } from '@/lib/queries/bookings';
import { getSlot } from '@/lib/schedule';
import { formatLongDate } from '@/lib/time';
import { loadUnit, mergeUnit } from '@/lib/stored-unit';

const UNIT_FIELDS = ['phase', 'block', 'lot'] as const;

export function MyBookings() {
  const [state, formAction] = useActionState<LookupState, FormData>(
    lookupBookingsAction,
    {},
  );
  const [cancelledIds, setCancelledIds] = useState<number[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();

  // Look up automatically when this phone has booked before.
  useEffect(() => {
    const stored = loadUnit();
    const form = formRef.current;
    if (!stored) return;

    if (form) {
      for (const field of UNIT_FIELDS) {
        const input = form.elements.namedItem(field);
        if (input instanceof HTMLInputElement && input.value === '') {
          input.value = stored[field];
        }
      }
    }

    const formData = new FormData();
    for (const field of UNIT_FIELDS) formData.set(field, stored[field]);
    startTransition(() => formAction(formData));
  }, [formAction]);

  const bookings = (state.bookings ?? []).filter(
    (booking) => !cancelledIds.includes(booking.id),
  );
  const hasBookings = bookings.length > 0;

  return (
    <div className="space-y-5">
      {hasBookings ? null : (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            mergeUnit({
              phase: String(data.get('phase') ?? ''),
              block: String(data.get('block') ?? ''),
              lot: String(data.get('lot') ?? ''),
            });
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted">
            Enter your unit to see your upcoming bookings.
          </p>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Phase">
              <input
                name="phase"
                required
                autoCapitalize="characters"
                className={inputClass}
              />
            </Field>
            <Field label="Block">
              <input
                name="block"
                required
                autoCapitalize="characters"
                className={inputClass}
              />
            </Field>
            <Field label="Lot">
              <input
                name="lot"
                required
                autoCapitalize="characters"
                className={inputClass}
              />
            </Field>
          </div>

          {state.error ? <Notice tone="error">{state.error}</Notice> : null}

          <PrimaryButton type="submit">Find my bookings</PrimaryButton>
        </form>
      )}

      {state.searched && !hasBookings ? (
        <Notice>
          No upcoming bookings for this unit.{' '}
          <Link href="/book" className="underline">
            Book a slot
          </Link>
          .
        </Notice>
      ) : null}

      {hasBookings ? (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              unitKey={state.unitKey ?? ''}
              onCancelled={() =>
                setCancelledIds((current) => [...current, booking.id])
              }
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function BookingCard({
  booking,
  unitKey,
  onCancelled,
}: {
  booking: BookingWithUnit;
  unitKey: string;
  onCancelled: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slot = getSlot(booking.slotIndex);

  function cancel() {
    const formData = new FormData();
    formData.set('bookingId', String(booking.id));
    formData.set('unitKey', unitKey);

    startTransition(async () => {
      const result = await cancelBookingAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onCancelled();
    });
  }

  return (
    <li className="rounded-2xl border border-edge bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">
            {formatLongDate(booking.bookingDate)}
          </p>
          <p className="text-sm text-muted">{slot.label}</p>
          <p className="mt-1 text-sm">
            {booking.sport === 'tennis'
              ? 'Tennis court'
              : `Court ${booking.courtNo}`}{' '}
            · <span className="font-mono tracking-widest">{booking.code}</span>
          </p>
        </div>
        <SportBadge sport={booking.sport as 'tennis' | 'pickleball'} />
      </div>

      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-3">
        {confirming ? (
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setConfirming(false)}>
              Keep it
            </SecondaryButton>
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3.5 text-base font-semibold text-white active:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </div>
        ) : (
          <SecondaryButton type="button" onClick={() => setConfirming(true)}>
            Cancel booking
          </SecondaryButton>
        )}
      </div>
    </li>
  );
}
