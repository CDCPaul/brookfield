import { redirect } from 'next/navigation';

import { AdminNav } from '@/components/admin/admin-nav';
import { adminLogoutAction } from '@/app/admin/actions';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAdmin())) redirect('/admin/login');

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="sticky top-0 z-10 border-b border-edge bg-surface/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-base font-semibold tracking-tight">Admin</p>
            <p className="text-xs text-muted">Brookfield Courts</p>
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
        <AdminNav />
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
