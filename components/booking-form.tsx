'use client';

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useFormStatus } from 'react-dom';

import { createBookingAction, type BookingFormState } from '@/app/actions';
import { Field, Notice, PrimaryButton, inputClass } from '@/components/ui';
import type { BookerType } from '@/lib/owner';
import {
  BOOKER_FIELDS,
  loadBooker,
  mergeBooker,
} from '@/lib/stored-booker';

/**
 * Two steps: who is booking, then their details.
 *
 * The fields are uncontrolled — the remembered details are written straight
 * into the DOM after mount, because rendering them as React state would
 * mismatch during hydration (the server cannot see localStorage).
 */
export function BookingForm({
  date,
  slotIndex,
  courtNo,
  price,
  freeUntilHour,
}: {
  date: string;
  slotIndex: number;
  courtNo: number;
  price: number;
  freeUntilHour: number;
}) {
  const [bookerType, setBookerType] = useState<BookerType | null>(null);
  const remembered = useRememberedBookerType();

  if (bookerType === null) {
    return (
      <BookerTypeStep
        onChoose={setBookerType}
        suggested={remembered}
        // Guests may not take the free morning; say so before they tap.
        guestBlocked={price === 0}
        freeUntilHour={freeUntilHour}
      />
    );
  }

  return (
    <DetailsStep
      date={date}
      slotIndex={slotIndex}
      courtNo={courtNo}
      bookerType={bookerType}
      onBack={() => setBookerType(null)}
    />
  );
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${suffix}`;
}

// localStorage is an external store, so it is read through the API meant for
// one rather than copied into state from an effect.
const NO_OP_SUBSCRIBE = () => () => {};

function useRememberedBookerType(): BookerType | null {
  return useSyncExternalStore(
    NO_OP_SUBSCRIBE,
    () => loadBooker()?.bookerType ?? null,
    () => null,
  );
}

function BookerTypeStep({
  onChoose,
  suggested,
  guestBlocked,
  freeUntilHour,
}: {
  onChoose: (type: BookerType) => void;
  suggested: BookerType | null;
  guestBlocked: boolean;
  freeUntilHour: number;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Who is booking?</h2>

      <button
        type="button"
        onClick={() => onChoose('resident')}
        className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface p-4 text-left active:bg-background"
      >
        <span aria-hidden="true" className="text-2xl">
          🏡
        </span>
        <span className="flex-1">
          <span className="block text-base font-semibold">
            Brookfield resident
          </span>
          <span className="block text-sm text-muted">
            I live in the village
          </span>
        </span>
        {suggested === 'resident' ? (
          <span className="rounded-full bg-court-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-court-dark dark:bg-court/20 dark:text-court-soft">
            Last used
          </span>
        ) : null}
      </button>

      <button
        type="button"
        disabled={guestBlocked}
        onClick={() => onChoose('guest')}
        className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface p-4 text-left active:bg-background disabled:opacity-50"
      >
        <span aria-hidden="true" className="text-2xl">
          👋
        </span>
        <span className="flex-1">
          <span className="block text-base font-semibold">Guest</span>
          <span className="block text-sm text-muted">
            {guestBlocked
              ? `Free morning hours are for residents. Guests can book from ${formatHour(freeUntilHour)}.`
              : 'I am visiting from outside'}
          </span>
        </span>
        {suggested === 'guest' && !guestBlocked ? (
          <span className="rounded-full bg-court-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-court-dark dark:bg-court/20 dark:text-court-soft">
            Last used
          </span>
        ) : null}
      </button>
    </div>
  );
}

function DetailsStep({
  date,
  slotIndex,
  courtNo,
  bookerType,
  onBack,
}: {
  date: string;
  slotIndex: number;
  courtNo: number;
  bookerType: BookerType;
  onBack: () => void;
}) {
  const [state, formAction] = useActionState<BookingFormState, FormData>(
    createBookingAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const isResident = bookerType === 'resident';

  useEffect(() => {
    const stored = loadBooker();
    const form = formRef.current;
    if (!stored || !form) return;

    for (const field of BOOKER_FIELDS) {
      const input = form.elements.namedItem(field);
      if (input instanceof HTMLInputElement && input.value === '') {
        input.value = stored[field];
      }
    }
  }, []);

  function remember(form: HTMLFormElement) {
    const data = new FormData(form);
    mergeBooker({
      bookerType,
      name: String(data.get('name') ?? ''),
      phone: String(data.get('phone') ?? ''),
      ...(isResident
        ? {
            phase: String(data.get('phase') ?? ''),
            block: String(data.get('block') ?? ''),
            lot: String(data.get('lot') ?? ''),
          }
        : {}),
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
      <input type="hidden" name="bookerType" value={bookerType} />

      <div className="flex items-center justify-between rounded-xl border border-edge bg-surface px-3.5 py-2.5">
        <span className="text-sm">
          <span aria-hidden="true">{isResident ? '🏡 ' : '👋 '}</span>
          Booking as{' '}
          <strong>{isResident ? 'a resident' : 'a guest'}</strong>
        </span>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-court underline"
        >
          Change
        </button>
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field label="Full name">
        <input name="name" required autoComplete="name" className={inputClass} />
      </Field>

      {isResident ? (
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
      ) : null}

      <Field
        label="Mobile number"
        hint={
          isResident
            ? 'Used only if the courts have to close.'
            : 'This is how you will find and cancel your booking.'
        }
      >
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
