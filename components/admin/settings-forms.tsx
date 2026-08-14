'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  saveCourtsAction,
  saveHoursAction,
  saveLimitsAction,
  saveNotifyAction,
  savePaymentAction,
  savePricingAction,
  type AdminFormState,
} from '@/app/admin/actions';
import type { CourtConfig } from '@/lib/courts';
import type { NotifyConfig } from '@/lib/payment';
import { Field, Notice, PrimaryButton, inputClass } from '@/components/ui';
import type { PaymentConfig } from '@/lib/payment';
import type { BookingLimits } from '@/lib/rules';
import { LAST_HOUR, OPEN_HOUR, type Pricing, type ScheduleConfig } from '@/lib/schedule';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </PrimaryButton>
  );
}

function Feedback({ state }: { state: AdminFormState }) {
  if (state.error) return <Notice tone="error">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

const HOURS = Array.from(
  { length: LAST_HOUR - OPEN_HOUR + 1 },
  (_, index) => OPEN_HOUR + index,
);

function hourLabel(hour: number): string {
  if (hour === 24) return '12:00 AM (midnight)';
  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${suffix}`;
}

export function HoursForm({ schedule }: { schedule: ScheduleConfig }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    saveHoursAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Feedback state={state} />

      <p className="text-sm text-muted">
        The courts open at {hourLabel(OPEN_HOUR)} every day.
      </p>

      <Field label="Free hours end at" hint="Residents only before this time.">
        <select
          name="freeUntilHour"
          defaultValue={schedule.freeUntilHour}
          className={inputClass}
        >
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {hourLabel(hour)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Daytime rate ends at" hint="Evening pricing starts here.">
        <select
          name="dayUntilHour"
          defaultValue={schedule.dayUntilHour}
          className={inputClass}
        >
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {hourLabel(hour)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Courts close at">
        <select
          name="closeHour"
          defaultValue={schedule.closeHour}
          className={inputClass}
        >
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {hourLabel(hour)}
            </option>
          ))}
        </select>
      </Field>

      <SubmitButton label="Save hours" />
    </form>
  );
}

export function PricingForm({ pricing }: { pricing: Pricing }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    savePricingAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Feedback state={state} />

      <p className="text-sm font-medium">Daytime, per hour</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tennis (₱)">
          <input
            type="number"
            name="dayTennis"
            min={0}
            defaultValue={pricing.day.tennis}
            className={inputClass}
          />
        </Field>
        <Field label="Pickleball (₱)">
          <input
            type="number"
            name="dayPickleball"
            min={0}
            defaultValue={pricing.day.pickleball}
            className={inputClass}
          />
        </Field>
      </div>

      <p className="text-sm font-medium">Evening, per hour</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tennis (₱)">
          <input
            type="number"
            name="nightTennis"
            min={0}
            defaultValue={pricing.night.tennis}
            className={inputClass}
          />
        </Field>
        <Field label="Pickleball (₱)">
          <input
            type="number"
            name="nightPickleball"
            min={0}
            defaultValue={pricing.night.pickleball}
            className={inputClass}
          />
        </Field>
      </div>

      <SubmitButton label="Save prices" />
    </form>
  );
}

export function PaymentForm({ payment }: { payment: PaymentConfig }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    savePaymentAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Feedback state={state} />

      <p className="text-sm text-muted">
        Bookers send money to this GCash account and type in the reference
        number. Match it against your GCash history before approving. Leave the
        number blank to collect payment in person instead.
      </p>

      <Field label="GCash number" hint="11 digits, e.g. 09171234567.">
        <input
          name="gcashNumber"
          inputMode="numeric"
          defaultValue={payment.gcashNumber}
          placeholder="09171234567"
          className={inputClass}
        />
      </Field>

      <Field label="Account name">
        <input
          name="gcashName"
          defaultValue={payment.gcashName}
          placeholder="Brookfield HOA"
          className={inputClass}
        />
      </Field>

      <Field
        label="Extra instructions"
        hint="Shown under the payment details. Optional."
      >
        <textarea
          name="notes"
          rows={3}
          defaultValue={payment.notes}
          placeholder="You may also pay in cash at the association office."
          className={inputClass}
        />
      </Field>

      <SubmitButton label="Save payment details" />
    </form>
  );
}

export function NotifyForm({
  notify,
  smsReady,
}: {
  notify: NotifyConfig;
  smsReady: boolean;
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    saveNotifyAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Feedback state={state} />

      {smsReady ? null : (
        <Notice tone="error">
          Texting is switched off because no Semaphore API key is set on the
          server. These settings are saved but nothing will send.
        </Notice>
      )}

      <Field
        label="Association numbers"
        hint="One per line. Each gets a text when a request comes in."
      >
        <textarea
          name="adminPhones"
          rows={3}
          defaultValue={notify.adminPhones.join('\n')}
          placeholder="09171234567"
          className={inputClass}
        />
      </Field>

      <label className="flex items-start gap-3 rounded-xl border border-edge p-3">
        <input
          type="checkbox"
          name="textAdminOnRequest"
          defaultChecked={notify.textAdminOnRequest}
          className="mt-0.5 size-5 accent-[#4a7c2b]"
        />
        <span className="text-sm font-medium">
          Text us when a court is requested
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-edge p-3">
        <input
          type="checkbox"
          name="textBookerOnDecision"
          defaultChecked={notify.textBookerOnDecision}
          className="mt-0.5 size-5 accent-[#4a7c2b]"
        />
        <span className="text-sm font-medium">
          Text the booker when we approve or decline
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-edge p-3">
        <input
          type="checkbox"
          name="textFreeBookings"
          defaultChecked={notify.textFreeBookings}
          className="mt-0.5 size-5 accent-[#4a7c2b]"
        />
        <span>
          <span className="block text-sm font-medium">
            Notify about free morning bookings too
          </span>
          <span className="block text-xs text-muted">
            Off by default — there is no payment to chase, and every text costs
            a credit.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-edge p-3">
        <input
          type="checkbox"
          name="pushEnabled"
          defaultChecked={notify.pushEnabled}
          className="mt-0.5 size-5 accent-[#4a7c2b]"
        />
        <span>
          <span className="block text-sm font-medium">
            Send a browser notification as well
          </span>
          <span className="block text-xs text-muted">
            Free and instant, but only to phones that turned it on. It is sent
            alongside the text, never instead of it.
          </span>
        </span>
      </label>

      <SubmitButton label="Save notifications" />
    </form>
  );
}

export function CourtsForm({ courts }: { courts: CourtConfig }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    saveCourtsAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Feedback state={state} />

      <label className="flex items-start gap-3 rounded-xl border border-edge p-3">
        <input
          type="checkbox"
          name="paidTennisEnabled"
          defaultChecked={courts.paidTennisEnabled}
          className="mt-0.5 size-5 accent-[#4a7c2b]"
        />
        <span>
          <span className="block text-sm font-medium">
            Take tennis bookings in paid hours
          </span>
          <span className="block text-xs text-muted">
            Off by default — set a tennis rate above before turning this on.
            The free morning is unaffected.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-edge p-3">
        <input
          type="checkbox"
          name="basketballEnabled"
          defaultChecked={courts.basketballEnabled}
          className="mt-0.5 size-5 accent-[#4a7c2b]"
        />
        <span>
          <span className="block text-sm font-medium">
            Take basketball bookings
          </span>
          <span className="block text-xs text-muted">
            Half court or full court, charged at the pickleball rate per half.
          </span>
        </span>
      </label>

      <SubmitButton label="Save courts" />
    </form>
  );
}

export function LimitsForm({ limits }: { limits: BookingLimits }) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(
    saveLimitsAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Feedback state={state} />

      <label className="flex items-start gap-3 rounded-xl border border-edge p-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={limits.enabled}
          className="mt-0.5 size-5 accent-[#4a7c2b]"
        />
        <span>
          <span className="block text-sm font-medium">
            Enforce free-hour limits
          </span>
          <span className="block text-xs text-muted">
            Paid hours are never limited.
          </span>
        </span>
      </label>

      <Field label="Free bookings per household per day">
        <input
          type="number"
          name="maxPerDay"
          min={0}
          max={10}
          defaultValue={limits.maxPerDay}
          className={inputClass}
        />
      </Field>

      <Field
        label="Free bookings per household per week"
        hint="Monday to Sunday."
      >
        <input
          type="number"
          name="maxPerWeek"
          min={0}
          max={50}
          defaultValue={limits.maxPerWeek}
          className={inputClass}
        />
      </Field>

      <Field label="How many days ahead people can book">
        <input
          type="number"
          name="advanceDays"
          min={1}
          max={60}
          defaultValue={limits.advanceDays}
          className={inputClass}
        />
      </Field>

      <SubmitButton label="Save limits" />
    </form>
  );
}
