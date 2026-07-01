import { type FormEvent, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Wordmark from './Wordmark';

/** Zet Supabase-foutmeldingen om naar begrijpelijke NL-tekst. */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'Onjuist e-mailadres of wachtwoord.';
  }
  if (m.includes('email not confirmed')) {
    return 'Dit account is nog niet bevestigd.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Geen verbinding met de server. Controleer je internet.';
  }
  return message;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;

    setBusy(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(friendlyError(authError.message));
      setBusy(false);
      return;
    }
    // Succes: useAuth vangt de sessiewijziging op en toont het dashboard.
    // busy bewust aan laten staan tot de component unmount.
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Merk */}
        <div className="mb-8 flex flex-col items-center text-center">
          {/* Logo-symbool: ring met stip (zelfde motief als de "O" in het logo) */}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-sm">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>
          <Wordmark tone="dark" className="mt-4 text-2xl" />
          <p className="mt-1 text-sm text-slate-500">Slot Matcher · intern</p>
        </div>

        {/* Kaart */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="font-[var(--font-display)] text-lg font-bold text-slate-900">
            Inloggen
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Log in met je Global-account om de matches te bekijken.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jij@global.nl"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Wachtwoord
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 transition hover:text-slate-600"
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Bezig met inloggen…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Inloggen
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Geen account? Vraag een beheerder om je toe te voegen in Supabase.
        </p>
      </div>
    </div>
  );
}
