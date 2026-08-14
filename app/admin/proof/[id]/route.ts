import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { getBookingProof } from '@/lib/queries/bookings';

export const dynamic = 'force-dynamic';

/**
 * Serves a payment screenshot to the association.
 *
 * The blobs are private, so this is the only way to see one: the request is
 * checked for an admin session and the file is streamed through. Receipts
 * carry the payer's name and the amount, and nothing about them should be
 * reachable from a URL alone.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const pathname = await getBookingProof(bookingId);
  if (!pathname) return new NextResponse('Not found', { status: 404 });

  const blob = await get(pathname, { access: 'private' });
  if (!blob || blob.statusCode !== 200) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(blob.stream, {
    headers: {
      'Content-Type': blob.blob.contentType,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
