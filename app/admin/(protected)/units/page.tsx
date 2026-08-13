import { UnitBlockToggle } from '@/components/admin/unit-block-toggle';
import { Notice, inputClass } from '@/components/ui';
import { listUnits } from '@/lib/queries/units';
import { formatShortDate } from '@/lib/time';
import { formatUnitLabel } from '@/lib/unit-key';

export const dynamic = 'force-dynamic';

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const units = await listUnits(q);
  const blockedCount = units.filter((unit) => unit.isBlocked).length;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-xl font-bold tracking-tight">Units</h1>
        <p className="mt-1 text-sm text-muted">
          {units.length === 1
            ? '1 household has booked so far'
            : `${units.length} households have booked so far`}
          {blockedCount > 0 ? ` · ${blockedCount} blocked` : ''}.
        </p>
      </section>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search phase, block or lot"
          className={`${inputClass} py-2.5 text-sm`}
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-court px-4 text-sm font-semibold text-white active:bg-court-dark"
        >
          Search
        </button>
      </form>

      {units.length === 0 ? (
        <Notice>
          {q ? 'No units match that search.' : 'No bookings have been made yet.'}
        </Notice>
      ) : (
        <ul className="space-y-2">
          {units.map((unit) => (
            <li
              key={unit.id}
              className={`rounded-xl border p-3 ${
                unit.isBlocked
                  ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
                  : 'border-edge bg-surface'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {formatUnitLabel(unit)}
                  </p>
                  <p className="text-xs text-muted">
                    {unit.bookingCount} booking
                    {unit.bookingCount === 1 ? '' : 's'}
                    {unit.noShowCount > 0
                      ? ` · ${unit.noShowCount} no-show${unit.noShowCount === 1 ? '' : 's'}`
                      : ''}
                    {unit.lastBookingDate
                      ? ` · last ${formatShortDate(unit.lastBookingDate)}`
                      : ''}
                  </p>
                  {unit.isBlocked && unit.blockedReason ? (
                    <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                      Blocked — {unit.blockedReason}
                    </p>
                  ) : null}
                </div>

                <UnitBlockToggle unitId={unit.id} isBlocked={unit.isBlocked} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
