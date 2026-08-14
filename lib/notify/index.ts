/**
 * Telling people what happened to a booking.
 *
 * Every function here swallows its own failures. A text that does not send is
 * worth a log line, never a failed booking or a request the association cannot
 * approve.
 */

import type { Booking } from '@/lib/db';
import { getSettings } from '@/lib/queries/settings';

import {
  confirmedSms,
  declinedSms,
  newRequestSms,
  type RequestSummary,
} from './messages';
import { sendSmsQuietly } from './sms';

function summarise(group: readonly Booking[]): RequestSummary {
  const first = group[0];
  return {
    date: first.bookingDate,
    name: first.bookerName,
    amount: group.reduce((total, entry) => total + entry.amount, 0),
    lines: group.map((entry) => ({
      slotIndex: entry.slotIndex,
      optionKey: entry.courtOption,
      price: entry.amount,
    })),
  };
}

/** Free bookings are quiet by default — there is nothing to pay or verify. */
function shouldText(summary: RequestSummary, textFree: boolean): boolean {
  return summary.amount > 0 || textFree;
}

/** The association needs to know a court is waiting on them. */
export async function notifyNewRequest(
  group: readonly Booking[],
): Promise<void> {
  if (group.length === 0) return;

  try {
    const { notify } = await getSettings();
    if (!notify.textAdminOnRequest) return;
    if (notify.adminPhones.length === 0) return;

    const summary = summarise(group);
    if (!shouldText(summary, notify.textFreeBookings)) return;

    await sendSmsQuietly(notify.adminPhones, newRequestSms(summary));
  } catch (error) {
    console.error('Could not notify the association', error);
  }
}

/** The booker needs to know whether they have the court. */
export async function notifyDecision(
  group: readonly Booking[],
  decision: 'confirmed' | 'rejected',
  note = '',
): Promise<void> {
  if (group.length === 0) return;

  try {
    const { notify } = await getSettings();
    if (!notify.textBookerOnDecision) return;

    const summary = summarise(group);
    if (!shouldText(summary, notify.textFreeBookings)) return;

    const message =
      decision === 'confirmed'
        ? confirmedSms(summary)
        : declinedSms(summary, note);

    await sendSmsQuietly([group[0].phone], message);
  } catch (error) {
    console.error('Could not notify the booker', error);
  }
}
