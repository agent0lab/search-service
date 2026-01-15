'use client';

import { useState } from 'react';
import { useSignMessage } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

interface AdminAccessButtonProps {
  address: string;
}

/**
 * Admin access button that triggers SIWE flow
 * Only shown when wallet is connected and address is whitelisted
 */
export function AdminAccessButton({ address }: AdminAccessButtonProps) {
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!address) {
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
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleSignIn}
        disabled={loading}
        variant="outline"
        size="sm"
        className="gap-2 border-slate-700 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all duration-200 active:scale-95"
      >
        <Shield className="h-4 w-4" />
        <span className="font-medium">{loading ? 'Signing...' : 'Admin'}</span>
      </Button>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
