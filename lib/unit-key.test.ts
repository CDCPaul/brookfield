import { describe, expect, it } from 'vitest';

import {
  buildUnitKey,
  formatUnitLabel,
  isCompleteUnit,
  isValidPhilippineMobile,
  normalizeName,
  normalizePart,
  normalizePhone,
} from './unit-key';

describe('normalizePart', () => {
  it('collapses the ways residents write the same value', () => {
    for (const input of ['Phase 2A', 'ph-2a', 'PH 2A', '2 A', 'phase2a']) {
      expect(normalizePart(input)).toBe('2A');
    }
  });

  it('strips block and lot labels', () => {
    expect(normalizePart('Block 5')).toBe('5');
    expect(normalizePart('blk-05')).toBe('05');
    expect(normalizePart('Lot 12')).toBe('12');
    expect(normalizePart('#12')).toBe('12');
  });

  it('keeps a value that is nothing but a label', () => {
    expect(normalizePart('PH')).toBe('PH');
    expect(normalizePart('lot')).toBe('LOT');
  });

  it('does not strip letters that merely start like a label', () => {
    expect(normalizePart('PHOENIX')).toBe('PHOENIX');
    expect(normalizePart('BLKA')).toBe('BLKA');
  });

  it('handles full-width characters and stray whitespace', () => {
    expect(normalizePart('  ２Ａ  ')).toBe('2A');
  });
});

describe('buildUnitKey', () => {
  it('maps equivalent addresses to one key', () => {
    const a = buildUnitKey({ phase: 'Phase 2A', block: 'Block 5', lot: 'Lot 12' });
    const b = buildUnitKey({ phase: 'ph-2a', block: 'blk 5', lot: '#12' });
    expect(a).toBe(b);
    expect(a).toBe('2A|5|12');
  });

  it('keeps different addresses distinct', () => {
    const a = buildUnitKey({ phase: '2', block: '5', lot: '12' });
    const b = buildUnitKey({ phase: '2', block: '5', lot: '13' });
    expect(a).not.toBe(b);
  });

  it('does not confuse a shifted address', () => {
    // Block 51 / Lot 2 must not collide with Block 5 / Lot 12.
    const a = buildUnitKey({ phase: '2', block: '51', lot: '2' });
    const b = buildUnitKey({ phase: '2', block: '5', lot: '12' });
    expect(a).not.toBe(b);
  });
});

describe('isCompleteUnit', () => {
  it('requires all three components', () => {
    expect(isCompleteUnit({ phase: '2', block: '5', lot: '12' })).toBe(true);
    expect(isCompleteUnit({ phase: '', block: '5', lot: '12' })).toBe(false);
    expect(isCompleteUnit({ phase: '2', block: '   ', lot: '12' })).toBe(false);
  });
});

describe('formatUnitLabel', () => {
  it('renders a consistent label from messy input', () => {
    expect(
      formatUnitLabel({ phase: 'phase 2a', block: 'blk-5', lot: 'Lot 12' }),
    ).toBe('Ph 2A · Blk 5 · Lot 12');
  });
});

describe('normalizeName', () => {
  it('ignores case and extra spacing', () => {
    expect(normalizeName('  juan   dela Cruz ')).toBe('JUAN DELA CRUZ');
    expect(normalizeName('Juan Dela Cruz')).toBe(normalizeName('juan dela cruz'));
  });
});

describe('phone numbers', () => {
  it('normalizes Philippine mobile formats to 09XXXXXXXXX', () => {
    expect(normalizePhone('0917 123 4567')).toBe('09171234567');
    expect(normalizePhone('+63 917 123 4567')).toBe('09171234567');
    expect(normalizePhone('639171234567')).toBe('09171234567');
    expect(normalizePhone('9171234567')).toBe('09171234567');
  });

  it('validates the normalized form', () => {
    expect(isValidPhilippineMobile('+63 917 123 4567')).toBe(true);
    expect(isValidPhilippineMobile('0917123456')).toBe(false); // too short
    expect(isValidPhilippineMobile('021234567')).toBe(false); // landline
    expect(isValidPhilippineMobile('')).toBe(false);
  });
});
