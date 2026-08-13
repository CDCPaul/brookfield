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
        <Field label="From">
          <input
            type="date"
            name="dateFrom"
            required
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="To" hint="Leave as-is for a single day.">
          <input
            type="date"
            name="dateTo"
            defaultValue={today}
            min={dateFrom}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Time slot">
        <select name="slotIndex" defaultValue="all" className={inputClass}>
          <option value="all">All slots (whole morning)</option>
          {SLOTS.map((slot) => (
            <option key={slot.index} value={slot.index}>
              {slot.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Court" hint="Pickleball days only; tennis has one court.">
        <select name="courtNo" defaultValue="all" className={inputClass}>
          <option value="all">All courts</option>
          {[1, 2, 3, 4].map((court) => (
            <option key={court} value={court}>
              Court {court}
            </option>
          ))}
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
