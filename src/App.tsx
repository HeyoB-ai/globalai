import { KeyRound, Loader2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { useAuth } from './lib/useAuth';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import EmptyState from './components/EmptyState';

export default function App() {
  const { session, loading } = useAuth();

  // 1. Env-vars ontbreken → nette melding i.p.v. crash.
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title="Supabase nog niet gekoppeld"
          tone="warning"
        >
          Zet <code className="text-slate-700">VITE_SUPABASE_URL</code> en{' '}
          <code className="text-slate-700">VITE_SUPABASE_ANON_KEY</code> in een{' '}
          <code className="text-slate-700">.env</code>-bestand (zie{' '}
          <code className="text-slate-700">.env.example</code>) en herstart de
          dev-server.
        </EmptyState>
      </div>
    );
  }

  // 2. Sessie wordt gecontroleerd.
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  // 3. Niet ingelogd → loginscherm.
  if (!session) {
    return <LoginScreen />;
  }

  // 4. Ingelogd → dashboard.
  return (
    <Dashboard
      userEmail={session.user.email ?? ''}
      onSignOut={() => void supabase?.auth.signOut()}
    />
  );
}
