/**
 * Server-side view of screenshot storage.
 *
 * Vercel Blob is optional: without a token the app still works, it just asks
 * for the GCash reference number alone. That keeps local development and any
 * deployment without a Blob store from breaking.
 *
 * Kept separate from lib/payment.ts so that reading process.env never reaches
 * a client bundle.
 */

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
