import { RefreshCw } from 'lucide-react';

interface Props {
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * Tekst-placeholder voor het Global-logo: rond & bold (Poppins), waarbij de
 * "O" een ring met een stip in het midden is — in dezelfde stijl als het
 * ronde logo-ontwerp. Vervang dit door het aangeleverde logobestand zodra
 * beschikbaar (zet <img> op de plek van deze <span>).
 */
function GlobalWordmark() {
  return (
    <span
      className="flex select-none items-center font-[var(--font-display)] text-2xl font-extrabold uppercase leading-none tracking-tight text-white"
      aria-label="Global"
    >
      GL
      {/* De "O" als ring met stip in het midden */}
      <span
        aria-hidden="true"
        className="mx-[0.03em] inline-flex h-[0.74em] w-[0.74em] items-center justify-center rounded-full border-[0.13em] border-white align-middle"
      >
        <span className="h-[0.17em] w-[0.17em] rounded-full bg-white" />
      </span>
      BAL
    </span>
  );
}

export default function Header({ onRefresh, refreshing }: Props) {
  return (
    <header className="bg-brand-600 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-baseline gap-3">
          <GlobalWordmark />
          <span className="hidden text-sm font-medium text-brand-100 sm:inline">
            Slot Matcher
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Vernieuwen</span>
        </button>
      </div>
    </header>
  );
}
