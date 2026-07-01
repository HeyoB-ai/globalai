import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { MatchStatus } from '../types';
import { STATUS_META, STATUS_ORDER } from '../lib/constants';

interface Props {
  status: MatchStatus;
  onChange: (next: MatchStatus) => void;
  disabled?: boolean;
}

/**
 * Klikbare statusbadge. Opent een dropdown om de status te wijzigen.
 * De wijziging wordt door de parent optimistisch opgeslagen.
 */
export default function StatusBadge({ status, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = STATUS_META[status];

  // Sluiten bij klik buiten of Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status: ${meta.label}. Klik om te wijzigen.`}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition
          ${meta.badge}
          ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:brightness-95'}`}
      >
        {meta.label}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/5"
        >
          {STATUS_ORDER.map((s) => {
            const m = STATUS_META[s];
            const active = s === status;
            return (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setOpen(false);
                  if (s !== status) onChange(s);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
                <span className="flex-1">{m.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-brand-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
