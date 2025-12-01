'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, FileText, Search, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json() as Promise<{ authenticated: boolean }>)
      .then((data) => setIsAuthenticated(data.authenticated));
  }, []);

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/api-docs', label: 'API Docs', icon: FileText },
    { href: '/search', label: 'Search', icon: Search },
  ];

  return (
    <header className="border-b bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 shadow-lg transition-all border-slate-800/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="group">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent transition-all group-hover:from-primary/90 group-hover:via-primary/70 group-hover:to-primary/50">
              ERC-8004 Agent Explorer
            </h1>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || 
                (item.href === '/' && pathname === '/') ||
                (item.href === '/search' && pathname?.startsWith('/search'));
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      isActive && 'bg-primary/10 text-primary hover:bg-primary/20'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="gap-2 ml-2">
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="gap-2 ml-2">
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

