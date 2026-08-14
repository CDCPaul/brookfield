'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';

import {
  cancelBookingAction,
  lookupBookingsAction,
  type LookupState,
} from '@/app/actions';
import { PaymentBadge, StatusBadge } from '@/components/booking-status';
import { PaymentInstructions } from '@/components/payment-instructions';
import { PaymentProofUpload } from '@/components/payment-proof-upload';
import {
  Field,
  Notice,
  PrimaryButton,
  SecondaryButton,
  SportBadge,
  inputClass,
} from '@/components/ui';
import { isPaymentConfigured, type PaymentConfig } from '@/lib/payment';
import type { BookingWithUnit } from '@/lib/queries/bookings';
import { getSlot } from '@/lib/schedule';
import { ADDRESS_FIELDS, loadBooker, mergeBooker } from '@/lib/stored-booker';
import { formatLongDate } from '@/lib/time';

type Mode = 'phone' | 'address';

export function MyBookings({
  payment,
  uploadEnabled,
}: {
  payment: PaymentConfig;
  uploadEnabled: boolean;
}) {
  const [state, formAction] = useActionState<LookupState, FormData>(
    lookupBookingsAction,
    {},
  );
  const [mode, setMode] = useState<Mode>('phone');
  const [cancelledIds, setCancelledIds] = useState<number[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();

  // Look up automatically when this phone has booked before.
  useEffect(() => {
    const stored = loadBooker();
    if (!stored) return;

    const form = formRef.current;
    if (form) {
      const phoneInput = form.elements.namedItem('phone');
      if (phoneInput instanceof HTMLInputElement && phoneInput.value === '') {
        phoneInput.value = stored.phone;
      }
    }

    const formData = new FormData();
    if (stored.phone !== '') {
      formData.set('phone', stored.phone);
    } else {
      for (const field of ADDRESS_FIELDS) formData.set(field, stored[field]);
    }
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
            mergeBooker(
              mode === 'phone'
                ? { phone: String(data.get('phone') ?? '') }
                : {
                    phase: String(data.get('phase') ?? ''),
                    block: String(data.get('block') ?? ''),
                    lot: String(data.get('lot') ?? ''),
                  },
            );
          }}
          className="space-y-4"
        >
          {mode === 'phone' ? (
            <>
              <p className="text-sm text-muted">
                Enter the mobile number you booked with.
              </p>
              <Field label="Mobile number">
                <input
                  name="phone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0917 123 4567"
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Enter your unit to see every booking made by your household.
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
            </>
          )}

          {state.error ? <Notice tone="error">{state.error}</Notice> : null}

          <PrimaryButton type="submit">Find my bookings</PrimaryButton>

          <button
            type="button"
            onClick={() => setMode(mode === 'phone' ? 'address' : 'phone')}
            className="block w-full text-center text-sm font-medium text-court underline"
          >
            {mode === 'phone'
              ? 'Search by address instead'
              : 'Search by mobile number instead'}
          </button>
        </form>
      )}

      {state.searched && !hasBookings ? (
        <Notice>
          No upcoming bookings found.{' '}
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
              owner={state.owner ?? ''}
              payment={payment}
              uploadEnabled={uploadEnabled}
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
  owner,
  payment,
  uploadEnabled,
  onCancelled,
}: {
  booking: BookingWithUnit;
  owner: string;
  payment: PaymentConfig;
  uploadEnabled: boolean;
  onCancelled: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slot = getSlot(booking.slotIndex);
  const owes = booking.amount > 0 && booking.paymentStatus !== 'paid';

  function cancel() {
    const formData = new FormData();
    formData.set('bookingId', String(booking.id));
    formData.set('owner', owner);

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
          <p className="text-xs text-muted">{booking.bookerName}</p>
        </div>
        <SportBadge sport={booking.sport as 'tennis' | 'pickleball'} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <StatusBadge status={booking.status} />
        <PaymentBadge
          paymentStatus={booking.paymentStatus}
          amount={booking.amount}
        />
      </div>

      {owes && isPaymentConfigured(payment) ? (
        <div className="mt-3 space-y-3">
          <PaymentInstructions
            payment={payment}
            amount={booking.amount}
            code={booking.code}
          />
          {uploadEnabled ? (
            <PaymentProofUpload
              bookingIds={[booking.id]}
              owner={owner}
              existingUrl={booking.paymentProofUrl}
            />
          ) : null}
        </div>
      ) : null}

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

