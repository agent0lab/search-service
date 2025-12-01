'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatsDashboard } from '@/components/StatsDashboard';
import { RecentAgents } from '@/components/RecentAgents';
import { LiquidEtherBackground } from '@/components/LiquidEtherBackground';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [query, setQuery] = useState('');

  // Get chainId filter from URL for RecentAgents
  const chainIdFilter = searchParams.get('chainId') 
    ? parseInt(searchParams.get('chainId')!, 10) 
    : undefined;

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push('/search');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      <LiquidEtherBackground />
      <Header />

      <div className="container mx-auto px-4 py-8 relative z-10 flex-1">
        {/* Search Bar - At the top */}
        <div className="mb-6">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 transition-colors group-focus-within:text-primary" />
              <Input
                type="text"
                placeholder="Search by description, capabilities, or use natural language..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              className="h-11 px-6 transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            >
                  <Search className="h-4 w-4 mr-2" />
                  Search
            </Button>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <StatsDashboard activeChainId={chainIdFilter} />

        {/* Recent Agents Section */}
        <RecentAgents chainIdFilter={chainIdFilter} />
      </div>
      
      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
