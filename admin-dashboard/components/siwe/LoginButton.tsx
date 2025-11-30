'use client';

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export function LoginButton() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!isConnected || !address) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get SIWE challenge
      const challengeResponse = await fetch('/api/auth/siwe/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!challengeResponse.ok) {
        throw new Error('Failed to get challenge');
      }

      const challengeData = await challengeResponse.json() as { message: string; nonce?: string };
      const { message } = challengeData;

      // Sign message
      const signature = await signMessageAsync({ message });

      // Verify signature
      const verifyResponse = await fetch('/api/auth/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json() as { error?: string };
        throw new Error(data.error || 'Verification failed');
      }

      // Redirect to dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Connect your wallet and sign in with Ethereum to access the admin dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <ConnectButton />
        </div>

        {isConnected && address && (
          <>
            <div className="text-sm text-muted-foreground text-center">
              Connected: <span className="font-mono">{address}</span>
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Signing...' : 'Sign In with Ethereum'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

