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

  const bookingId = Number(formData.get('bookingId'));
  const owner = decodeOwner(String(formData.get('owner') ?? ''));
  const file = formData.get('file');

  if (!Number.isInteger(bookingId) || !owner) {
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
  const blob = await put(`payment-proof/${bookingId}`, file, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
  });

  const result = await attachPaymentProof(bookingId, owner, blob.url);
  if (!result.ok) {
    return fail(result.message, 400);
  }

  return NextResponse.json({ url: blob.url });
}
