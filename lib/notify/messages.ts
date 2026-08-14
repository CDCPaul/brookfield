/**
 * Text message wording.
 *
 * Semaphore bills one credit per 160 characters and then segments at 153, so a
 * message that drifts to 161 characters costs double for one wasted letter.
 * These are written tight on purpose and the tests hold them there.
 */

import { findOption } from '@/lib/courts';
import { getSlot } from '@/lib/schedule';
import { formatClock, formatShortDate, type DateStr } from '@/lib/time';
import { mergeSlotSpans, type SlotEntry } from '@/lib/slot-spans';

/** One credit's worth. Anything longer is billed as two. */
export const SMS_SINGLE_LIMIT = 160;

export type BookingLine = SlotEntry;

/** '12-2PM Court 2' — compact enough to fit several in one text. */
function describeSpans(entries: readonly BookingLine[]): string {
  return mergeSlotSpans(entries)
    .map((span) => {
      const from = getSlot(span.fromSlot);
      const to = getSlot(span.toSlot);
      const court = findOption(span.optionKey)?.short ?? span.optionKey;
      return `${shortClock(from.startMinutes)}-${shortClock(to.endMinutes)} ${court}`;
    })
    .join(', ');
}

/** '12PM' or '9:30AM' — drops ':00' and the space to save characters. */
function shortClock(minutes: number): string {
  return formatClock(minutes).replace(':00', '').replace(' ', '');
}

export type RequestSummary = {
  date: DateStr;
  name: string;
  amount: number;
  lines: BookingLine[];
};

/** Sent to the association when someone asks for a court. */
export function newRequestSms(summary: RequestSummary): string {
  const fee = summary.amount > 0 ? ` P${summary.amount}` : ' free';
  return trim(
    `BrookSide Bounce: NEW REQUEST${fee}\n` +
      `${summary.name}\n` +
      `${formatShortDate(summary.date)} ${describeSpans(summary.lines)}\n` +
      `Approve in the admin page.`,
  );
}

/** Sent to the booker once the association approves. */
export function confirmedSms(summary: RequestSummary): string {
  return trim(
    `BrookSide Bounce: CONFIRMED\n` +
      `${formatShortDate(summary.date)} ${describeSpans(summary.lines)}\n` +
      `Arrive 10-15 min early. Water and sports drinks only.`,
  );
}

/** Sent when the association turns a request down. */
export function declinedSms(summary: RequestSummary, note: string): string {
  const reason = note.trim() ? `\n${note.trim()}` : '';
  return trim(
    `BrookSide Bounce: NOT CONFIRMED\n` +
      `${formatShortDate(summary.date)} ${describeSpans(summary.lines)}` +
      `${reason}\n` +
      `The slot has been released.`,
  );
}

/**
 * Keeps a message inside one credit.
 *
 * Truncating is the lesser evil: a booker who reads a slightly clipped message
 * still knows what happened, and the association is not charged twice for a
 * long court name nobody needed.
 */
function trim(message: string): string {
  if (message.length <= SMS_SINGLE_LIMIT) return message;
  return `${message.slice(0, SMS_SINGLE_LIMIT - 1).trimEnd()}…`;
}
