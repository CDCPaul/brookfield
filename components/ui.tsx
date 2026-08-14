import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-edge bg-surface p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

const BUTTON_BASE =
  'inline-flex w-full items-center justify-center rounded-xl px-4 py-3.5 text-base font-semibold transition-colors disabled:opacity-50';

export function PrimaryLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={`${BUTTON_BASE} bg-court text-white active:bg-court-dark`}
    >
      {children}
    </Link>
  );
}

export function PrimaryButton({
  children,
  className = '',
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={`${BUTTON_BASE} bg-court text-white active:bg-court-dark ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = '',
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={`${BUTTON_BASE} border border-edge bg-surface text-foreground active:bg-background ${className}`}
    >
      {children}
    </button>
  );
}

const SPORTS = {
  tennis: { icon: '🎾', label: 'Tennis' },
  pickleball: { icon: '🏓', label: 'Pickleball' },
  basketball: { icon: '🏀', label: 'Basketball' },
} as const;

export function SportBadge({ sport }: { sport: string }) {
  // Unknown values come from old rows; show the raw value rather than
  // silently filing them under the wrong sport.
  const entry = SPORTS[sport as keyof typeof SPORTS];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        sport === 'tennis'
          ? 'bg-court-soft text-court-dark'
          : 'bg-orange-100 text-clay dark:bg-orange-950/50'
      }`}
    >
      {entry ? <span aria-hidden="true">{entry.icon}</span> : null}
      {entry?.label ?? sport}
    </span>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'success';
  children: ReactNode;
}) {
  const tones = {
    info: 'border-edge bg-surface text-muted',
    error:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  } as const;

  return (
    <p className={`rounded-xl border px-3.5 py-3 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-edge bg-surface px-3.5 py-3 text-base outline-none focus:border-court focus:ring-2 focus:ring-court/20';
