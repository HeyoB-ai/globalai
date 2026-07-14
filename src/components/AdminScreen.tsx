import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { updateAccounts } from '../lib/analysisApi';
import Wordmark from './Wordmark';

interface Props {
  userEmail: string;
}

interface CurrentSetting {
  value: string;
  updated_at: string;
}

type Phase = 'idle' | 'uploading' | 'done' | 'error';

/**
 * Beheerscherm (/admin) om de actieve accountlijst te vervangen. Uploadt een
 * nieuwe Accounts.xlsx naar de Anthropic Files API en maakt die de actieve
 * lijst (opgeslagen in Supabase app_settings). Geen redeploy nodig — de
 * eerstvolgende analyse gebruikt automatisch de nieuwe lijst.
 */
export default function AdminScreen({ userEmail }: Props) {
  const [current, setCurrent] = useState<CurrentSetting | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [newFileId, setNewFileId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCurrent = async () => {
    setLoadingCurrent(true);
    try {
      const { data } = await supabase!
        .from('app_settings')
        .select('value, updated_at')
        .eq('key', 'accounts_file_id')
        .maybeSingle();
      setCurrent((data as CurrentSetting | null) ?? null);
    } catch {
      setCurrent(null);
    } finally {
      setLoadingCurrent(false);
    }
  };

  useEffect(() => {
    void loadCurrent();
  }, []);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setError('Kies een .xlsx-bestand.');
      setPhase('error');
      return;
    }
    setError('');
    setNewFileId('');
    setFile(f);
    setPhase('idle');
  };

  const handleUpload = async () => {
    if (!file) return;
    setPhase('uploading');
    setError('');
    try {
      const res = await updateAccounts(file);
      setNewFileId(res.file_id);
      setPhase('done');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      void loadCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout.');
      setPhase('error');
    }
  };

  const busy = phase === 'uploading';

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-brand-600 text-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <Wordmark tone="light" className="text-2xl" />
            <span className="hidden text-sm font-medium text-brand-100 sm:inline">
              Accounts beheren
            </span>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Naar dashboard</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="font-[var(--font-display)] text-lg font-bold text-slate-900">
            Accountlijst
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            De agent stelt uitsluitend bedrijven uit deze lijst voor. Upload een
            nieuwe <code className="text-slate-700">Accounts.xlsx</code> (één
            kolom <code className="text-slate-700">Advertiser</code>) om de lijst
            te vervangen. De eerstvolgende analyse gebruikt automatisch de nieuwe
            lijst — geen redeploy nodig.
          </p>

          {/* Huidige actieve lijst */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nu actief
            </div>
            {loadingCurrent ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
              </div>
            ) : current ? (
              <div className="mt-2 space-y-0.5">
                <div className="tabular break-all text-sm text-slate-700">
                  {current.value}
                </div>
                <div className="text-xs text-slate-400">
                  Bijgewerkt: {formatDate(current.updated_at)}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-amber-600">
                Nog geen accountlijst ingesteld (of app_settings-tabel ontbreekt).
              </div>
            )}
          </div>

          {/* Upload */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-50"
            >
              <UploadCloud className="h-8 w-8 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                Kies een nieuwe Accounts.xlsx
              </span>
              <span className="text-xs text-slate-400">Alleen .xlsx-bestanden</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {file && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <FileSpreadsheet className="h-6 w-6 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {file.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {(file.size / 1024).toFixed(0)} kB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploaden…
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" /> Maak actief
                    </>
                  )}
                </button>
              </div>
            )}

            {phase === 'done' && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Nieuwe accountlijst is actief.{' '}
                  <span className="tabular break-all">{newFileId}</span>
                </span>
              </div>
            )}

            {phase === 'error' && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error || 'Er ging iets mis.'}</span>
              </div>
            )}
          </div>
        </div>

        {userEmail && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Ingelogd als {userEmail}
          </p>
        )}
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}
