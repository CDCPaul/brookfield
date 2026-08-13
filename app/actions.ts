'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  decodeOwner,
  encodeOwner,
  isBookerType,
  phoneOwner,
  unitOwner,
  type Owner,
} from '@/lib/owner';
import {
  cancelBookingAsOwner,
  createBooking,
  getUpcomingBookingsForOwner,
  type BookingWithUnit,
} from '@/lib/queries/bookings';
import { manilaNow } from '@/lib/time';
import { isCompleteUnit, isValidPhilippineMobile } from '@/lib/unit-key';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export type BookingFormState = { error?: string };

export async function createBookingAction(
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const bookerType = text(formData, 'bookerType');
  if (!isBookerType(bookerType)) {
    return { error: 'Please choose whether you are a resident or a guest.' };
  }

  const result = await createBooking({
    date: text(formData, 'date'),
    slotIndex: Number(formData.get('slot')),
    courtNo: Number(formData.get('court')),
    bookerType,
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
  /** Returned so a cancel can prove ownership without re-entering anything. */
  owner?: string;
};

/**
 * Finds bookings by mobile number or by household address. Guests have no
 * address, so the number is the only identity they have.
 */
export async function lookupBookingsAction(
  _previous: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const phone = text(formData, 'phone').trim();
  const unit = {
    phase: text(formData, 'phase'),
    block: text(formData, 'block'),
    lot: text(formData, 'lot'),
  };

  let owner: Owner;
  if (phone !== '') {
    if (!isValidPhilippineMobile(phone)) {
      return { error: 'Please enter a valid mobile number, e.g. 0917 123 4567.' };
    }
    owner = phoneOwner(phone);
  } else if (isCompleteUnit(unit)) {
    owner = unitOwner(unit);
  } else {
    return { error: 'Enter your mobile number, or your phase, block and lot.' };
  }

  const bookings = await getUpcomingBookingsForOwner(owner, manilaNow().date);

  return { bookings, searched: true, owner: encodeOwner(owner) };
}

export type CancelState = { error?: string; cancelled?: boolean };

export async function cancelBookingAction(
  _previous: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const bookingId = Number(formData.get('bookingId'));
  const owner = decodeOwner(text(formData, 'owner'));

  if (!Number.isInteger(bookingId) || !owner) {
    return { error: 'Could not identify that booking.' };
  }

  const result = await cancelBookingAsOwner(bookingId, owner);
  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath('/');
  revalidatePath('/book');
  revalidatePath('/my');
  return { cancelled: true };
}
