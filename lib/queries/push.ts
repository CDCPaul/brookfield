import { and, eq, inArray, sql } from 'drizzle-orm';

import { db, pushSubscriptions, type PushSubscriptionRow } from '@/lib/db';
import { normalizePhone } from '@/lib/unit-key';

/** What the browser hands back from pushManager.subscribe(). */
export type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type Audience = 'admin' | 'booker';

/** Long enough to tell an iPhone from a laptop, short enough not to be a log. */
const USER_AGENT_LIMIT = 120;

export function isBrowserSubscription(
  value: unknown,
): value is BrowserSubscription {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const keys = candidate.keys as Record<string, unknown> | undefined;
  return (
    typeof candidate.endpoint === 'string' &&
    candidate.endpoint.startsWith('https://') &&
    typeof keys?.p256dh === 'string' &&
    typeof keys?.auth === 'string'
  );
}

/**
 * Records a browser's subscription, or refreshes the one it already had.
 *
 * Browsers re-issue the same endpoint when a page re-subscribes, so this is
 * called far more often than someone actually opts in. Conflicting on the
 * endpoint means a resident who books from the same phone under two numbers
 * ends up with one subscription pointing at the number they used last, which
 * is the one they will be looking at.
 */
export async function saveSubscription(
  subscription: BrowserSubscription,
  audience: Audience,
  phone: string | null,
  userAgent: string | null,
): Promise<void> {
  const normalized = phone ? normalizePhone(phone) || null : null;
  const shortAgent = userAgent?.slice(0, USER_AGENT_LIMIT) ?? null;

  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      audience,
      phone: normalized,
      userAgent: shortAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        audience,
        phone: normalized,
        userAgent: shortAgent,
        lastSeenAt: sql`now()`,
      },
    });
}

/** Called when someone turns notifications off on their own device. */
export async function removeSubscription(endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Called when the push service reports a subscription is gone for good. */
export async function forgetSubscriptions(ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, [...ids]));
}

/** Keeps a record of which browsers are still reachable. */
export async function touchSubscriptions(ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(pushSubscriptions)
    .set({ lastSeenAt: sql`now()` })
    .where(inArray(pushSubscriptions.id, [...ids]));
}

/** Every browser signed in to the association console. */
export async function getAdminSubscriptions(): Promise<PushSubscriptionRow[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.audience, 'admin'));
}

/**
 * The browsers belonging to one booker.
 *
 * Keyed on the mobile number, the same identity the rest of the app uses for
 * someone with no account.
 */
export async function getBookerSubscriptions(
  phone: string,
): Promise<PushSubscriptionRow[]> {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  return db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.audience, 'booker'),
        eq(pushSubscriptions.phone, normalized),
      ),
    );
}

/** How many devices are listening, for the settings screen. */
export async function countSubscriptions(): Promise<{
  admin: number;
  booker: number;
}> {
  const rows = await db
    .select({
      audience: pushSubscriptions.audience,
      count: sql<number>`count(*)::int`,
    })
    .from(pushSubscriptions)
    .groupBy(pushSubscriptions.audience);

  const counts = { admin: 0, booker: 0 };
  for (const row of rows) {
    if (row.audience === 'admin') counts.admin = row.count;
    if (row.audience === 'booker') counts.booker = row.count;
  }
  return counts;
}
