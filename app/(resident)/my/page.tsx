import { MyBookings } from '@/components/my-bookings';
import { isBlobConfigured } from '@/lib/payment-proof';
import { publicVapidKey } from '@/lib/notify/push';
import { getSettings } from '@/lib/queries/settings';

export const dynamic = 'force-dynamic';

export default async function MyBookingsPage() {
  const { payment, notify } = await getSettings();

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">My bookings</h1>
        <p className="mt-1 text-sm text-muted">
          Look up, pay for and cancel the slots you have requested.
        </p>
      </section>

      <MyBookings
        payment={payment}
        uploadEnabled={isBlobConfigured()}
        vapidKey={notify.pushEnabled ? publicVapidKey() : ''}
      />
    </div>
  );
}
