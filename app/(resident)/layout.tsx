import Link from 'next/link';

import { BottomNav } from '@/components/bottom-nav';
import { Logo } from '@/components/logo';
import { Wordmark } from '@/components/wordmark';

export default function ResidentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-edge bg-surface/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo className="size-9 shrink-0" />
          <Wordmark />
        </Link>

        {/* Quiet on purpose: staff need it, residents never do. */}
        <Link
          href="/admin"
          aria-label="Association staff sign in"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-edge text-muted active:bg-background"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="10" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </Link>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>

      <BottomNav />
    </div>
  );
}
