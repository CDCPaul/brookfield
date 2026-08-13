import { redirect } from 'next/navigation';

import { AdminLoginForm } from '@/components/admin/login-form';
import { Logo } from '@/components/logo';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin');

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-5">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo className="size-16" />
        <h1 className="mt-3 font-brand text-2xl font-bold tracking-tight">
          Association sign in
        </h1>
        <p className="mt-1 text-sm text-muted">
          Brookfield court booking administration
        </p>
      </div>

      <AdminLoginForm />
    </div>
  );
}
