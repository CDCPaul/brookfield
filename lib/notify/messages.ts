/**
 * Text message wording.
 *
 * Semaphore bills one credit per 160 characters and then segments at 153, so a
 * message that drifts to 161 characters costs double for one wasted letter.
 * These are written tight on purpose and the tests hold them there.
 *
 * Fitting is not just clipping the end. A request can cover four courts for
 * six hours, and the naive listing of that runs well past a credit — so the
 * courts are compressed, and each message hands the schedule only the room
 * left over once the parts nobody can afford to lose are accounted for.
 */

import { findOption } from '@/lib/courts';
import { getSlot } from '@/lib/schedule';
import { formatClock, formatShortDate, type DateStr } from '@/lib/time';
import { mergeSlotSpans, type SlotEntry, type SlotSpan } from '@/lib/slot-spans';

/** One credit's worth. Anything longer is billed as two. */
export const SMS_SINGLE_LIMIT = 160;

/** Long enough for any real name; a guard against pasted nonsense. */
const NAME_LIMIT = 40;

/** Below this there is no room to say anything useful, so the note is dropped. */
const MIN_NOTE = 12;

export type BookingLine = SlotEntry;

export type RequestSummary = {
  date: DateStr;
  name: string;
  amount: number;
  lines: BookingLine[];
  /** Booking reference, so a notification can open the right screen. */
  code?: string;
};

/**
 * What the service worker in public/sw.js renders.
 *
 * Declared here rather than beside the sender so the wording stays in one
 * pure, testable module.
 */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  important?: boolean;
};

/**
 * Push is not billed by the character, so it says the same things in full.
 *
 * Phones still truncate a long notification in the tray, so this is generous
 * rather than unlimited — enough for a full day across every court.
 */
const PUSH_BUDGET = 240;

/** Sent to the association when someone asks for a court. */
export function newRequestSms(summary: RequestSummary): string {
  const fee = summary.amount > 0 ? ` P${summary.amount}` : ' free';
  const head =
    `BrookSide Bounce: NEW REQUEST${fee}\n` +
    `${fitName(summary.name)}\n` +
    `${formatShortDate(summary.date)} `;
  const tail = '\nApprove in the admin page.';
  return trim(head + describeSpans(summary.lines, room(head, tail)) + tail);
}

/** Sent to the booker once the association approves. */
export function confirmedSms(summary: RequestSummary): string {
  const head =
    `BrookSide Bounce: CONFIRMED\n${formatShortDate(summary.date)} `;
  const tail = '\nArrive 10-15 min early. Water and sports drinks only.';
  return trim(head + describeSpans(summary.lines, room(head, tail)) + tail);
}

/** Sent when the association turns a request down. */
export function declinedSms(summary: RequestSummary, note: string): string {
  const head =
    `BrookSide Bounce: NOT CONFIRMED\n${formatShortDate(summary.date)} `;
  const tail = '\nThe slot has been released.';
  const spans = describeSpans(summary.lines, room(head, tail));
  const left = room(head, tail) - spans.length;
  return trim(head + spans + fitNote(note, left) + tail);
}

/** Pushed to the association when someone asks for a court. */
export function newRequestPush(summary: RequestSummary): PushPayload {
  const fee = summary.amount > 0 ? `P${summary.amount}` : 'Free';
  return {
    title: `New request — ${fee}`,
    body:
      `${fitName(summary.name)}\n` +
      `${formatShortDate(summary.date)} ${describeSpans(summary.lines, PUSH_BUDGET)}`,
    url: '/admin/requests',
    // One request, one notification, however many times it is re-sent.
    tag: `request-${summary.code ?? summary.date}`,
    important: true,
  };
}

/** Pushed to the booker once the association approves. */
export function confirmedPush(summary: RequestSummary): PushPayload {
  return {
    title: 'Court confirmed',
    body:
      `${formatShortDate(summary.date)} ${describeSpans(summary.lines, PUSH_BUDGET)}\n` +
      'Arrive 10-15 minutes early. Water and sports drinks only.',
    url: summary.code ? `/booking/${summary.code}` : '/my',
    tag: `booking-${summary.code ?? summary.date}`,
  };
}

/** Pushed when the association turns a request down. */
export function declinedPush(
  summary: RequestSummary,
  note: string,
): PushPayload {
  const reason = note.trim() ? `\n${note.trim()}` : '';
  return {
    title: 'Request not confirmed',
    body:
      `${formatShortDate(summary.date)} ${describeSpans(summary.lines, PUSH_BUDGET)}` +
      `${reason}\n` +
      'The slot has been released.',
    url: summary.code ? `/booking/${summary.code}` : '/my',
    tag: `booking-${summary.code ?? summary.date}`,
  };
}

