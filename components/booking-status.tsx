import { formatPeso } from '@/lib/schedule';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Awaiting approval',
    className:
      'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  },
  confirmed: {
    label: 'Confirmed',
    className:
      'bg-court-soft text-court-dark dark:bg-court/20 dark:text-court-soft',
  },
  rejected: {
    label: 'Declined',
    className: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-background text-muted',
  },
  no_show: {
    label: 'No-show',
    className:
      'bg-orange-100 text-clay dark:bg-orange-950/50 dark:text-orange-200',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: 'bg-background text-muted',
  };

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Payment due',
  submitted: 'Payment sent — being checked',
  paid: 'Paid',
};

export function PaymentBadge({
  paymentStatus,
  amount,
}: {
  paymentStatus: string;
  amount: number;
}) {
  if (paymentStatus === 'none' || amount <= 0) return null;

  const paid = paymentStatus === 'paid';
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        paid
          ? 'bg-court-soft text-court-dark dark:bg-court/20 dark:text-court-soft'
          : 'bg-orange-100 text-clay dark:bg-orange-950/50'
      }`}
    >
      {formatPeso(amount)} · {PAYMENT_LABELS[paymentStatus] ?? paymentStatus}
    </span>
  );
}
