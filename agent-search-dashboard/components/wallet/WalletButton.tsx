'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

/**
 * Universal wallet connection button component
 * Can be used anywhere in the app
 * Uses exact same implementation as LoginButton which works in OpenNext/Cloudflare
 */
export function WalletButton() {
  return <ConnectButton chainStatus="none" />;
}
