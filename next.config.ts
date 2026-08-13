import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Without this, Turbopack walks up and finds an unrelated lockfile in the
  // user's home directory.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
