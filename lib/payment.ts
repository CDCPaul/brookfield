/**
 * Payment settings and limits, with no server dependencies.
 *
 * This lives apart from lib/queries/settings.ts because the booking screens
 * are client components: importing anything from the queries layer would drag
 * the database client into the browser bundle, where it throws on load because
 * DATABASE_URL does not exist there.
 */

/**
 * How paid bookings are settled. GCash is handled without any integration:
 * the payer sends money to the association's own account and gives the
 * reference number and a screenshot, which the association matches against its
 * transaction history when approving the request.
 */
export type PaymentConfig = {
  gcashName: string;
  gcashNumber: string;
  /** Extra guidance shown to the payer, e.g. where to pay in cash instead. */
  notes: string;
};

export const DEFAULT_PAYMENT: PaymentConfig = {
  gcashName: '',
  gcashNumber: '',
  notes: '',
};

/** Payment instructions can only be shown once an account is configured. */
export function isPaymentConfigured(payment: PaymentConfig): boolean {
  return payment.gcashNumber.trim() !== '';
}

/**
 * How long a paid request keeps its slot while the booker pays.
 *
 * Without a limit, an abandoned request holds a court indefinitely and the
 * association has to notice and decline it by hand. Free bookings are not on a
 * clock — there is nothing to wait for — and neither is a request whose receipt
 * has already been sent.
 */
export const PAYMENT_HOLD_MINUTES = 15;

export const MAX_PROOF_BYTES = 2 * 1024 * 1024;

export const ACCEPTED_PROOF_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * How long a screenshot is kept after the booking date.
 *
 * It only exists so the association can verify a payment and settle any
 * dispute; holding it for ever would fill the store for no reason.
 */
export const PROOF_RETENTION_DAYS = 90;
