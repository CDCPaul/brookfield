'use client';

import { useState, useTransition } from 'react';

import {
  adminCancelBookingAction,
  adminMarkNoShowAction,
  markPaidAction,
} from '@/app/admin/actions';
import { inputClass } from '@/components/ui';

export function BookingActions({
  bookingId,
  showMarkPaid = false,
}: {
  bookingId: number;
  showMarkPaid?: boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'cancel'>('idle');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: typeof adminCancelBookingAction) {
    const formData = new FormData();
    formData.set('bookingId', String(bookingId));
    formData.set('reason', reason);

    startTransition(async () => {
      const result = await action({}, formData);
      setError(result.error ?? null);
      if (!result.error) setMode('idle');
    });
  }

  if (mode === 'cancel') {
    return (
      <div className="mt-2 space-y-2">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason (optional)"
          className={`${inputClass} py-2 text-sm`}
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="flex-1 rounded-lg border border-edge px-3 py-2 text-xs font-medium active:bg-background"
          >
            Back
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(adminCancelBookingAction)}
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white active:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Cancelling…' : 'Confirm cancel'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {showMarkPaid ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(markPaidAction)}
            className="flex-1 rounded-lg bg-court px-3 py-2 text-xs font-semibold text-white active:bg-court-dark disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Mark paid'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMode('cancel')}
          className="flex-1 rounded-lg border border-edge px-3 py-2 text-xs font-medium active:bg-background"
        >
          Cancel booking
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(adminMarkNoShowAction)}
          className="flex-1 rounded-lg border border-edge px-3 py-2 text-xs font-medium active:bg-background disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'No-show'}
        </button>
      </div>
    </div>
  );
}
