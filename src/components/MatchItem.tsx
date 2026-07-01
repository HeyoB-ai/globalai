import { useState } from 'react';
import { Check, Copy, Newspaper, Quote } from 'lucide-react';
import type { MatchResult, MatchStatus } from '../types';
import StatusBadge from './StatusBadge';

interface Props {
  match: MatchResult;
  onStatusChange: (id: string, next: MatchStatus) => void;
  onCopyFeedback: (message: string) => void;
}

export default function MatchItem({
  match,
  onStatusChange,
  onCopyFeedback,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copyPitch = async () => {
    if (!match.pitchregel) return;
    try {
      await navigator.clipboard.writeText(match.pitchregel);
      setCopied(true);
      onCopyFeedback('Pitchregel gekopieerd');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      onCopyFeedback('Kopiëren mislukt');
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">
            {match.adverteerder}
          </div>
        </div>
        <StatusBadge
          status={match.status}
          onChange={(next) => onStatusChange(match.id, next)}
        />
      </div>

      {match.newshook && (
        <div className="mt-2.5 flex items-start gap-2 text-sm text-slate-600">
          <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>
            {match.newshook}
            {match.newshook_bron && (
              <span className="text-slate-400"> · {match.newshook_bron}</span>
            )}
          </span>
        </div>
      )}

      {match.pitchregel && (
        <div className="mt-2.5 flex items-start gap-2 rounded-md bg-white p-2.5 ring-1 ring-slate-200">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
          <p className="flex-1 text-sm italic leading-relaxed text-slate-700">
            {match.pitchregel}
          </p>
          <button
            type="button"
            onClick={copyPitch}
            aria-label="Kopieer pitchregel naar klembord"
            className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
              copied
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Gekopieerd
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Kopieer
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
