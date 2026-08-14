/**
 * Sending text messages through Semaphore (semaphore.co).
 *
 * Texting is a side effect of booking, never a condition of it: if Semaphore
 * is down, unconfigured, or out of credit, the booking still goes through and
 * the failure is logged. Nobody should lose a court because a text failed.
 */

import { normalizePhone } from '@/lib/unit-key';

const ENDPOINT = 'https://api.semaphore.co/api/v4/messages';

export function isSmsConfigured(): boolean {
  return Boolean(process.env.SEMAPHORE_API_KEY);
}

export type SmsResult =
  | { sent: true; count: number }
  | { sent: false; reason: string };

/**
 * Sends one message to one or more Philippine mobile numbers.
 *
 * Semaphore takes a comma-separated list, so a single call covers every
 * association phone.
 */
export async function sendSms(
  to: readonly string[],
  message: string,
): Promise<SmsResult> {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) return { sent: false, reason: 'SMS is not configured' };

  const numbers = [...new Set(to.map(normalizePhone).filter(Boolean))];
  if (numbers.length === 0) return { sent: false, reason: 'No numbers given' };

  const body = new URLSearchParams({
    apikey: apiKey,
    number: numbers.join(','),
    message,
  });

  const senderName = process.env.SEMAPHORE_SENDER_NAME?.trim();
  if (senderName) body.set('sendername', senderName);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Semaphore rejected the message', response.status, detail);
      return { sent: false, reason: `Semaphore returned ${response.status}` };
    }

    return { sent: true, count: numbers.length };
  } catch (error) {
    console.error('Could not reach Semaphore', error);
    return { sent: false, reason: 'Could not reach Semaphore' };
  }
}

/**
 * Sends without ever throwing into the caller.
 *
 * Used from the booking flow, where a texting problem must not surface as a
 * failed booking.
 */
export async function sendSmsQuietly(
  to: readonly string[],
  message: string,
): Promise<void> {
  try {
    const result = await sendSms(to, message);
    if (!result.sent) console.warn('Text not sent:', result.reason);
  } catch (error) {
    console.error('Text failed', error);
  }
}
