import { Card, Notice, SectionTitle } from '@/components/ui';
import { getStats } from '@/lib/queries/stats';
import { SLOTS } from '@/lib/schedule';
import {
  formatMonth,
  isValidMonthStr,
  manilaNow,
  monthOf,
  monthRange,
} from '@/lib/time';
import { formatUnitLabel } from '@/lib/unit-key';

export const dynamic = 'force-dynamic';

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const currentMonth = monthOf(manilaNow().date);
  const month =
    params.month && isValidMonthStr(params.month) ? params.month : currentMonth;

  const { from, to } = monthRange(month);
  const stats = await getStats(from, to);

  const maxSlotCount = Math.max(1, ...stats.bySlot.map((row) => row.count));

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-xl font-bold tracking-tight">Usage</h1>
        <p className="mt-1 text-sm text-muted">{formatMonth(month)}</p>
      </section>

      <form method="get" className="flex gap-2">
        <input
          type="month"
          name="month"
          defaultValue={month}
          className="flex-1 rounded-xl border border-edge bg-surface px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-court px-4 text-sm font-semibold text-white active:bg-court-dark"
        >
          Show
        </button>
      </form>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="Played" value={stats.total} />
        <Stat label="Cancelled" value={stats.cancelled} />
        <Stat label="No-shows" value={stats.noShow} />
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Stat label="By residents" value={stats.residentCount} />
        <Stat label="By guests" value={stats.guestCount} />
      </section>

      {stats.total === 0 ? (
        <Notice>No bookings in this month yet.</Notice>
      ) : (
        <>
          <section>
            <SectionTitle>By sport</SectionTitle>
            <Card>
              <ul className="space-y-1.5 text-sm">
                {stats.bySport.map((row) => (
                  <li key={row.sport} className="flex justify-between">
                    <span className="capitalize">{row.sport}</span>
                    <span className="font-semibold">{row.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section>
            <SectionTitle>By time slot</SectionTitle>
            <Card>
              <ul className="space-y-2.5">
                {SLOTS.map((slot) => {
                  const count =
                    stats.bySlot.find((row) => row.slotIndex === slot.index)
                      ?.count ?? 0;
                  return (
                    <li key={slot.index}>
                      <div className="flex justify-between text-sm">
                        <span>{slot.label}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-court"
                          style={{
                            width: `${Math.round((count / maxSlotCount) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>

          <section>
            <SectionTitle>Most active units</SectionTitle>
            <Card>
              <ol className="space-y-1.5 text-sm">
                {stats.topUnits.map((unit) => (
                  <li key={unit.unitKey} className="flex justify-between gap-3">
                    <span className="truncate">{formatUnitLabel(unit)}</span>
                    <span className="shrink-0 font-semibold">{unit.count}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </section>
        </>
      )}

      <a
        href={`/admin/export?month=${month}`}
        className="inline-flex w-full items-center justify-center rounded-xl border border-edge bg-surface px-4 py-3.5 text-sm font-semibold active:bg-background"
      >
        Download CSV for {formatMonth(month)}
      </a>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-3 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
