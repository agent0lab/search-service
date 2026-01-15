'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Home, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WalletButton } from '@/components/wallet/WalletButton';
import { AdminAccessButton } from '@/components/wallet/AdminAccessButton';

export function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [checkingWhitelist, setCheckingWhitelist] = useState(false);

  // Check if connected address is whitelisted
  useEffect(() => {
    // Handle disconnected state
    if (!isConnected || !address) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setIsWhitelisted(false);
        setCheckingWhitelist(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    let cancelled = false;

    // Use a small delay to avoid calling setState synchronously
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      setCheckingWhitelist(true);
      
      fetch(`/api/auth/whitelist-check?address=${encodeURIComponent(address)}`)
        .then((res) => res.json() as Promise<{ whitelisted: boolean }>)
        .then((data) => {
          if (!cancelled) {
            setIsWhitelisted(data.whitelisted);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Failed to check whitelist:', error);
            setIsWhitelisted(false);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setCheckingWhitelist(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isConnected, address]);

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/api-docs', label: 'API Docs', icon: FileText },
    { href: '/search', label: 'Search', icon: Search },
  ];

  return (
    <header className="border-b bg-slate-900/70 backdrop-blur-xl sticky top-0 z-40 shadow-lg shadow-black/20 border-slate-800/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <h1 className="relative text-2xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent transition-all duration-300 group-hover:from-primary group-hover:via-primary group-hover:to-primary/90">
                Agent0 Search
              </h1>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || 
                (item.href === '/' && pathname === '/') ||
                (item.href === '/search' && pathname?.startsWith('/search'));
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'gap-2 relative transition-all duration-200',
                      'hover:bg-slate-800/80 hover:text-foreground',
                      'active:scale-95',
                      isActive 
                        ? 'bg-primary/15 text-primary hover:bg-primary/25 shadow-sm shadow-primary/10' 
                        : 'text-muted-foreground'
                    )}
                  >
                    <Icon className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isActive && 'scale-110'
                    )} />
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </Button>
                </Link>
              );
            })}
            <div className="h-6 w-px bg-slate-700 mx-1" />
            <WalletButton />
            {isConnected && address && isWhitelisted && !checkingWhitelist && (
              <AdminAccessButton address={address} />
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

