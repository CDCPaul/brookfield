import Link from 'next/link';

import { BottomNav } from '@/components/bottom-nav';
import { Logo } from '@/components/logo';
import { Wordmark } from '@/components/wordmark';

export default function ResidentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <header className="sticky top-0 z-10 border-b border-edge bg-surface/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="size-9 shrink-0" />
          <Wordmark />
        </Link>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>

      <BottomNav />
    </div>
  );
}
