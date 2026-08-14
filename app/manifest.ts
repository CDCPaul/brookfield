import type { MetadataRoute } from 'next';

/**
 * What the app looks like once it is on a home screen.
 *
 * This is not decoration: iOS only delivers push notifications to a web app
 * that has been added to the home screen, and it will only offer that for a
 * site with a manifest. Android uses it for the install prompt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BrookSide Bounce — Brookfield Courts',
    short_name: 'BrookSide',
    description:
      'Book the tennis, pickleball and basketball courts at Brookfield Subdivision, Lapu-Lapu City.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fdfdf7',
    theme_color: '#4a7c2b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
