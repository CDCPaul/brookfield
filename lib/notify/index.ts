/**
 * Telling people what happened to a booking.
 *
 * Two channels, deliberately overlapping. Push is free, instant and richer,
 * but only reaches a browser that opted in — and on iOS, only one that has
 * been added to the home screen. Text messages reach every Philippine mobile
 * for about half a peso and need nothing installed.
 *
 * So both go out. Suppressing the text for anyone holding a push subscription
 * would save a few pesos and cost the one guarantee the system has: a
 * subscription can die without telling us, and the association would never
 * know a booker was not told their court fell through.
 *
 * Every function here swallows its own failures. A notification that does not
 * send is worth a log line, never a failed booking or a request the
 * association cannot approve.
 */

import type { Booking } from '@/lib/db';
import {
  getAdminSubscriptions,
  getBookerSubscriptions,
} from '@/lib/queries/push';
import { getSettings } from '@/lib/queries/settings';

import {
  confirmedPush,
  confirmedSms,
  declinedPush,
  declinedSms,
  newRequestPush,
  newRequestSms,
  type RequestSummary,
} from './messages';
import { sendPushQuietly } from './push';
import { sendSmsQuietly } from './sms';

function summarise(group: readonly Booking[]): RequestSummary {
  const first = group[0];
  return {
    date: first.bookingDate,
    name: first.bookerName,
    amount: group.reduce((total, entry) => total + entry.amount, 0),
    code: first.groupCode ?? first.code,
    lines: group.map((entry) => ({
      slotIndex: entry.slotIndex,
      optionKey: entry.courtOption,
      price: entry.amount,
    })),
  };
}

/** Free bookings are quiet by default — there is nothing to pay or verify. */
function shouldNotify(summary: RequestSummary, notifyFree: boolean): boolean {
  return summary.amount > 0 || notifyFree;
}

/** The association needs to know a court is waiting on them. */
export async function notifyNewRequest(
  group: readonly Booking[],
): Promise<void> {
  if (group.length === 0) return;

  try {
    const { notify } = await getSettings();
    if (!notify.textAdminOnRequest) return;

    const summary = summarise(group);
    if (!shouldNotify(summary, notify.textFreeBookings)) return;

    await Promise.all([
      notify.adminPhones.length > 0
        ? sendSmsQuietly(notify.adminPhones, newRequestSms(summary))
        : undefined,
      notify.pushEnabled
        ? getAdminSubscriptions().then((targets) =>
            sendPushQuietly(targets, newRequestPush(summary)),
          )
        : undefined,
    ]);
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
    if (!shouldNotify(summary, notify.textFreeBookings)) return;

    const phone = group[0].phone;
    const confirmed = decision === 'confirmed';

    await Promise.all([
      sendSmsQuietly(
        [phone],
        confirmed ? confirmedSms(summary) : declinedSms(summary, note),
      ),
      notify.pushEnabled
        ? getBookerSubscriptions(phone).then((targets) =>
            sendPushQuietly(
              targets,
              confirmed ? confirmedPush(summary) : declinedPush(summary, note),
            ),
          )
        : undefined,
    ]);
  } catch (error) {
    console.error('Could not notify the booker', error);
  }
}
