import Link from 'next/link';
import { notFound } from 'next/navigation';

import { bookerLabel } from '@/components/booker-label';
import { PaymentBadge, StatusBadge } from '@/components/booking-status';
import { PaymentInstructions } from '@/components/payment-instructions';
import { PaymentProofUpload } from '@/components/payment-proof-upload';
import { Card, Notice, PrimaryLink } from '@/components/ui';
import { isValidBookingCode, normalizeBookingCode } from '@/lib/booking-code';
import { encodeOwner, phoneOwner, type Owner } from '@/lib/owner';
import { findOption } from '@/lib/courts';
import { PAYMENT_HOLD_MINUTES, isPaymentConfigured } from '@/lib/payment';
import { isBlobConfigured } from '@/lib/payment-proof';
import { getBookingGroup, type BookingWithUnit } from '@/lib/queries/bookings';
import { getSettings } from '@/lib/queries/settings';
import { formatPeso, getSlot } from '@/lib/schedule';
import { mergeSlotSpans } from '@/lib/slot-spans';
import { formatClock, formatLongDate, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

/** Manila wall-clock time of an instant, e.g. '3:45 PM'. */
function formatClockTime(at: Date): string {
  return formatClock(manilaNow(at).minutes);
}

/** The identity that proves this booking is yours, same as a lookup returns. */
function ownerFor(booking: BookingWithUnit): Owner {
  if (booking.bookerType === 'resident' && booking.unitKey) {
    return { kind: 'unit', key: booking.unitKey };
  }
  return phoneOwner(booking.phone);
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isValidBookingCode(code)) notFound();

  const group = await getBookingGroup(normalizeBookingCode(code));
  if (group.length === 0) notFound();

  const first = group[0];
  const { payment } = await getSettings();

  const total = group.reduce((sum, entry) => sum + entry.amount, 0);
  const unpaid = group.filter(
    (entry) => entry.amount > 0 && entry.paymentStatus !== 'paid',
  );
  const owes = unpaid.length > 0;
  const awaitingCheck = unpaid.every(
    (entry) => entry.paymentStatus === 'submitted',
  );
  const owner = encodeOwner(ownerFor(first));

  const spans = mergeSlotSpans(
    group.map((entry) => ({
      slotIndex: entry.slotIndex,
      optionKey: entry.courtOption,
      price: entry.amount,
    })),
  );

  // The court is only held for a short while after a paid request. An expired
  // hold has already been cancelled by the sweep, so a pending one is live.
  const holdUntil =
    owes && first.status === 'pending' && first.paymentStatus === 'unpaid'
      ? new Date(first.createdAt.getTime() + PAYMENT_HOLD_MINUTES * 60_000)
      : null;

  return (
    <div className="space-y-5">
      <section className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {headline(first, owes, owes && awaitingCheck)}
        </h1>
        <p className="mt-2">
          <StatusBadge status={first.status} />
        </p>
        <p className="mt-2 text-sm text-muted">
          {subtitle(first, owes, owes && awaitingCheck)}
        </p>
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-5">
        <p className="text-lg font-semibold">
          {formatLongDate(first.bookingDate)}
        </p>

        <ul className="mt-3 space-y-2 border-t border-edge pt-3 text-sm">
          {spans.map((span) => (
            <li
              key={`${span.fromSlot}:${span.optionKey}`}
              className="flex items-baseline justify-between gap-3"
            >
              <span>
                {formatClock(getSlot(span.fromSlot).startMinutes)} –{' '}
                {formatClock(getSlot(span.toSlot).endMinutes)} ·{' '}
                {findOption(span.optionKey)?.short}
              </span>
              <span className="shrink-0 font-medium">
                {span.total > 0 ? formatPeso(span.total) : 'Free'}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-3 space-y-2 border-t border-edge pt-3 text-sm">
          <Row label="Name" value={first.bookerName} />
          <Row
            label={first.bookerType === 'resident' ? 'Unit' : 'Booked as'}
            value={bookerLabel(first) ?? 'Guest'}
          />
          <Row label="Mobile" value={first.phone} />
          <Row label="Reference" value={first.code} mono />
          {total > 0 ? (
            <Row label="Total" value={formatPeso(total)} strong />
          ) : null}
        </dl>

        {total > 0 ? (
          <p className="mt-3 border-t border-edge pt-3">
            <PaymentBadge
              paymentStatus={first.paymentStatus}
              amount={total}
            />
          </p>
        ) : null}

        {first.decisionNote ? (
          <p className="mt-3 border-t border-edge pt-3 text-sm text-muted">
            Association note: {first.decisionNote}
          </p>
        ) : null}
      </section>

      {holdUntil ? (
        <Notice tone="error">
          Your court is held until{' '}
          <strong>{formatClockTime(holdUntil)}</strong> — about{' '}
          {PAYMENT_HOLD_MINUTES} minutes. Send the payment and upload the
          receipt before then, or the slot goes back to everyone else.
        </Notice>
      ) : null}

      {owes ? (
        isPaymentConfigured(payment) ? (
          <>
            <PaymentInstructions
              payment={payment}
              amount={total}
              code={first.code}
            />

            <Card>
              {isBlobConfigured() ? (
                <PaymentProofUpload
                  bookingIds={group.map((entry) => entry.id)}
                  owner={owner}
                  alreadySent={Boolean(first.paymentProofUrl)}
                />
              ) : (
                <p className="text-sm text-muted">
                  Send the fee and keep your GCash receipt. The association will
                  confirm the booking once the payment shows up.
                </p>
              )}
            </Card>
          </>
        ) : (
          <Notice>
            The association will contact you about paying {formatPeso(total)}.
          </Notice>
        )
      ) : null}

      {total > 0 && !owes ? (
        <Notice tone="success">Payment received. Nothing more to do.</Notice>
      ) : null}

      <div className="space-y-2">
        <PrimaryLink href="/my">Go to my bookings</PrimaryLink>
        <Link
          href="/book"
          className="block text-center text-sm font-medium text-court underline"
        >
          Book another slot
        </Link>
      </div>
    </div>
  );
}

function headline(
  booking: BookingWithUnit,
  owes: boolean,
  awaitingCheck: boolean,
): string {
  if (booking.status === 'confirmed') return 'Your booking is confirmed';
  if (booking.status === 'rejected') return 'Request declined';
  if (booking.status === 'cancelled') return 'Booking cancelled';
  if (awaitingCheck) return 'Checking your payment';
  if (owes) return 'Almost there — pay to confirm';
  return 'Request received';
}

function subtitle(
  booking: BookingWithUnit,
  owes: boolean,
  awaitingCheck: boolean,
): string {
  if (booking.status === 'confirmed') {
    return 'Please arrive 10–15 minutes early.';
  }
  if (booking.status === 'rejected') return 'The slot has been released.';
  if (booking.status === 'cancelled') return 'This slot has been released.';
  if (awaitingCheck) {
    return 'We have your receipt. The association will confirm the booking shortly.';
  }
  if (owes) {
    return 'Your slots are held while you pay. Send the fee, then upload the GCash receipt below.';
  }
  return 'The association will review it shortly.';
}

function Row({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`text-right ${mono ? 'font-mono tracking-widest' : ''} ${
          strong ? 'text-base font-bold' : 'font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
