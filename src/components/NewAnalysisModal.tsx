import { type ReactNode, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  checkAnalysisStatus,
  startAnalysis,
  type StatusResult,
} from '../lib/analysisApi';

interface Props {
  onClose: () => void;
  /** Aangeroepen als de analyse klaar is en de gebruiker terug wil; herlaadt data. */
  onCompleted: () => void;
}

type Phase =
  | 'select'
  | 'confirm'
  | 'starting'
  | 'running'
  | 'checking'
  | 'completed'
  | 'failed';

export default function NewAnalysisModal({ onClose, onCompleted }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<StatusResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === 'starting' || phase === 'checking';

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setError('Kies een .xlsx-bestand.');
      return;
    }
    setError('');
    setFile(f);
    setPhase('confirm');
  };

  const handleStart = async () => {
    if (!file) return;
    setPhase('starting');
    setError('');
    try {
      const res = await startAnalysis(file);
      setSessionId(res.session_id);
      setPhase('running');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout.');
      setPhase('failed');
    }
  };

  const handleCheck = async () => {
    setPhase('checking');
    setError('');
    setNote('');
    try {
      const res = await checkAnalysisStatus(sessionId);
      if (res.status === 'running') {
        setNote(res.note ?? 'Analyse loopt nog.');
        setPhase('running');
      } else if (res.status === 'completed') {
        setResult(res);
        setPhase('completed');
      } else {
        setError(res.error ?? 'De analyse is mislukt.');
        setPhase('failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout.');
      setPhase('running'); // netwerkfout bij checken: blijf in running, laat opnieuw proberen
      setNote('Statuscheck mislukt — probeer het opnieuw.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Nieuwe analyse"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Kop */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="font-[var(--font-display)] text-base font-bold text-slate-900">
              Nieuwe analyse
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Sluiten"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* SELECT */}
          {phase === 'select' && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
              >
                <UploadCloud className="h-8 w-8 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">
                  Kies een Excel-bestand
                </span>
                <span className="text-xs text-slate-400">
                  Alleen .xlsx-bestanden
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {error && <ErrorLine>{error}</ErrorLine>}
            </>
          )}

          {/* CONFIRM */}
          {phase === 'confirm' && file && (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <FileSpreadsheet className="h-6 w-6 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {file.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {(file.size / 1024).toFixed(0)} kB
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Het bestand wordt geüpload en de agent start de analyse. Dit
                duurt daarna doorgaans 1-3 minuten.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPhase('select');
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Ander bestand
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  <Sparkles className="h-4 w-4" />
                  Start analyse
                </button>
              </div>
            </>
          )}

          {/* STARTING */}
          {phase === 'starting' && (
            <Centered>
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
              <p className="text-sm text-slate-500">Analyse wordt gestart…</p>
            </Centered>
          )}

          {/* RUNNING */}
          {phase === 'running' && (
            <>
              <Centered>
                <span className="relative flex h-12 w-12 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400/30" />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <Sparkles className="h-5 w-5" />
                  </span>
                </span>
                <p className="text-sm font-medium text-slate-700">
                  Analyse loopt, dit kan 1-3 minuten duren.
                </p>
                <p className="tabular text-xs text-slate-400">
                  Sessie: {sessionId}
                </p>
              </Centered>
              {note && (
                <p className="mt-1 text-center text-xs text-amber-600">{note}</p>
              )}
              <button
                type="button"
                onClick={handleCheck}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <RefreshCw className="h-4 w-4" />
                Check status
              </button>
            </>
          )}

          {/* CHECKING */}
          {phase === 'checking' && (
            <Centered>
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
              <p className="text-sm text-slate-500">Status ophalen…</p>
            </Centered>
          )}

          {/* COMPLETED */}
          {phase === 'completed' && (
            <>
              <Centered>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <p className="text-sm font-semibold text-slate-900">
                  Analyse voltooid
                </p>
                <p className="text-sm text-slate-500">
                  {result?.inserted ?? 0} nieuw · {result?.updated ?? 0}{' '}
                  bijgewerkt ({result?.total ?? 0} matches verwerkt).
                </p>
              </Centered>
              <button
                type="button"
                onClick={onCompleted}
                className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Terug naar dashboard
              </button>
            </>
          )}

          {/* FAILED */}
          {phase === 'failed' && (
            <>
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error || 'Er ging iets mis.'}</span>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Sluiten
                </button>
                {sessionId ? (
                  <button
                    type="button"
                    onClick={handleCheck}
                    className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    Opnieuw checken
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setFile(null);
                      setPhase('select');
                    }}
                    className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    Opnieuw proberen
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {children}
    </div>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
      <AlertCircle className="h-4 w-4" />
      {children}
    </p>
  );
}
