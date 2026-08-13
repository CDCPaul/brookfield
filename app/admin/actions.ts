'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  checkAdminPassword,
  endAdminSession,
  isAdmin,
  startAdminSession,
} from '@/lib/auth';
import {
  approveBooking,
  cancelBookingAsAdmin,
  markNoShow,
  markPaymentReceived,
  rejectBooking,
} from '@/lib/queries/bookings';
import { createClosure, deleteClosure } from '@/lib/queries/closures';
import {
  savePayment,
  savePricing,
  saveSchedule,
  saveLimits,
} from '@/lib/queries/settings';
import { setUnitBlocked } from '@/lib/queries/units';
import { LAST_HOUR, OPEN_HOUR, isValidSlotIndex } from '@/lib/schedule';
import { isValidDateStr } from '@/lib/time';

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect('/admin/login');
  }
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function optionalNumber(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (raw === '' || raw === 'all') return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

export type AdminFormState = { error?: string; message?: string };

function revalidateBookings(): void {
  revalidatePath('/admin');
  revalidatePath('/admin/requests');
  revalidatePath('/');
  revalidatePath('/book');
  revalidatePath('/my');
}

export async function adminLoginAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const password = text(formData, 'password');
  if (!checkAdminPassword(password)) {
    return { error: 'Incorrect password.' };
  }
  await startAdminSession();
  redirect('/admin');
}

export async function adminLogoutAction(): Promise<void> {
  await endAdminSession();
  redirect('/admin/login');
}

function bookingId(formData: FormData): number | null {
  const value = Number(formData.get('bookingId'));
  return Number.isInteger(value) ? value : null;
}

export async function approveBookingAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const id = bookingId(formData);
  if (id === null) return { error: 'Unknown booking.' };

  const result = await approveBooking(id, text(formData, 'markPaid') === 'true');
  if (!result.ok) return { error: result.message };

  revalidateBookings();
  return { message: 'Booking approved.' };
}

export async function rejectBookingAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const id = bookingId(formData);
  if (id === null) return { error: 'Unknown booking.' };

  const result = await rejectBooking(id, text(formData, 'note'));
  if (!result.ok) return { error: result.message };

  revalidateBookings();
  return { message: 'Request declined and the slot released.' };
}

export async function markPaidAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const id = bookingId(formData);
  if (id === null) return { error: 'Unknown booking.' };

  const result = await markPaymentReceived(id);
  if (!result.ok) return { error: result.message };

  revalidateBookings();
  return { message: 'Marked as paid.' };
}

export async function adminCancelBookingAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const id = bookingId(formData);
  if (id === null) return { error: 'Unknown booking.' };

  const result = await cancelBookingAsAdmin(id, text(formData, 'reason'));
  if (!result.ok) return { error: result.message };

  revalidateBookings();
  return { message: 'Booking cancelled.' };
}

export async function adminMarkNoShowAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const id = bookingId(formData);
  if (id === null) return { error: 'Unknown booking.' };

  const result = await markNoShow(id);
  if (!result.ok) return { error: result.message };

  revalidateBookings();
  return { message: 'Marked as no-show.' };
}

export async function createClosureAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const dateFrom = text(formData, 'dateFrom');
  const dateTo = text(formData, 'dateTo') || dateFrom;
  const reason = text(formData, 'reason').trim();

  if (!isValidDateStr(dateFrom) || !isValidDateStr(dateTo)) {
    return { error: 'Please choose valid dates.' };
  }
  if (dateTo < dateFrom) {
    return { error: 'The end date cannot be before the start date.' };
  }
  if (reason.length < 3) {
    return { error: 'Please give a short reason (shown to residents).' };
  }

  const slotIndex = optionalNumber(formData, 'slotIndex');
  if (slotIndex !== null && !isValidSlotIndex(slotIndex)) {
    return { error: 'Invalid time slot.' };
  }

  const courtNo = optionalNumber(formData, 'courtNo');
  if (courtNo !== null && (courtNo < 1 || courtNo > 4)) {
    return { error: 'Invalid court number.' };
  }

  await createClosure({ dateFrom, dateTo, slotIndex, courtNo, reason });

  revalidatePath('/admin/closures');
  revalidatePath('/');
  revalidatePath('/book');
  return { message: 'Closure added.' };
}

