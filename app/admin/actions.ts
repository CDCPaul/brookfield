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
  cancelBookingAsAdmin,
  markNoShow,
} from '@/lib/queries/bookings';
import { createClosure, deleteClosure } from '@/lib/queries/closures';
import { saveLimits } from '@/lib/queries/settings';
import { setUnitBlocked } from '@/lib/queries/units';
import { isValidSlotIndex } from '@/lib/schedule';
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

export async function adminCancelBookingAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const bookingId = Number(formData.get('bookingId'));
  if (!Number.isInteger(bookingId)) return { error: 'Unknown booking.' };

  const result = await cancelBookingAsAdmin(bookingId, text(formData, 'reason'));
  if (!result.ok) return { error: result.message };

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/book');
  return { message: 'Booking cancelled.' };
}

export async function adminMarkNoShowAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const bookingId = Number(formData.get('bookingId'));
  if (!Number.isInteger(bookingId)) return { error: 'Unknown booking.' };

  const result = await markNoShow(bookingId);
  if (!result.ok) return { error: result.message };

  revalidatePath('/admin');
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
  return { message: 'Settings saved.' };
}
