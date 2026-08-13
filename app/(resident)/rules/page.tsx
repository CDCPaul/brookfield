import Link from 'next/link';

import { Card, SectionTitle } from '@/components/ui';
import { getLimits } from '@/lib/queries/settings';
import { SLOTS } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const limits = await getLimits();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">How it works</h1>
        <p className="mt-1 text-sm text-muted">
          Free court hours for Brookfield residents.
        </p>
      </section>

      <section>
        <SectionTitle>Schedule</SectionTitle>
        <Card>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span aria-hidden="true">🎾</span>
              <span>
                <strong>Tennis</strong> — Monday, Wednesday, Friday and Sunday.
                <br />
                <span className="text-muted">1 court.</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true">🏓</span>
              <span>
                <strong>Pickleball</strong> — Tuesday, Thursday and Saturday.
                <br />
                <span className="text-muted">4 courts.</span>
              </span>
            </li>
          </ul>

          <div className="mt-4 border-t border-edge pt-3">
            <p className="text-sm font-medium">Free hours, every day</p>
            <ul className="mt-1 text-sm text-muted">
              {SLOTS.map((slot) => (
                <li key={slot.index}>{slot.label}</li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Booking rules</SectionTitle>
        <Card>
          <ul className="space-y-2.5 text-sm">
            {limits.enabled ? (
              <>
                <li>
                  Bookings open <strong>{limits.advanceDays} days</strong> ahead.
                </li>
                <li>
                  Each household may hold <strong>{limits.maxPerDay}</strong>{' '}
                  {limits.maxPerDay === 1 ? 'booking' : 'bookings'} per day.
                </li>
                <li>
                  Each household may hold <strong>{limits.maxPerWeek}</strong>{' '}
                  bookings per week (Monday to Sunday).
                </li>
              </>
            ) : (
              <li>There are no per-household limits at the moment.</li>
            )}
            <li>Cancel early if you cannot make it — someone else can use it.</li>
            <li>
              Repeated no-shows may lead the association to suspend a unit.
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Booking with your address</SectionTitle>
        <Card>
          <p className="text-sm">
            There is no password. Enter your <strong>phase, block and lot</strong>{' '}
            with your name, and this phone will remember it for next time.
          </p>
          <p className="mt-2 text-sm text-muted">
            Your mobile number is used only to reach you if the courts have to
            close for weather or maintenance.
          </p>
        </Card>
      </section>

      <div className="space-y-3 border-t border-edge pt-5 text-center">
        <p className="text-xs text-muted">
          Questions? Contact the Brookfield Homeowners Association office.
        </p>
        <Link
          href="/admin"
          className="inline-block text-xs font-medium text-muted underline"
        >
          Association staff sign in
        </Link>
      </div>
    </div>
  );
}
