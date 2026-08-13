/**
 * Six-character booking references.
 *
 * The alphabet omits 0/O and 1/I/L so a code read off a phone screen and
 * repeated over the phone to the association office cannot be misheard.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateBookingCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

export function isValidBookingCode(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  if (normalized.length !== CODE_LENGTH) return false;
  return [...normalized].every((char) => ALPHABET.includes(char));
}

export function normalizeBookingCode(value: string): string {
  return value.trim().toUpperCase();
}
