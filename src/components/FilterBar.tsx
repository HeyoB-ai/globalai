import { Search, X } from 'lucide-react';
import type { MatchStatus } from '../types';
import { STATUS_META, STATUS_ORDER } from '../lib/constants';
import { EMPTY_FILTERS, type Filters } from '../lib/selectors';
import OmgevingSelect from './OmgevingSelect';

interface Props {
  filters: Filters;
  omgevingen: string[];
  onChange: (next: Filters) => void;
  resultCount: number;
}

export default function FilterBar({
  filters,
  omgevingen,
  onChange,
  resultCount,
}: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  const isActive =
    filters.omgevingen.length > 0 ||
    filters.status !== 'alle' ||
    filters.van !== '' ||
    filters.tot !== '' ||
    filters.zoek !== '';

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/85 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        {/* Zoekbalk */}
        <div className="relative min-w-0 flex-1 sm:min-w-[220px] sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.zoek}
            onChange={(e) => set('zoek', e.target.value)}
            placeholder="Zoek op locatie of adverteerder…"
            aria-label="Zoek op locatie of adverteerder"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-72"
          />
        </div>

        {/* Omgeving multi-select */}
        <OmgevingSelect
          options={omgevingen}
          selected={filters.omgevingen}
          onChange={(v) => set('omgevingen', v)}
        />

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => set('status', e.target.value as MatchStatus | 'alle')}
          aria-label="Filter op status"
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="alle">Alle statussen</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>

        {/* Periode */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 h-10">
          <input
            type="date"
            value={filters.van}
            onChange={(e) => set('van', e.target.value)}
            aria-label="Periode vanaf"
            className="tabular bg-transparent text-sm text-slate-700 focus:outline-none"
          />
          <span className="text-slate-300">–</span>
          <input
            type="date"
            value={filters.tot}
            onChange={(e) => set('tot', e.target.value)}
            aria-label="Periode tot"
            className="tabular bg-transparent text-sm text-slate-700 focus:outline-none"
          />
        </div>

        {/* Reset + telling */}
        <div className="ml-auto flex items-center gap-3">
          <span className="tabular hidden text-sm text-slate-400 sm:inline">
            {resultCount} {resultCount === 1 ? 'match' : 'matches'}
          </span>
          {isActive && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              Wis filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
