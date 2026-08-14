/**
 * Sending web push notifications.
 *
 * Push is free and instant but never guaranteed: a subscription dies when the
 * browser is cleared, the app is uninstalled or the permission is revoked, and
 * the push service only tells us on the next send. That is why every push has
 * a text message beside it — see lib/notify/index.ts.
 */

import webpush from 'web-push';

import { forgetSubscriptions, touchSubscriptions } from '@/lib/queries/push';
import type { PushSubscriptionRow } from '@/lib/db';
import type { PushPayload } from './messages';

export type { PushPayload };

/**
 * The half of the key pair that belongs in the browser.
 *
 * Read on the server and passed down as a prop rather than exposed as a
 * NEXT_PUBLIC_ variable: those are substituted into the bundle at build time,
 * and a host that keeps its environment encrypted until runtime — Vercel's
 * sensitive variables, for one — leaves the placeholder in place, so the
 * button silently reports that the browser cannot do push.
 */
export function publicVapidKey(): string {
  return process.env.VAPID_PUBLIC_KEY?.trim() ?? '';
}

export function isPushConfigured(): boolean {
  return Boolean(publicVapidKey() && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;

function configure(): boolean {
  if (!isPushConfigured()) return false;
  if (configured) return true;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@brookfield.local',
    publicVapidKey(),
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

/**
 * A subscription the push service has disowned.
 *
 * 404 and 410 are the two ways it says "this browser is gone". Anything else —
 * a timeout, a 500, a rate limit — is the service having a bad day, and
 * deleting on those would quietly unsubscribe people who did nothing wrong.
 */
function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;
  return status === 404 || status === 410;
}

export type PushResult = { sent: number; dropped: number };

/**
 * Sends one payload to many browsers, pruning the ones that have gone away.
 *
 * Never throws: a push problem must not surface as a failed booking.
 */
export async function sendPush(
  targets: readonly PushSubscriptionRow[],
  payload: PushPayload,
): Promise<PushResult> {
  if (targets.length === 0) return { sent: 0, dropped: 0 };
  if (!configure()) return { sent: 0, dropped: 0 };

  const body = JSON.stringify(payload);
  const dead: number[] = [];
  const alive: number[] = [];

  const results = await Promise.allSettled(
    targets.map((target) =>
      webpush.sendNotification(
        {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        },
        body,
        { TTL: 60 * 60 * 12 },
      ),
    ),
  );

  results.forEach((result, index) => {
    const target = targets[index];
    if (result.status === 'fulfilled') {
      alive.push(target.id);
      return;
    }
    if (isGone(result.reason)) {
      dead.push(target.id);
      return;
    }
    console.warn('Push failed for one browser', result.reason);
  });

  try {
    if (dead.length > 0) await forgetSubscriptions(dead);
    if (alive.length > 0) await touchSubscriptions(alive);
  } catch (error) {
    console.error('Could not tidy push subscriptions', error);
  }

  return { sent: alive.length, dropped: dead.length };
}

/** Sends without ever throwing into the caller. */
export async function sendPushQuietly(
  targets: readonly PushSubscriptionRow[],
  payload: PushPayload,
): Promise<void> {
  try {
    await sendPush(targets, payload);
  } catch (error) {
    console.error('Push failed', error);
  }
}
