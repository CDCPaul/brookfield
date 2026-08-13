import { describe, expect, it } from 'vitest';

import {
  decodeOwner,
  encodeOwner,
  isBookerType,
  phoneOwner,
  unitOwner,
} from './owner';

describe('owner identities', () => {
  it('keys residents by their normalized address', () => {
    const a = unitOwner({ phase: 'Phase 2A', block: 'Block 5', lot: 'Lot 12' });
    const b = unitOwner({ phase: 'ph-2a', block: 'blk 5', lot: '#12' });
    expect(a).toEqual({ kind: 'unit', key: '2A|5|12' });
    expect(a).toEqual(b);
  });

  it('keys guests by their normalized mobile number', () => {
    expect(phoneOwner('+63 917 123 4567')).toEqual({
      kind: 'phone',
      key: '09171234567',
    });
    expect(phoneOwner('0917 123 4567')).toEqual(phoneOwner('639171234567'));
  });

  it('never confuses a unit owner with a phone owner', () => {
    const unit = unitOwner({ phase: '9', block: '17', lot: '1234567' });
    expect(encodeOwner(unit)).not.toBe(encodeOwner(phoneOwner('09171234567')));
  });
});

describe('encodeOwner / decodeOwner', () => {
  it('round-trips both kinds', () => {
    for (const owner of [
      unitOwner({ phase: '2A', block: '5', lot: '12' }),
      phoneOwner('09171234567'),
    ]) {
      expect(decodeOwner(encodeOwner(owner))).toEqual(owner);
    }
  });

  it('keeps colons inside the key intact', () => {
    expect(decodeOwner('unit:2A|5|12:X')).toEqual({
      kind: 'unit',
      key: '2A|5|12:X',
    });
  });

  it('rejects anything malformed', () => {
    expect(decodeOwner('')).toBeNull();
    expect(decodeOwner('unit')).toBeNull();
    expect(decodeOwner('unit:')).toBeNull();
    expect(decodeOwner(':2A|5|12')).toBeNull();
    expect(decodeOwner('admin:everything')).toBeNull();
  });
});

describe('isBookerType', () => {
  it('accepts only the two known types', () => {
    expect(isBookerType('resident')).toBe(true);
    expect(isBookerType('guest')).toBe(true);
    expect(isBookerType('')).toBe(false);
    expect(isBookerType('admin')).toBe(false);
  });
});
