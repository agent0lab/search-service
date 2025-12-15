import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude problematic packages from server-side bundling
  serverExternalPackages: [
    'thread-stream', 
    'pino', 
    'siwe', 
    'electron', 
    'electron-fetch',
    'ipfs-http-client',
    'ipfs-utils',
  ],
  // Turbopack configuration (not experimental.turbo)
  turbopack: {
    resolveAlias: {
      // Ignore React Native modules that MetaMask SDK tries to import
      '@react-native-async-storage/async-storage': './lib/empty-module.ts',
      // Ignore electron dependency (not available in Next.js)
      'electron': './lib/empty-module.ts',
      'electron-fetch': './lib/empty-module.ts',
    },
  },
  // Webpack configuration for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore electron and related packages in server-side builds
      config.resolve.fallback = {
        ...config.resolve.fallback,
        electron: false,
        'electron-fetch': false,
      };
      // Externalize IPFS packages to avoid bundling issues
      config.externals = config.externals || [];
      if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [
          originalExternals,
          ({ request }: { request: string }) => {
            if (request?.includes('ipfs-') || request?.includes('electron')) {
              return true;
            }
          },
        ];
      } else if (Array.isArray(config.externals)) {
        config.externals.push(/^(ipfs-|electron)/);
      }
    }
    return config;
  },
};

export default nextConfig;
