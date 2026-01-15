'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, baseSepolia, polygonAmoy } from 'wagmi/chains';

// Get Reown (WalletConnect) project ID from environment
// Get one for free at https://cloud.reown.com
// After creating a project, add your origin (e.g., http://localhost:3000) to the allowlist
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

if (!projectId) {
  console.warn(
    '⚠️ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Get a free project ID at https://cloud.reown.com\n' +
    '   After creating a project, add http://localhost:3000 to the allowlist in project settings.'
  );
}

// Suppress analytics errors in development if origin is not on allowlist
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Suppress allowlist errors in development
    if (message.includes('not found on Allowlist') || message.includes('Allowlist')) {
      console.warn(
        '⚠️ Reown analytics allowlist error (safe to ignore in dev). ' +
        'Add http://localhost:3000 to your project allowlist at https://cloud.reown.com'
      );
      return;
    }
    originalError.apply(console, args);
  };
}

export const wagmiConfig = getDefaultConfig({
  appName: 'Agent0 Search',
  projectId: projectId || '00000000000000000000000000000000', // Placeholder - replace with your project ID
  chains: [sepolia, baseSepolia, polygonAmoy], // Testnets: Ethereum Sepolia (default), Base Sepolia, Polygon Amoy
  ssr: true, // Enable SSR for Next.js
});