export async function deleteClosureAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const id = Number(formData.get('id'));
  if (!Number.isInteger(id)) return { error: 'Unknown closure.' };

  await deleteClosure(id);

  revalidatePath('/admin/closures');
  revalidatePath('/');
  revalidatePath('/book');
  return { message: 'Closure removed.' };
}

export async function setUnitBlockedAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const id = Number(formData.get('unitId'));
  if (!Number.isInteger(id)) return { error: 'Unknown unit.' };

  const blocked = text(formData, 'blocked') === 'true';
  const reason = text(formData, 'reason').trim();

  if (blocked && reason.length < 3) {
    return { error: 'Please record why this unit is being blocked.' };
  }

  await setUnitBlocked(id, blocked, reason || null);

  revalidatePath('/admin/units');
  return { message: blocked ? 'Unit blocked.' : 'Unit unblocked.' };
}

export async function saveLimitsAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const maxPerDay = Number(formData.get('maxPerDay'));
  const maxPerWeek = Number(formData.get('maxPerWeek'));
  const advanceDays = Number(formData.get('advanceDays'));

  const inRange = (value: number, max: number) =>
    Number.isInteger(value) && value >= 0 && value <= max;

  if (!inRange(maxPerDay, 10) || !inRange(maxPerWeek, 50)) {
    return { error: 'Per-household limits must be between 0 and 10 / 50.' };
  }
  if (!inRange(advanceDays, 60) || advanceDays < 1) {
    return { error: 'The booking window must be between 1 and 60 days.' };
  }
  if (maxPerWeek < maxPerDay) {
    return { error: 'The weekly limit cannot be lower than the daily limit.' };
  }

  await saveLimits({
    enabled: text(formData, 'enabled') === 'on',
    maxPerDay,
    maxPerWeek,
    advanceDays,
  });

  revalidatePath('/admin/settings');
  revalidatePath('/');
  revalidatePath('/book');
  revalidatePath('/rules');
  return { message: 'Booking limits saved.' };
}

export async function saveHoursAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const freeUntilHour = Number(formData.get('freeUntilHour'));
  const dayUntilHour = Number(formData.get('dayUntilHour'));
  const closeHour = Number(formData.get('closeHour'));

  const validHour = (value: number) =>
    Number.isInteger(value) && value >= OPEN_HOUR && value <= LAST_HOUR;

  if (![freeUntilHour, dayUntilHour, closeHour].every(validHour)) {
    return { error: `Hours must be between ${OPEN_HOUR} and ${LAST_HOUR}.` };
  }
  if (freeUntilHour > dayUntilHour || dayUntilHour > closeHour) {
    return {
      error:
        'Hours must run in order: free morning, then daytime, then evening.',
    };
  }

  await saveSchedule({ freeUntilHour, dayUntilHour, closeHour });

  revalidatePath('/admin/settings');
  revalidatePath('/');
  revalidatePath('/book');
  revalidatePath('/rules');
  return { message: 'Opening hours saved.' };
}

export async function savePricingAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const read = (key: string) => Number(formData.get(key));
  const values = {
    dayTennis: read('dayTennis'),
    dayPickleball: read('dayPickleball'),
    nightTennis: read('nightTennis'),
    nightPickleball: read('nightPickleball'),
  };

  const valid = Object.values(values).every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 100_000,
  );
  if (!valid) {
    return { error: 'Prices must be whole pesos between 0 and 100,000.' };
  }

  await savePricing({
    day: { tennis: values.dayTennis, pickleball: values.dayPickleball },
    night: { tennis: values.nightTennis, pickleball: values.nightPickleball },
  });

  revalidatePath('/admin/settings');
  revalidatePath('/book');
  revalidatePath('/rules');
  return { message: 'Prices saved.' };
}

export async function savePaymentAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const gcashNumber = text(formData, 'gcashNumber').trim();
  if (gcashNumber !== '' && !/^0\d{10}$/.test(gcashNumber.replace(/\s/g, ''))) {
    return { error: 'Enter the GCash number as 11 digits, e.g. 09171234567.' };
  }

  await savePayment({
    gcashName: text(formData, 'gcashName').trim(),
    gcashNumber: gcashNumber.replace(/\s/g, ''),
    notes: text(formData, 'notes').trim(),
  });

  revalidatePath('/admin/settings');
  revalidatePath('/my');
  return { message: 'Payment details saved.' };
}
