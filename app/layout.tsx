import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond } from 'next/font/google';

import './globals.css';

/** Closest free match to the Brookfield Subdivision wordmark. */
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Brookfield Courts',
  description:
    'Book the free morning tennis and pickleball slots at Brookfield Village, Lapu-Lapu City.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4a7c2b',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cormorant.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
