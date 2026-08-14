import {
  ClosureForm,
  DeleteClosureButton,
} from '@/components/admin/closure-form';
import { Card, Notice, SectionTitle } from '@/components/ui';
import { listClosures } from '@/lib/queries/closures';
import { closureRangeLabel } from '@/lib/rules';
import { formatShortDate, manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function ClosuresPage() {
  const today = manilaNow().date;
  const closures = await listClosures();

  const upcoming = closures.filter((closure) => closure.dateTo >= today);
  const past = closures.filter((closure) => closure.dateTo < today);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold tracking-tight">Court closures</h1>
        <p className="mt-1 text-sm text-muted">
          Block slots for weather, maintenance or association events. Existing
          bookings are not cancelled automatically — cancel them from the
          Bookings tab.
        </p>
      </section>

      <section>
        <SectionTitle>Add a closure</SectionTitle>
        <Card>
          <ClosureForm today={today} />
        </Card>
      </section>

      <section>
        <SectionTitle>Active and upcoming</SectionTitle>
        {upcoming.length === 0 ? (
          <Notice>No closures scheduled.</Notice>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((closure) => (
              <li
                key={closure.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-edge bg-surface p-3"
              >
                <div>
                  <p className="text-sm font-semibold">{closure.reason}</p>
                  <p className="text-xs text-muted">
                    {formatShortDate(closure.dateFrom)}
                    {closure.dateTo !== closure.dateFrom
                      ? ` – ${formatShortDate(closure.dateTo)}`
                      : ''}
                    {' · '}
                    {closureRangeLabel(closure)}
                    {' · '}
                    {closure.venue === null
                      ? 'All courts'
                      : closure.venue === 'tennis-court'
                        ? 'Tennis court'
                        : 'Basketball court'}
                  </p>
                </div>
                <DeleteClosureButton id={closure.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section>
          <SectionTitle>Past</SectionTitle>
          <ul className="space-y-1.5">
            {past.slice(0, 20).map((closure) => (
              <li
                key={closure.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-edge px-3 py-2 text-xs text-muted"
              >
                <span>
                  {formatShortDate(closure.dateFrom)} — {closure.reason}
                </span>
                <DeleteClosureButton id={closure.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
