import { describe, expect, it } from 'vitest';

import { mergeSlotSpans } from './slot-spans';

const at = (slotIndex: number, optionKey: string, price = 200) => ({
  slotIndex,
  optionKey,
  price,
});

describe('mergeSlotSpans', () => {
  it('joins consecutive hours on one court', () => {
    expect(mergeSlotSpans([at(6, 'pb2'), at(7, 'pb2')])).toEqual([
      { optionKey: 'pb2', fromSlot: 6, toSlot: 7, hours: 2, total: 400 },
    ]);
  });

  it('keeps courts apart', () => {
    const spans = mergeSlotSpans([
      at(6, 'pb2'),
      at(7, 'pb2'),
      at(6, 'pb3'),
      at(7, 'pb3'),
    ]);
    expect(spans).toEqual([
      { optionKey: 'pb2', fromSlot: 6, toSlot: 7, hours: 2, total: 400 },
      { optionKey: 'pb3', fromSlot: 6, toSlot: 7, hours: 2, total: 400 },
    ]);
  });

  it('splits on a gap', () => {
    const spans = mergeSlotSpans([at(6, 'pb1'), at(7, 'pb1'), at(9, 'pb1')]);
    expect(spans).toEqual([
      { optionKey: 'pb1', fromSlot: 6, toSlot: 7, hours: 2, total: 400 },
      { optionKey: 'pb1', fromSlot: 9, toSlot: 9, hours: 1, total: 200 },
    ]);
  });

  it('does not care what order they arrive in', () => {
    expect(mergeSlotSpans([at(8, 'pb1'), at(6, 'pb1'), at(7, 'pb1')])).toEqual([
      { optionKey: 'pb1', fromSlot: 6, toSlot: 8, hours: 3, total: 600 },
    ]);
  });

  it('adds up mixed prices across a span', () => {
    // 5:00 PM is daytime, 6:00 PM is evening.
    const spans = mergeSlotSpans([at(11, 'pb1', 200), at(12, 'pb1', 350)]);
    expect(spans).toEqual([
      { optionKey: 'pb1', fromSlot: 11, toSlot: 12, hours: 2, total: 550 },
    ]);
  });

  it('orders by start time, then court', () => {
    const spans = mergeSlotSpans([at(9, 'pb3'), at(6, 'pb4'), at(6, 'pb2')]);
    expect(spans.map((span) => [span.fromSlot, span.optionKey])).toEqual([
      [6, 'pb2'],
      [6, 'pb4'],
      [9, 'pb3'],
    ]);
  });

  it('handles an empty list', () => {
    expect(mergeSlotSpans([])).toEqual([]);
  });
});
