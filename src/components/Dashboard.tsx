import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Loader2, SearchX } from 'lucide-react';
import type { MatchResult, MatchStatus } from '../types';
import { fetchMatches, updateMatchStatus } from '../lib/matchService';
import {
  applyFilters,
  computeStats,
  EMPTY_FILTERS,
  groupIntoSlots,
  uniqueOmgevingen,
  type Filters,
} from '../lib/selectors';
import Header from './Header';
import StatsStrip from './StatsStrip';
import FilterBar from './FilterBar';
import SlotCard from './SlotCard';
import EmptyState from './EmptyState';
import Toast from './Toast';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface Props {
  userEmail: string;
  onSignOut: () => void;
}

/**
 * Het ingelogde dashboard. App.tsx garandeert dat Supabase geconfigureerd is
 * én dat er een sessie is voordat deze component mount.
 */
export default function Dashboard({ userEmail, onSignOut }: Props) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setState((prev) => (prev === 'ready' ? 'ready' : 'loading'));
    try {
      const data = await fetchMatches();
      setMatches(data);
      setState('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Onbekende fout');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Afgeleide data.
  const omgevingen = useMemo(() => uniqueOmgevingen(matches), [matches]);
  const stats = useMemo(() => computeStats(matches), [matches]);
  const filtered = useMemo(
    () => applyFilters(matches, filters),
    [matches, filters],
  );
  const slots = useMemo(() => groupIntoSlots(filtered), [filtered]);

  /** Optimistische statusupdate: UI direct bijwerken, bij fout terugdraaien. */
  const handleStatusChange = useCallback(
    async (id: string, next: MatchStatus) => {
      const prev = matches;
      setMatches((cur) =>
        cur.map((m) => (m.id === id ? { ...m, status: next } : m)),
      );
      try {
        await updateMatchStatus(id, next);
        setToast('Status bijgewerkt');
      } catch {
        setMatches(prev); // terugdraaien
        setToast('Opslaan mislukt — status teruggezet');
      }
    },
    [matches],
  );

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header
        onRefresh={load}
        refreshing={state === 'loading'}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />

      {/* Filterbalk alleen tonen als er iets te filteren valt. */}
      {state === 'ready' && matches.length > 0 && (
        <FilterBar
          filters={filters}
          omgevingen={omgevingen}
          onChange={setFilters}
          resultCount={filtered.length}
        />
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Laden (eerste keer) */}
        {state === 'loading' && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="mt-3 text-sm">Matches laden…</p>
          </div>
        )}

        {/* Fout bij laden */}
        {state === 'error' && (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Kon de matches niet laden"
            tone="warning"
            action={
              <button
                type="button"
                onClick={load}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Opnieuw proberen
              </button>
            }
          >
            {errorMsg ||
              'Controleer of de tabel bestaat en of je sessie nog geldig is.'}
          </EmptyState>
        )}

        {/* Geladen, maar helemaal leeg → agent moet nog draaien */}
        {state === 'ready' && matches.length === 0 && (
          <EmptyState
            icon={<Bot className="h-6 w-6" />}
            title="Nog geen matches"
            tone="brand"
          >
            De Claude Managed Agent heeft nog geen slots geanalyseerd. Zodra de
            eerste run is uitgevoerd, verschijnen hier de lege slots met
            voorgestelde adverteerders en newshooks.
          </EmptyState>
        )}

        {/* Geladen met data */}
        {state === 'ready' && matches.length > 0 && (
          <div className="space-y-8">
            <StatsStrip stats={stats} />

            {slots.length === 0 ? (
              <EmptyState
                icon={<SearchX className="h-6 w-6" />}
                title="Geen matches voor deze filters"
                action={
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Wis filters
                  </button>
                }
              >
                Pas de filters aan of wis ze om alle slots weer te zien.
              </EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {slots.map((slot) => (
                  <SlotCard
                    key={slot.key}
                    slot={slot}
                    onStatusChange={handleStatusChange}
                    onCopyFeedback={setToast}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  );
}
