'use client';

export function LiquidEtherBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950" />
      
      {/* Animated blobs - sharper, less blur */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500/50 rounded-full mix-blend-multiply filter blur-xl opacity-90 animate-blob" />
      <div className="absolute top-0 -right-4 w-96 h-96 bg-blue-500/50 rounded-full mix-blend-multiply filter blur-xl opacity-90 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-500/50 rounded-full mix-blend-multiply filter blur-xl opacity-90 animate-blob animation-delay-4000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/40 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000" />
      
      {/* Additional ether-like particles - sharper */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-2.5 h-2.5 bg-purple-400/70 rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-blue-400/70 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-2.5 h-2.5 bg-indigo-400/70 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-cyan-400/70 rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute bottom-1/3 right-1/4 w-2.5 h-2.5 bg-purple-400/70 rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
      </div>
    </div>
  );
}