/** What is left for the schedule once the fixed wording is paid for. */
function room(head: string, tail: string): number {
  return Math.max(0, SMS_SINGLE_LIMIT - head.length - tail.length);
}

/**
 * '6PM-9PM Courts 1-4' — the schedule in as few characters as it takes.
 *
 * Hours on one court merge into a range, then courts sharing the same range
 * merge into one line: booking all four courts for the same evening is one
 * thing the booker did, not four. If even that will not fit, the exact courts
 * give way to a count — better a true summary than a listing cut off midway,
 * which would quietly drop a court the booker is paying for.
 */
function describeSpans(entries: readonly BookingLine[], budget: number): string {
  const spans = mergeSlotSpans(entries);
  if (spans.length === 0) return '';

  const byRange = new Map<string, SlotSpan[]>();
  for (const span of spans) {
    const key = `${span.fromSlot}-${span.toSlot}`;
    const list = byRange.get(key);
    if (list) list.push(span);
    else byRange.set(key, [span]);
  }

  const listed = [...byRange.values()]
    .map((group) => `${rangeLabel(group[0])} ${joinCourts(group.map(courtLabel))}`)
    .join(', ');

  return listed.length <= budget ? listed : summarise(spans);
}

/** '6PM-9PM', or '9:30AM-10:30AM' if the hours ever stop being whole. */
function rangeLabel(span: SlotSpan): string {
  return `${shortClock(getSlot(span.fromSlot).startMinutes)}-${shortClock(getSlot(span.toSlot).endMinutes)}`;
}

function courtLabel(span: SlotSpan): string {
  return findOption(span.optionKey)?.short ?? span.optionKey;
}

const NUMBERED_COURT = /^Court (\d+)$/;

/**
 * 'Courts 1-4' where the courts are numbered and run together, 'Courts 1,3'
 * where they do not. Anything unnumbered — the tennis court, the basketball
 * halves — is listed as it is, since there is nothing to compress.
 */
function joinCourts(labels: readonly string[]): string {
  const numbers: number[] = [];
  for (const label of labels) {
    const match = NUMBERED_COURT.exec(label);
    if (!match) return labels.join(', ');
    numbers.push(Number(match[1]));
  }

  if (numbers.length === 1) return `Court ${numbers[0]}`;
  return `Courts ${compressRuns([...numbers].sort((a, b) => a - b))}`;
}

/** [1,2,3,5] becomes '1-3,5'. */
function compressRuns(sorted: readonly number[]): string {
  const parts: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (const value of sorted.slice(1)) {
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = value;
    previous = value;
  }

  parts.push(start === previous ? `${start}` : `${start}-${previous}`);
  return parts.join(',');
}

/** '9 hrs on 4 courts, 6AM-12AM' — the shape of the booking when the detail will not fit. */
function summarise(spans: readonly SlotSpan[]): string {
  const courts = new Set(spans.map((span) => span.optionKey)).size;
  const hours = spans.reduce((sum, span) => sum + span.hours, 0);
  const first = Math.min(...spans.map((span) => span.fromSlot));
  const last = Math.max(...spans.map((span) => span.toSlot));
  const window = `${shortClock(getSlot(first).startMinutes)}-${shortClock(getSlot(last).endMinutes)}`;
  return `${hours} ${hours === 1 ? 'hr' : 'hrs'} on ${courts} ${courts === 1 ? 'court' : 'courts'}, ${window}`;
}

/** '12PM' or '9:30AM' — drops ':00' and the space to save characters. */
function shortClock(minutes: number): string {
  return formatClock(minutes).replace(':00', '').replace(' ', '');
}

function fitName(name: string): string {
  const clean = name.trim();
  if (clean.length <= NAME_LIMIT) return clean;
  return `${clean.slice(0, NAME_LIMIT - 1).trimEnd()}…`;
}

/**
 * The association's note is the first thing to go.
 *
 * A booker who reads "not confirmed, the slot has been released" knows where
 * they stand; the reason is welcome but it is not what they act on.
 */
function fitNote(note: string, left: number): string {
  const clean = note.trim();
  if (!clean) return '';
  if (clean.length + 1 <= left) return `\n${clean}`;
  if (left < MIN_NOTE) return '';
  return `\n${clean.slice(0, left - 2).trimEnd()}…`;
}

/** Last line of defence. Everything above is meant to make this a no-op. */
function trim(message: string): string {
  if (message.length <= SMS_SINGLE_LIMIT) return message;
  return `${message.slice(0, SMS_SINGLE_LIMIT - 1).trimEnd()}…`;
}
