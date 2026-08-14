'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';

import {
  createClosureAction,
  deleteClosureAction,
  type AdminFormState,
} from '@/app/admin/actions';
import { Field, Notice, PrimaryButton, inputClass } from '@/components/ui';
import { SLOTS } from '@/lib/schedule';
import { formatClock } from '@/lib/time';

export function ClosureForm({ today }: { today: string }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    createClosureAction,
    {},
  );
  const [dateFrom, setDateFrom] = useState(today);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label="First day">
          <input
            type="date"
            name="dateFrom"
            required
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Last day" hint="Leave as-is for a single day.">
          <input
            type="date"
            name="dateTo"
            defaultValue={today}
            min={dateFrom}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Closed from">
          <select name="slotFrom" defaultValue="all" className={inputClass}>
            <option value="all">Opening</option>
            {SLOTS.map((slot) => (
              <option key={slot.index} value={slot.index}>
                {formatClock(slot.startMinutes)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Until" hint="Inclusive — that hour is closed too.">
          <select name="slotTo" defaultValue="all" className={inputClass}>
            <option value="all">Closing</option>
            {SLOTS.map((slot) => (
              <option key={slot.index} value={slot.index}>
                {formatClock(slot.endMinutes)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Which surface"
        hint="Closing the tennis court also closes the pickleball courts on it."
      >
        <select name="venue" defaultValue="all" className={inputClass}>
          <option value="all">Both surfaces</option>
          <option value="tennis-court">Tennis / pickleball court</option>
          <option value="basketball-court">Basketball court</option>
        </select>
      </Field>

      <Field label="Reason" hint="Residents will see this text.">
        <input
          name="reason"
          required
          placeholder="Resurfacing works"
          className={inputClass}
        />
      </Field>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? 'Adding…' : 'Add closure'}
    </PrimaryButton>
  );
}

export function DeleteClosureButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const formData = new FormData();
          formData.set('id', String(id));
          startTransition(async () => {
            const result = await deleteClosureAction({}, formData);
            setError(result.error ?? null);
          });
        }}
        className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium active:bg-background disabled:opacity-50"
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </>
  );
}
