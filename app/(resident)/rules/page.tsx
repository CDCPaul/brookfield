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
        <h1 className="text-2xl font-bold tracking-tight">Court rules</h1>
        <p className="mt-1 text-sm text-muted">
          To keep the courts safe, respectful and enjoyable for everyone.
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
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span aria-hidden="true">🏓</span>
              <span>
                <strong>Pickleball</strong> — Tuesday, Thursday and Saturday.
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
                Pickleball {formatPeso(pricing.day.pickleball)} · Tennis{' '}
                {formatPeso(pricing.day.tennis)} per court, per hour
              </p>
            </div>

            <div className="border-t border-edge pt-3">
              <p className="font-semibold">
                Evening · {tierRangeLabel('night', schedule)}
              </p>
              <p className="text-muted">
                Pickleball {formatPeso(pricing.night.pickleball)} · Tennis{' '}
                {formatPeso(pricing.night.tennis)} per court, per hour
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Court etiquette</SectionTitle>
        <Card>
          <ul className="space-y-2 text-sm">
            <li>Court access is for confirmed bookings only.</li>
            <li>Arrive 10–15 minutes early.</li>
            <li>
              Your playing time starts and ends according to your reserved slot.
            </li>
            <li>
              Vacate the court promptly so the next players can begin on time.
            </li>
            <li>Respect fellow players, staff and spectators at all times.</li>
            <li>
              Unsportsmanlike conduct, abusive language or aggressive behaviour
              will not be tolerated.
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>On the court</SectionTitle>
        <Card>
          <ul className="space-y-2 text-sm">
            <li>Wear proper non-marking athletic or court shoes.</li>
            <li>
              <strong>
                Only water or sports drinks, in spill-proof containers.
              </strong>{' '}
              No other food or drink courtside.
            </li>
            <li>Keep the court clean. Dispose of trash in the bins provided.</li>
            <li>Climbing, hanging or sitting on the net is prohibited.</li>
            <li>
              Players are responsible for any damage caused by misuse of the
              facility or equipment.
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Safety</SectionTitle>
        <Card>
          <ul className="space-y-2 text-sm">
            <li>
              Play at your own risk. Management is not liable for injuries,
              accidents or loss of personal belongings.
            </li>
            <li>Warm up before playing, and stop immediately if injured.</li>
            <li>Children must always be supervised by a responsible adult.</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Booking and payment</SectionTitle>
        <Card>
          <ul className="space-y-2 text-sm">
            <li>
              Every booking is a <strong>request</strong>. It is confirmed only
              once the association has verified your payment.
            </li>
            <li>
              A requested slot is held for <strong>24 hours</strong> while
              payment is verified. Unpaid requests are released after that.
            </li>
            <li>
              <strong>No cash.</strong> Payment must be made through the approved
              cashless method.
            </li>
            <li>
              <strong>No refunds for weather.</strong> If rain, a power outage or
              anything else beyond the management&apos;s control disrupts your
              booking, it will be rescheduled subject to court availability.
            </li>
            <li>
              No-shows are treated as a completed booking and are
              non-refundable.
            </li>
            {limits.enabled ? (
              <>
                <li>Bookings open {limits.advanceDays} days ahead.</li>
                <li>
                  In the free morning, each household may hold{' '}
                  {limits.maxPerDay}{' '}
                  {limits.maxPerDay === 1 ? 'booking' : 'bookings'} per day and{' '}
                  {limits.maxPerWeek} per week (Monday to Sunday). Guests are
                  counted by mobile number instead of address. Paid hours are not
                  limited.
                </li>
              </>
            ) : null}
            <li>Cancel early if you cannot make it — someone else can use it.</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Finding your booking</SectionTitle>
        <Card>
          <p className="text-sm">
            There is no password. For the <strong>free morning</strong>,
            residents give their phase, block and lot — that is how the daily
            and weekly limits are shared out fairly. For <strong>paid hours</strong>,
            everyone gives a name and mobile number only.
          </p>
          <p className="mt-2 text-sm">
            To see, pay for or cancel a booking, look it up with the{' '}
            <strong>mobile number you booked with</strong> — or by address to
            see the free bookings your household holds.
          </p>
          <p className="mt-2 text-sm text-muted">
            Your mobile number is used only to reach you if the courts have to
            close for weather or maintenance.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>Facility policy</SectionTitle>
        <Card>
          <ul className="space-y-2 text-sm">
            <li>
              Management reserves the right to refuse entry to, or remove, any
              person who violates these rules.
            </li>
            <li>
              These rules may be updated without prior notice to ensure the
              safety and enjoyment of all players.
            </li>
          </ul>
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
