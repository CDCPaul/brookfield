'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  cancelBookingAsResident,
  createBooking,
  getUpcomingBookingsForUnit,
  type BookingWithUnit,
} from '@/lib/queries/bookings';
import { manilaNow } from '@/lib/time';
import { buildUnitKey, isCompleteUnit } from '@/lib/unit-key';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export type BookingFormState = { error?: string };

export async function createBookingAction(
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const result = await createBooking({
    date: text(formData, 'date'),
    slotIndex: Number(formData.get('slot')),
    courtNo: Number(formData.get('court')),
    phase: text(formData, 'phase'),
    block: text(formData, 'block'),
    lot: text(formData, 'lot'),
    name: text(formData, 'name'),
    phone: text(formData, 'phone'),
  });

  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath('/');
  revalidatePath('/book');
  redirect(`/booking/${result.booking.code}`);
}

export type LookupState = {
  error?: string;
  bookings?: BookingWithUnit[];
  searched?: boolean;
  /** Returned so a cancel can prove ownership without re-entering the address. */
  unitKey?: string;
};

export async function lookupBookingsAction(
  _previous: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const unit = {
    phase: text(formData, 'phase'),
    block: text(formData, 'block'),
    lot: text(formData, 'lot'),
  };

  if (!isCompleteUnit(unit)) {
    return { error: 'Please fill in your phase, block and lot.' };
  }

  const unitKey = buildUnitKey(unit);
  const today = manilaNow().date;
  const bookings = await getUpcomingBookingsForUnit(unitKey, today);

  return { bookings, searched: true, unitKey };
}

export type CancelState = { error?: string; cancelled?: boolean };

export async function cancelBookingAction(
  _previous: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const bookingId = Number(formData.get('bookingId'));
  const unitKey = text(formData, 'unitKey');

  if (!Number.isInteger(bookingId) || unitKey === '') {
    return { error: 'Could not identify that booking.' };
  }

  const result = await cancelBookingAsResident(bookingId, unitKey);
  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath('/');
  revalidatePath('/book');
  revalidatePath('/my');
  return { cancelled: true };
}
