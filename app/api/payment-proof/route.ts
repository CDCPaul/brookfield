import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

import { decodeOwner } from '@/lib/owner';
import { ACCEPTED_PROOF_TYPES, MAX_PROOF_BYTES } from '@/lib/payment';
import { isBlobConfigured } from '@/lib/payment-proof';
import { attachPaymentProof } from '@/lib/queries/bookings';

export const dynamic = 'force-dynamic';

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isBlobConfigured()) {
    return fail('Screenshot upload is not set up yet.', 503);
  }

  const formData = await request.formData();

  const bookingIds = String(formData.get('bookingIds') ?? '')
    .split(',')
    .map(Number)
    .filter(Number.isInteger);
  const owner = decodeOwner(String(formData.get('owner') ?? ''));
  const file = formData.get('file');

  if (bookingIds.length === 0 || !owner) {
    return fail('Could not identify that booking.', 400);
  }
  if (!(file instanceof File)) {
    return fail('Please choose an image.', 400);
  }
  if (file.size > MAX_PROOF_BYTES) {
    return fail('That image is too large. Please try again.', 413);
  }
  if (!ACCEPTED_PROOF_TYPES.includes(file.type)) {
    return fail('Please upload a photo or screenshot.', 415);
  }

  // Random suffix so the URL cannot be guessed from the booking id.
  let blob;
  try {
    blob = await put(`payment-proof/${bookingIds[0]}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    });
  } catch (error) {
    // Almost always a store that is not reachable from this deployment. Say so
    // plainly — a generic failure here reads as "the app is broken".
    console.error('Blob upload failed', error);
    return fail(
      'Could not store the screenshot. Please tell the association.',
      502,
    );
  }

  // One receipt covers every hour booked together.
  for (const bookingId of bookingIds) {
    const result = await attachPaymentProof(bookingId, owner, blob.url);
    if (!result.ok) return fail(result.message, 400);
  }

  return NextResponse.json({ url: blob.url });
}
