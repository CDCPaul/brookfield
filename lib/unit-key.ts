/**
 * Turns free-text Phase / Block / Lot input into one stable identity.
 *
 * Residents type their address differently every time — 'Phase 2A', 'ph-2a',
 * '2 A' all mean the same house. Booking limits are enforced per household, so
 * these have to collapse to a single key or the limits are trivially bypassed.
 */

/** Labels residents commonly type in front of the actual value. */
const LEADING_LABELS = /^(PHASES?|PH|BLOCKS?|BLK|LOTS?|LT)(?=[\s\d]|$)\s*/;

const SEPARATORS = /[-._#/\\]/g;

/**
 * Normalizes one address component.
 *
 * 'Phase 2A' -> '2A', 'blk-05' -> '05', 'Lot 12' -> '12'.
 * A value that is nothing but a label ('PH') is left intact, since stripping it
 * would leave an empty key.
 */
export function normalizePart(raw: string): string {
  let value = raw.normalize('NFKC').trim().toUpperCase();
  value = value.replace(SEPARATORS, ' ');
  value = value.replace(/\s+/g, ' ').trim();

  // Strip repeated labels ('Phase Ph 2') but never down to an empty string.
  for (;;) {
    const stripped = value.replace(LEADING_LABELS, '').trim();
    if (stripped === value || stripped === '') break;
    value = stripped;
  }

  return value.replace(/\s+/g, '');
}

export type UnitInput = {
  phase: string;
  block: string;
  lot: string;
};

export function buildUnitKey({ phase, block, lot }: UnitInput): string {
  return [normalizePart(phase), normalizePart(block), normalizePart(lot)].join(
    '|',
  );
}

/** True when all three components normalize to something non-empty. */
export function isCompleteUnit(input: UnitInput): boolean {
  return (
    normalizePart(input.phase) !== '' &&
    normalizePart(input.block) !== '' &&
    normalizePart(input.lot) !== ''
  );
}

/** Display form, built from the normalized parts so it reads consistently. */
export function formatUnitLabel(input: UnitInput): string {
  const phase = normalizePart(input.phase);
  const block = normalizePart(input.block);
  const lot = normalizePart(input.lot);
  return `Ph ${phase} · Blk ${block} · Lot ${lot}`;
}

const NAME_COLLAPSE = /\s+/g;

/** Names are compared case- and spacing-insensitively when verifying a cancel. */
export function normalizeName(raw: string): string {
  return raw.normalize('NFKC').trim().toUpperCase().replace(NAME_COLLAPSE, ' ');
}

/**
 * Philippine mobile numbers, reduced to a comparable form.
 * '0917 123 4567', '+63 917 123 4567' and '639171234567' all become
 * '09171234567'. Anything unrecognized is returned digits-only so the admin
 * still has something to dial.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith('9') && digits.length === 10) return `0${digits}`;
  return digits;
}

export function isValidPhilippineMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(raw));
}
