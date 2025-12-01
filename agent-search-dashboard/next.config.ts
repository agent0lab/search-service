import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude problematic packages from server-side bundling
  serverExternalPackages: ['thread-stream', 'pino', 'siwe'],
  // Turbopack configuration (not experimental.turbo)
  turbopack: {
    resolveAlias: {
      // Ignore React Native modules that MetaMask SDK tries to import
      '@react-native-async-storage/async-storage': './lib/empty-module.ts',
    },
  },
};

export default nextConfig;
