'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { saveLimitsAction, type AdminFormState } from '@/app/admin/actions';
import { Field, Notice, PrimaryButton, inputClass } from '@/components/ui';
import type { BookingLimits } from '@/lib/rules';

export function LimitsForm({ limits }: { limits: BookingLimits }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    saveLimitsAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}

      <label className="flex items-start gap-3 rounded-xl border border-edge p-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={limits.enabled}
          className="mt-0.5 size-5 accent-[#1f7a4d]"
        />
        <span>
          <span className="block text-sm font-medium">
            Enforce per-household limits
          </span>
          <span className="block text-xs text-muted">
            Turn off to let residents book freely.
          </span>
        </span>
      </label>

      <Field label="Bookings per household per day">
        <input
          type="number"
          name="maxPerDay"
          min={0}
          max={10}
          defaultValue={limits.maxPerDay}
          className={inputClass}
        />
      </Field>

      <Field label="Bookings per household per week" hint="Monday to Sunday.">
        <input
          type="number"
          name="maxPerWeek"
          min={0}
          max={50}
          defaultValue={limits.maxPerWeek}
          className={inputClass}
        />
      </Field>

      <Field label="How many days ahead residents can book">
        <input
          type="number"
          name="advanceDays"
          min={1}
          max={60}
          defaultValue={limits.advanceDays}
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
      {pending ? 'Saving…' : 'Save settings'}
    </PrimaryButton>
  );
}
