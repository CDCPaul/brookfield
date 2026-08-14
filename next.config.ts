import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Without this, Turbopack walks up and finds an unrelated lockfile in the
  // user's home directory.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  async headers() {
    return [
      {
        // A cached service worker is a worker that never updates, and this one
        // decides what every notification says.
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
