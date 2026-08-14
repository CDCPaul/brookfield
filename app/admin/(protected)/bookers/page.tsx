import { BlockToggle } from '@/components/admin/block-toggle';
import { Notice, inputClass } from '@/components/ui';
import { listBookers } from '@/lib/queries/bookers';
import { formatPeso } from '@/lib/schedule';
import { formatShortDate } from '@/lib/time';
import { formatUnitLabel } from '@/lib/unit-key';

export const dynamic = 'force-dynamic';

export default async function BookersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const bookers = await listBookers(q);
  const blocked = bookers.filter((booker) => booker.isBlocked).length;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-xl font-bold tracking-tight">Bookers</h1>
        <p className="mt-1 text-sm text-muted">
          Everyone who has booked, by mobile number
          {blocked > 0 ? ` · ${blocked} blocked` : ''}.
        </p>
      </section>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name or number"
          className={`${inputClass} py-2.5 text-sm`}
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-court px-4 text-sm font-semibold text-white active:bg-court-dark"
        >
          Search
        </button>
      </form>

      {bookers.length === 0 ? (
        <Notice>
          {q ? 'Nobody matches that search.' : 'No bookings have been made yet.'}
        </Notice>
      ) : (
        <ul className="space-y-2">
          {bookers.map((booker) => (
            <li
              key={booker.phone}
              className={`rounded-xl border p-3 ${
                booker.isBlocked
                  ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
                  : 'border-edge bg-surface'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{booker.name}</p>
                  <p className="text-xs">
                    <a
                      href={`tel:${booker.phone}`}
                      className="font-medium underline"
                    >
                      {booker.phone}
                    </a>
                  </p>
                  {booker.unitLabel ? (
                    <p className="text-xs text-muted">
                      {formatUnitLabel(booker.unitLabel)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted">No household on file</p>
                  )}

                  <p className="mt-1 text-xs text-muted">
                    {booker.bookings} booking
                    {booker.bookings === 1 ? '' : 's'}
                    {booker.noShows > 0
                      ? ` · ${booker.noShows} no-show${booker.noShows === 1 ? '' : 's'}`
                      : ''}
                    {booker.cancellations > 0
                      ? ` · ${booker.cancellations} cancelled`
                      : ''}
                    {booker.spent > 0 ? ` · ${formatPeso(booker.spent)} paid` : ''}
                    {booker.lastBookingDate
                      ? ` · last ${formatShortDate(booker.lastBookingDate)}`
                      : ''}
                  </p>

                  {booker.isBlocked && booker.blockedReason ? (
                    <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                      Blocked — {booker.blockedReason}
                    </p>
                  ) : null}
                </div>

                <BlockToggle
                  phone={booker.phone}
                  isBlocked={booker.isBlocked}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
