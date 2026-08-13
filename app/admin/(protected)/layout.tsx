import { redirect } from 'next/navigation';

import { AdminNav } from '@/components/admin/admin-nav';
import { Logo } from '@/components/logo';
import { Wordmark } from '@/components/wordmark';
import { adminLogoutAction } from '@/app/admin/actions';
import { isAdmin } from '@/lib/auth';
import { countPendingBookings } from '@/lib/queries/bookings';
import { manilaNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAdmin())) redirect('/admin/login');

  const pendingCount = await countPendingBookings(manilaNow().date);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="sticky top-0 z-10 border-b border-edge bg-surface/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Logo className="size-8 shrink-0" />
            <Wordmark sub="Admin" />
          </div>
          <form action={adminLogoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-muted active:bg-background"
            >
              Sign out
            </button>
          </form>
        </div>
        <AdminNav pendingCount={pendingCount} />
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
