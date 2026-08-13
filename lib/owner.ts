/**
 * Who a booking belongs to.
 *
 * Residents are identified by their household (phase/block/lot); guests have no
 * unit, so their mobile number is their identity. Both booking limits and
 * cancellation permission key off this, and it is passed between the server and
 * the client as an opaque string.
 */

import { buildUnitKey, normalizePhone, type UnitInput } from './unit-key';

export type BookerType = 'resident' | 'guest';

export type Owner =
  | { kind: 'unit'; key: string }
  | { kind: 'phone'; key: string };

export function unitOwner(input: UnitInput): Owner {
  return { kind: 'unit', key: buildUnitKey(input) };
}

export function phoneOwner(phone: string): Owner {
  return { kind: 'phone', key: normalizePhone(phone) };
}

export function encodeOwner(owner: Owner): string {
  return `${owner.kind}:${owner.key}`;
}

export function decodeOwner(value: string): Owner | null {
  const separator = value.indexOf(':');
  if (separator < 1) return null;

  const kind = value.slice(0, separator);
  const key = value.slice(separator + 1);
  if (key === '') return null;
  if (kind !== 'unit' && kind !== 'phone') return null;

  return { kind, key };
}

export function isBookerType(value: string): value is BookerType {
  return value === 'resident' || value === 'guest';
}
