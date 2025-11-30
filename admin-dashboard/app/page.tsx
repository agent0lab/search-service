import { LoginButton } from '@/components/siwe/LoginButton';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Sign in with your Ethereum wallet</p>
        </div>
        <LoginButton />
      </div>
    </div>
  );
}
