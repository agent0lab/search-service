import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for OpenNext compatibility
  output: 'standalone',
  
  // Exclude problematic packages from server-side bundling
  serverExternalPackages: [
    'thread-stream', 
    'pino', 
    'siwe', 
    'electron', 
    'electron-fetch',
    'ipfs-http-client',
    'ipfs-utils',
    'agent0-sdk', // SDK uses Node.js modules that shouldn't be bundled
  ],
  // Turbopack configuration (not experimental.turbo)
  turbopack: {
    resolveAlias: {
      // Ignore React Native modules that MetaMask SDK tries to import
      '@react-native-async-storage/async-storage': './lib/empty-module.ts',
      // Ignore electron dependency (not available in Next.js)
      'electron': './lib/empty-module.ts',
      'electron-fetch': './lib/empty-module.ts',
      // Alias Node.js 'fs' module for client-side builds only
      // This prevents Turbopack from trying to resolve 'fs' in browser code
      // Server-side code will still use the real 'fs' module
      'fs': './lib/empty-module.ts',
      'node:fs': './lib/empty-module.ts',
    },
    resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  // Webpack configuration for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side: ignore Node.js modules that agent0-sdk might import
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        buffer: false,
      };
    } else {
      // Server-side: Ignore electron and related packages
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
