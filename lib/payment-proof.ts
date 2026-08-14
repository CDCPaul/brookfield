/**
 * Server-side view of screenshot storage.
 *
 * Vercel Blob is optional: without a store the app still works, it just does
 * not offer the upload. That keeps local development and any deployment
 * without a store from breaking.
 *
 * Connecting a store injects `BLOB_STORE_ID`; a read-write token is only
 * added for some setups, so either is taken as evidence a store exists. If the
 * upload then fails to authenticate, the route says so rather than the button
 * quietly vanishing.
 *
 * Kept separate from lib/payment.ts so that reading process.env never reaches
 * a client bundle.
 */

export function isBlobConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
  );
}
