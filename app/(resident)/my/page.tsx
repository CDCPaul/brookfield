import { MyBookings } from '@/components/my-bookings';

export const dynamic = 'force-dynamic';

export default function MyBookingsPage() {
  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">My bookings</h1>
        <p className="mt-1 text-sm text-muted">
          Look up and cancel the slots you have booked.
        </p>
      </section>

      <MyBookings />
    </div>
  );
}
