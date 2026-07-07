import { CalendarRange, MapPin, Monitor, Users } from 'lucide-react';
import type { MatchStatus, Slot } from '../types';
import { formatPeriod } from '../lib/format';
import MatchItem from './MatchItem';

interface Props {
  slot: Slot;
  onStatusChange: (id: string, next: MatchStatus) => void;
  onCopyFeedback: (message: string) => void;
}

export default function SlotCard({
  slot,
  onStatusChange,
  onCopyFeedback,
}: Props) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm hover:shadow-slate-900/5">
      {/* Slot-header */}
      <header className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <h2 className="min-w-0 font-[var(--font-display)] text-base font-bold leading-tight text-slate-900">
              {slot.locatie}
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
            {slot.omgeving}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm text-slate-500 sm:grid-cols-2">
          <div className="flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
            <dd className="tabular">
              {formatPeriod(slot.startdatum, slot.einddatum)}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5 text-slate-400" />
            <dd className="tabular">
              {slot.aantal_schermen}{' '}
              {slot.aantal_schermen === 1 ? 'scherm' : 'schermen'}
            </dd>
          </div>
          <div className="flex items-center gap-1.5 sm:col-span-2">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <dd className="truncate">{slot.doelgroep}</dd>
          </div>
        </dl>
      </header>

      {/* Matches */}
      <div className="flex flex-col gap-2.5 p-4">
        <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {slot.matches.length}{' '}
          {slot.matches.length === 1 ? 'voorgestelde match' : 'voorgestelde matches'}
        </div>
        {slot.matches.map((m) => (
          <MatchItem
            key={m.id}
            match={m}
            onStatusChange={onStatusChange}
            onCopyFeedback={onCopyFeedback}
          />
        ))}
      </div>
    </article>
  );
}
