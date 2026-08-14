import { type Closure, closureRangeLabel } from '@/lib/rules';
import { formatShortDate } from '@/lib/time';

function describe(closure: Closure): string {
  const range =
    closure.dateFrom === closure.dateTo
      ? formatShortDate(closure.dateFrom)
      : `${formatShortDate(closure.dateFrom)} – ${formatShortDate(closure.dateTo)}`;

  const when = closureRangeLabel(closure);

  const where =
    closure.venue === null
      ? ''
      : closure.venue === 'tennis-court'
        ? ', tennis court'
        : ', basketball court';

  return `${range}, ${when}${where}`;
}

export function ClosureNotice({ closures }: { closures: Closure[] }) {
  if (closures.length === 0) return null;

  return (
    <section className="rounded-2xl border border-orange-300 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-clay">
        <span aria-hidden="true">⚠</span>
        Court closures ahead
      </h2>
      <ul className="mt-2 space-y-1.5">
        {closures.map((closure, index) => (
          <li key={index} className="text-sm">
            <span className="font-medium">{closure.reason}</span>
            <span className="block text-xs text-muted">
              {describe(closure)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
