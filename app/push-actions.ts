'use server';

/**
 * Recording which browsers want notifications.
 *
 * Kept apart from app/actions.ts because both the resident screens and the
 * association console call these, and neither should have to reach into the
 * other's actions file.
 */

import { headers } from 'next/headers';

import {
  isBrowserSubscription,
  removeSubscription,
  saveSubscription,
  type Audience,
} from '@/lib/queries/push';
import { isAdmin } from '@/lib/auth';
import { isValidPhilippineMobile } from '@/lib/unit-key';

export type PushActionState = { ok: boolean; error?: string };

/**
 * Signs a browser up.
 *
 * An admin subscription hears about every request in the village, so it is
 * only granted to a browser that is actually signed in to the console —
 * otherwise anyone who guessed the action name could subscribe to the lot.
 */
export async function subscribeToPush(
  subscription: unknown,
  audience: Audience,
  phone: string,
): Promise<PushActionState> {
  if (!isBrowserSubscription(subscription)) {
    return { ok: false, error: 'That subscription did not look right.' };
  }

  if (audience === 'admin') {
    if (!(await isAdmin())) {
      return { ok: false, error: 'Sign in to the console first.' };
    }
  } else if (!isValidPhilippineMobile(phone)) {
    return {
      ok: false,
      error: 'Book once first so we know which number to notify.',
    };
  }

  try {
    const agent = (await headers()).get('user-agent');
    await saveSubscription(
      subscription,
      audience,
      audience === 'admin' ? null : phone,
      agent,
    );
    return { ok: true };
  } catch (error) {
    console.error('Could not save a push subscription', error);
    return { ok: false, error: 'Could not turn notifications on.' };
  }
}

/** Forgets a browser. Safe to call for one that was never recorded. */
export async function unsubscribeFromPush(
  endpoint: unknown,
): Promise<PushActionState> {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return { ok: false, error: 'That subscription did not look right.' };
  }

  try {
    await removeSubscription(endpoint);
    return { ok: true };
  } catch (error) {
    console.error('Could not remove a push subscription', error);
    return { ok: false, error: 'Could not turn notifications off.' };
  }
}
