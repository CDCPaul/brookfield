'use client';

import { useState, useTransition } from 'react';

import {
  approveBookingAction,
  rejectBookingAction,
} from '@/app/admin/actions';
import { inputClass } from '@/components/ui';
import { formatPeso } from '@/lib/schedule';

export function RequestActions({
  bookingId,
  amount,
  alreadyPaid,
}: {
  bookingId: number;
  amount: number;
  alreadyPaid: boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'reject'>('idle');
  const [note, setNote] = useState('');
  const [markPaid, setMarkPaid] = useState(amount > 0 && !alreadyPaid);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    const formData = new FormData();
    formData.set('bookingId', String(bookingId));
    formData.set('markPaid', String(markPaid));

    startTransition(async () => {
      const result = await approveBookingAction({}, formData);
      setError(result.error ?? null);
    });
  }

  function reject() {
    const formData = new FormData();
    formData.set('bookingId', String(bookingId));
    formData.set('note', note);

    startTransition(async () => {
      const result = await rejectBookingAction({}, formData);
      setError(result.error ?? null);
      if (!result.error) setMode('idle');
    });
  }

  if (mode === 'reject') {
    return (
      <div className="mt-3 space-y-2">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Reason (shown to the booker)"
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
            onClick={reject}
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white active:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Declining…' : 'Confirm decline'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {amount > 0 && !alreadyPaid ? (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={markPaid}
            onChange={(event) => setMarkPaid(event.target.checked)}
            className="size-4 accent-[#4a7c2b]"
          />
          Payment of {formatPeso(amount)} received
        </label>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('reject')}
          className="flex-1 rounded-lg border border-edge px-3 py-2 text-xs font-medium active:bg-background"
        >
          Decline
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={approve}
          className="flex-1 rounded-lg bg-court px-3 py-2 text-xs font-semibold text-white active:bg-court-dark disabled:opacity-50"
        >
          {pending ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </div>
  );
}
