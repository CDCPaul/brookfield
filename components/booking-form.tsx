'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { createBookingAction, type BookingFormState } from '@/app/actions';
import { Field, Notice, PrimaryButton, inputClass } from '@/components/ui';
import { STORED_UNIT_FIELDS, loadUnit, mergeUnit } from '@/lib/stored-unit';

/**
 * The fields are uncontrolled: the remembered details are written straight into
 * the DOM after mount. Rendering them as React state would either mismatch
 * during hydration (the server cannot see localStorage) or need a second render.
 */
export function BookingForm({
  date,
  slotIndex,
  courtNo,
}: {
  date: string;
  slotIndex: number;
  courtNo: number;
}) {
  const [state, formAction] = useActionState<BookingFormState, FormData>(
    createBookingAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const stored = loadUnit();
    const form = formRef.current;
    if (!stored || !form) return;

    for (const field of STORED_UNIT_FIELDS) {
      const input = form.elements.namedItem(field);
      if (input instanceof HTMLInputElement && input.value === '') {
        input.value = stored[field];
      }
    }
  }, []);

  function remember(form: HTMLFormElement) {
    const data = new FormData(form);
    mergeUnit({
      name: String(data.get('name') ?? ''),
      phase: String(data.get('phase') ?? ''),
      block: String(data.get('block') ?? ''),
      lot: String(data.get('lot') ?? ''),
      phone: String(data.get('phone') ?? ''),
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => remember(event.currentTarget)}
      className="space-y-4"
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="slot" value={slotIndex} />
      <input type="hidden" name="court" value={courtNo} />

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field label="Full name">
        <input name="name" required autoComplete="name" className={inputClass} />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Phase">
          <input
            name="phase"
            required
            autoCapitalize="characters"
            className={inputClass}
          />
        </Field>
        <Field label="Block">
          <input
            name="block"
            required
            autoCapitalize="characters"
            className={inputClass}
          />
        </Field>
        <Field label="Lot">
          <input
            name="lot"
            required
            autoCapitalize="characters"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Mobile number" hint="Used only if the courts have to close.">
        <input
          name="phone"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0917 123 4567"
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
      {pending ? 'Booking…' : 'Confirm booking'}
    </PrimaryButton>
  );
}
