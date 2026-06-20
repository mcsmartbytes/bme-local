import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native SLM bindings must stay external to the Next bundle
  serverExternalPackages: ['node-llama-cpp'],
  // Silence Turbopack/webpack dual-config warning; dev/build use --webpack
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/data/**',
          '**/*.db',
          '**/tsconfig.tsbuildinfo',
          '**/drizzle/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;