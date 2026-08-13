'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { adminLoginAction, type AdminFormState } from '@/app/admin/actions';
import { Field, Notice, PrimaryButton, inputClass } from '@/components/ui';

export function AdminLoginForm() {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    adminLoginAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field label="Password">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
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
      {pending ? 'Signing in…' : 'Sign in'}
    </PrimaryButton>
  );
}
