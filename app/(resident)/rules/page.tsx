import Link from 'next/link';

import { Card, SectionTitle } from '@/components/ui';
import { getSettings } from '@/lib/queries/settings';
import { formatPeso, tierRangeLabel } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const { limits, schedule, pricing } = await getSettings();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">How it works</h1>
        <p className="mt-1 text-sm text-muted">
          Court hours and rules for Brookfield Subdivision.
        </p>
      </section>

      <section>
        <SectionTitle>Which sport, which day</SectionTitle>
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
        </Card>
      </section>

      <section>
        <SectionTitle>Hours and fees</SectionTitle>
        <Card>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold">
                Free morning · {tierRangeLabel('free', schedule)}
              </p>
              <p className="text-muted">
                Free for Brookfield residents. Guests cannot book these hours.
              </p>
            </div>

            <div className="border-t border-edge pt-3">
              <p className="font-semibold">
                Daytime · {tierRangeLabel('day', schedule)}
              </p>
              <p className="text-muted">
                Tennis {formatPeso(pricing.day.tennis)} · Pickleball{' '}
                {formatPeso(pricing.day.pickleball)} per hour
              </p>
            </div>

            <div className="border-t border-edge pt-3">
              <p className="font-semibold">
                Evening · {tierRangeLabel('night', schedule)}
              </p>
              <p className="text-muted">
                Tennis {formatPeso(pricing.night.tennis)} · Pickleball{' '}
                {formatPeso(pricing.night.pickleball)} per hour
              </p>
            </div>

            <p className="border-t border-edge pt-3 text-muted">
              Paid hours are open to residents and guests alike. Fees are per
              court, per hour.
            </p>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>On the court</SectionTitle>
        <Card>
          <ul className="space-y-2.5 text-sm">
            <li>
              <strong>Water and sports drinks only.</strong> No other food or
              drink is allowed on the courts.
            </li>
            <li>Take your bottles and rubbish with you when you leave.</li>
            <li>Non-marking court shoes only.</li>
            <li>
              Finish on time — the next players are waiting for their slot.
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Booking rules</SectionTitle>
        <Card>
          <ul className="space-y-2.5 text-sm">
            <li>
              Every booking is a <strong>request</strong>. The association
              reviews it and you will see it confirmed under My bookings.
            </li>
            {limits.enabled ? (
              <>
                <li>
                  Bookings open <strong>{limits.advanceDays} days</strong> ahead.
                </li>
                <li>
                  In the free morning, each household may hold{' '}
                  <strong>{limits.maxPerDay}</strong>{' '}
                  {limits.maxPerDay === 1 ? 'booking' : 'bookings'} per day and{' '}
                  <strong>{limits.maxPerWeek}</strong> per week (Monday to
                  Sunday).
                </li>
                <li>
                  Guests are counted the same way, by mobile number instead of
                  address.
                </li>
                <li>Paid hours are not limited.</li>
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
        <SectionTitle>Booking and finding your slot</SectionTitle>
        <Card>
          <p className="text-sm">
            There is no password. <strong>Residents</strong> enter their phase,
            block and lot with their name. <strong>Guests</strong> visiting from
            outside the village enter a name and mobile number only.
          </p>
          <p className="mt-2 text-sm">
            To see, pay for or cancel a booking, look it up with the{' '}
            <strong>mobile number you booked with</strong> — or, for residents,
            by address to see everything your household has booked.
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
