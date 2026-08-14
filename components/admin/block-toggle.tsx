'use client';

import { useState, useTransition } from 'react';

import { setBookerBlockedAction } from '@/app/admin/actions';
import { inputClass } from '@/components/ui';

export function BlockToggle({
  phone,
  isBlocked,
}: {
  phone: string;
  isBlocked: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(blocked: boolean) {
    const formData = new FormData();
    formData.set('phone', phone);
    formData.set('blocked', String(blocked));
    formData.set('reason', reason);

    startTransition(async () => {
      const result = await setBookerBlockedAction({}, formData);
      setError(result.error ?? null);
      if (!result.error) {
        setAsking(false);
        setReason('');
      }
    });
  }

  if (isBlocked) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => submit(false)}
        className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium active:bg-background disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Unblock'}
      </button>
    );
  }

  if (asking) {
    return (
      <div className="w-full space-y-2">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (kept internal)"
          className={`${inputClass} py-2 text-sm`}
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="flex-1 rounded-lg border border-edge px-3 py-2 text-xs font-medium active:bg-background"
          >
            Back
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(true)}
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white active:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Blocking…' : 'Block'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium active:bg-background"
    >
      Block
    </button>
  );
}
