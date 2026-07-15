import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  Sparkles,
  StopCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  checkClassificationStatus,
  startClassification,
} from '../lib/analysisApi';

/**
 * Beheer-paneel voor de sectorclassificatie-cache (account_profiles).
 *
 * Draait het eenmalige/aanvullende classificatieproces: start telkens één
 * batch (Managed Agent-sessie) via classify-accounts, polt de status via
 * check-classification-status, en gaat automatisch door met de volgende batch
 * tot alle bedrijven bekend zijn. Toont voortgang "X / N geclassificeerd".
 */

type Phase = 'idle' | 'running' | 'done' | 'error';

const POLL_MS = 5000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ClassifyAccountsPanel() {
  const [known, setKnown] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const cancelRef = useRef(false);

  const loadKnown = async () => {
    if (!supabase) return;
    const { count } = await supabase
      .from('account_profiles')
      .select('advertiser', { count: 'exact', head: true });
    setKnown(count ?? 0);
  };

  useEffect(() => {
    void loadKnown();
    return () => {
      cancelRef.current = true;
    };
  }, []);

  const runAll = async () => {
    cancelRef.current = false;
    setPhase('running');
    setError('');
    let batchNr = 0;

    try {
      while (!cancelRef.current) {
        batchNr += 1;
        setStatus(`Batch ${batchNr}: sessie starten…`);
        const { session_id } = await startClassification();

        // Poll tot de batch klaar of mislukt is.
        let done = false;
        while (!done && !cancelRef.current) {
          await sleep(POLL_MS);
          if (cancelRef.current) break;
          setStatus(`Batch ${batchNr}: bezig met classificeren…`);
          const res = await checkClassificationStatus(session_id);

          if (res.status === 'running') continue;

          if (res.status === 'failed') {
            setError(res.error ?? 'De classificatie is mislukt.');
            setPhase('error');
            return;
          }

          // completed
          done = true;
          if (typeof res.known_after === 'number') setKnown(res.known_after);
          if (typeof res.total_in_list === 'number') setTotal(res.total_in_list);

          const added = res.added ?? 0;
          const remaining = res.remaining;

          if (remaining === 0) {
            setStatus('');
            setPhase('done');
            return;
          }
          // Geen voortgang meer maar (nog) niet als "klaar" gemarkeerd:
          // stop om een oneindige lus te voorkomen.
          if (added === 0) {
            setStatus(
              'Geen nieuwe bedrijven meer geclassificeerd. Mogelijk zijn alle bedrijven al bekend.',
            );
            setPhase('done');
            return;
          }
          setStatus(
            `Batch ${batchNr} klaar: ${added} toegevoegd${
              remaining != null ? `, nog ${remaining} te gaan` : ''
            }.`,
          );
        }
      }
      // Handmatig gestopt.
      setPhase('idle');
      setStatus('Gestopt.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout.');
      setPhase('error');
    }
  };

  const stop = () => {
    cancelRef.current = true;
    setStatus('Stoppen na de huidige batch…');
  };

  const busy = phase === 'running';
  const pct =
    total && total > 0 && known != null
      ? Math.min(100, Math.round((known / total) * 100))
      : null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Database className="h-4 w-4" />
        </span>
        <h2 className="font-[var(--font-display)] text-lg font-bold text-slate-900">
          Sectorclassificatie-cache
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Classificeert elk bedrijf uit de accountlijst één keer (sector +
        doelgroep). Analyses hoeven daarna alleen nog newshooks op te zoeken —
        niet meer "wat voor bedrijf is dit". Alleen nog niet-bekende bedrijven
        worden verwerkt.
      </p>

      {/* Telling / voortgang */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Geclassificeerd
          </span>
          <span className="tabular text-sm font-semibold text-slate-700">
            {known ?? '…'}
            {total != null ? ` / ${total}` : ''}
          </span>
        </div>
        {pct != null && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {status && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
          {status}
        </p>
      )}

      {phase === 'done' && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 p-3.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Classificatie bijgewerkt.</span>
        </div>
      )}

      {phase === 'error' && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || 'Er ging iets mis.'}</span>
        </div>
      )}

      <div className="mt-5">
        {busy ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <StopCircle className="h-4 w-4" />
            Stop na huidige batch
          </button>
        ) : (
          <button
            type="button"
            onClick={runAll}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" />
            {known && known > 0
              ? 'Classificeer resterende bedrijven'
              : 'Start classificatie'}
          </button>
        )}
      </div>
    </div>
  );
}
