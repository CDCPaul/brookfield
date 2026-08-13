import { Card } from '@/components/ui';
import type { PaymentConfig } from '@/lib/queries/settings';
import { formatPeso } from '@/lib/schedule';

/**
 * Pay-by-GCash without any integration: the payer sends money to the
 * association's own account and quotes the booking reference, which the
 * association matches against its transaction history when approving.
 */
export function PaymentInstructions({
  payment,
  amount,
  code,
}: {
  payment: PaymentConfig;
  amount: number;
  code: string;
}) {
  return (
    <Card>
      <h2 className="text-sm font-semibold">How to pay</h2>

      <dl className="mt-3 space-y-2 text-sm">
        <Row label="Amount" value={formatPeso(amount)} strong />
        <Row label="GCash number" value={payment.gcashNumber} mono />
        {payment.gcashName ? (
          <Row label="Account name" value={payment.gcashName} />
        ) : null}
        <Row label="Put this in the message" value={code} mono />
      </dl>

      <p className="mt-3 text-sm text-muted">
        After sending, enter the GCash reference number below so the association
        can match your payment.
      </p>

      {payment.notes ? (
        <p className="mt-2 border-t border-edge pt-2 text-sm text-muted">
          {payment.notes}
        </p>
      ) : null}
    </Card>
  );
}

function Row({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`text-right ${mono ? 'font-mono tracking-wider' : ''} ${
          strong ? 'text-base font-bold' : 'font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
