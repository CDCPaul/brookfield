'use client';

/**
 * Turning browser notifications on for this device.
 *
 * Notifications belong to a browser, not an account, so this is the only place
 * that can set them up — and it has to be honest about the three ways it can
 * fail: the browser cannot do push at all, the permission was refused, or the
 * device is an iPhone that has not added the app to its home screen yet.
 */

import { useCallback, useEffect, useState } from 'react';

import { subscribeToPush, unsubscribeFromPush } from '@/app/push-actions';
import { Notice, SecondaryButton } from '@/components/ui';

/** The VAPID public key travels as base64url and has to arrive as bytes. */
function decodeKey(base64: string): ArrayBuffer {
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  );
  const binary = window.atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

type State =
  | 'loading'
  | 'unsupported'
  | 'needs-install'
  | 'off'
  | 'on'
  | 'blocked';

type Status = { state: State; isIOS: boolean };

/**
 * Works out where this browser stands, registering the worker on the way.
 *
 * Kept outside the component so the effect that calls it does nothing but
 * await the answer — everything here needs the DOM, and none of it can run
 * during a render.
 */
async function detect(key: string | undefined): Promise<Status> {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // iOS only exposes PushManager to an installed app, so an iPhone failing
  // this check has not been added to the home screen rather than being
  // incapable of notifications.
  if (!key || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { state: isIOS ? 'needs-install' : 'unsupported', isIOS };
  }

  if (Notification.permission === 'denied') return { state: 'blocked', isIOS };

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    const subscription = await registration.pushManager.getSubscription();
    return { state: subscription ? 'on' : 'off', isIOS };
  } catch {
    return { state: 'unsupported', isIOS };
  }
}

export function PushToggle({
  audience,
  phone = '',
  label,
  hint,
}: {
  audience: 'admin' | 'booker';
  /** The booker's number; ignored for admins, who are a session instead. */
  phone?: string;
  label: string;
  hint: string;
}) {
  const [{ state, isIOS }, setStatus] = useState<Status>({
    state: 'loading',
    isIOS: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    detect(key).then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const moveTo = useCallback((next: State) => {
    setStatus((current) => ({ ...current, state: next }));
  }, []);

  const turnOn = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        moveTo(permission === 'denied' ? 'blocked' : 'off');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(key!),
      });

      const result = await subscribeToPush(
        JSON.parse(JSON.stringify(subscription)),
        audience,
        phone,
      );

      if (!result.ok) {
        // Leaving a browser subscribed that the server does not know about
        // would show "on" while nothing ever arrives.
        await subscription.unsubscribe();
        setError(result.error ?? 'Could not turn notifications on.');
        moveTo('off');
        return;
      }

      moveTo('on');
    } catch (cause) {
      console.error(cause);
      setError('Could not turn notifications on.');
      moveTo('off');
    } finally {
      setBusy(false);
    }
  }, [audience, key, moveTo, phone]);

  const turnOff = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      moveTo('off');
    } catch (cause) {
      console.error(cause);
      setError('Could not turn notifications off.');
    } finally {
      setBusy(false);
    }
  }, [moveTo]);

  if (state === 'loading') return null;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        {state === 'on' || state === 'off' ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              state === 'on'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'bg-background text-muted'
            }`}
          >
            {state === 'on' ? 'On' : 'Off'}
          </span>
        ) : null}
      </div>

      {state === 'off' ? (
        <SecondaryButton onClick={turnOn} disabled={busy}>
          {busy ? 'Turning on…' : 'Turn on notifications'}
        </SecondaryButton>
      ) : null}

      {state === 'on' ? (
        <SecondaryButton onClick={turnOff} disabled={busy}>
          {busy ? 'Turning off…' : 'Turn off on this device'}
        </SecondaryButton>
      ) : null}

      {state === 'needs-install' ? (
        <Notice>
          On iPhone, notifications only work once the app is on your home
          screen. Tap <strong>Share</strong> at the bottom of Safari, choose{' '}
          <strong>Add to Home Screen</strong>, then open it from there and come
          back to this page.
        </Notice>
      ) : null}

      {state === 'blocked' ? (
        <Notice tone="error">
          Notifications are blocked for this site.{' '}
          {isIOS
            ? 'Allow them in Settings › Notifications, then reload.'
            : 'Allow them in your browser settings for this site, then reload.'}
        </Notice>
      ) : null}

      {state === 'unsupported' ? (
        <Notice>
          This browser cannot show notifications. You will still get a text
          message.
        </Notice>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
