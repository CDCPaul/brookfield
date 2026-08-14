/**
 * Collapses consecutive hours on the same court into one line.
 *
 * Booking noon to two on courts 2 and 3 is four rows in the database but two
 * things in the booker's head. Listing them hour by hour makes a simple
 * request look like a mess and hides the shape of what was asked for.
 */

export type SlotEntry = {
  slotIndex: number;
  optionKey: string;
  price: number;
};

export type SlotSpan = {
  optionKey: string;
  /** First hour, inclusive. */
  fromSlot: number;
  /** Last hour, inclusive. */
  toSlot: number;
  hours: number;
  total: number;
};

export function mergeSlotSpans(entries: readonly SlotEntry[]): SlotSpan[] {
  const byCourt = new Map<string, SlotEntry[]>();
  for (const entry of entries) {
    const list = byCourt.get(entry.optionKey);
    if (list) list.push(entry);
    else byCourt.set(entry.optionKey, [entry]);
  }

  const spans: SlotSpan[] = [];

  for (const [optionKey, list] of byCourt) {
    const sorted = [...list].sort((a, b) => a.slotIndex - b.slotIndex);
    let current: SlotSpan | null = null;

    for (const entry of sorted) {
      // A gap, however small, is two separate bookings to whoever turns up.
      if (current && entry.slotIndex === current.toSlot + 1) {
        current.toSlot = entry.slotIndex;
        current.hours += 1;
        current.total += entry.price;
        continue;
      }

      current = {
        optionKey,
        fromSlot: entry.slotIndex,
        toSlot: entry.slotIndex,
        hours: 1,
        total: entry.price,
      };
      spans.push(current);
    }
  }

  return spans.sort(
    (a, b) => a.fromSlot - b.fromSlot || a.optionKey.localeCompare(b.optionKey),
  );
}
