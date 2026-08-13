import { MyBookings } from '@/components/my-bookings';

export const dynamic = 'force-dynamic';

export default function MyBookingsPage() {
  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">My bookings</h1>
        <p className="mt-1 text-sm text-muted">
          Upcoming slots for your household.
        </p>
      </section>

      <MyBookings />
    </div>
  );
}
