import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';

import { PROOF_RETENTION_DAYS } from '@/lib/payment';
import { isBlobConfigured } from '@/lib/payment-proof';
import {
  clearPaymentProof,
  getExpiredProofs,
} from '@/lib/queries/bookings';
import { addDays, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * Deletes payment screenshots once they are past the retention window.
 *
 * Run daily by Vercel Cron. Without this the Blob store grows for ever, even
 * though a screenshot is only useful until the payment has been verified and
 * any dispute has passed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization');
    if (header !== `Bearer ${secret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  if (!isBlobConfigured()) {
    return NextResponse.json({ skipped: 'Blob storage is not configured.' });
  }

  const cutoff = addDays(manilaNow().date, -PROOF_RETENTION_DAYS);
  const expired = await getExpiredProofs(cutoff);

  let deleted = 0;
  for (const proof of expired) {
    try {
      await del(proof.url);
    } catch {
      // Already gone, or never stored. Clear the row either way.
    }
    await clearPaymentProof(proof.id);
    deleted += 1;
  }

  return NextResponse.json({ cutoff, deleted });
}
