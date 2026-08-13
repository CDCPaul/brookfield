'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { submitPaymentAction, type PaymentState } from '@/app/actions';
import { Field, Notice, PrimaryButton, inputClass } from '@/components/ui';

export function PaymentReferenceForm({
  bookingId,
  owner,
  existing,
}: {
  bookingId: number;
  owner: string;
  existing: string | null;
}) {
  const [state, formAction] = useActionState<PaymentState, FormData>(
    submitPaymentAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="owner" value={owner} />

      <Field label="GCash reference number">
        <input
          name="reference"
          required
          inputMode="numeric"
          defaultValue={existing ?? ''}
          placeholder="e.g. 1234567890123"
          className={inputClass}
        />
      </Field>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.submitted ? (
        <Notice tone="success">
          Thank you. The association will check your payment and confirm the
          booking.
        </Notice>
      ) : null}

      <SubmitButton existing={Boolean(existing)} />
    </form>
  );
}

function SubmitButton({ existing }: { existing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? 'Sending…' : existing ? 'Update reference' : 'I have paid'}
    </PrimaryButton>
  );
}
