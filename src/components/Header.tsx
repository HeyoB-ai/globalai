import { Building2, LogOut, Plus, RefreshCw } from 'lucide-react';
import Wordmark from './Wordmark';

interface Props {
  onRefresh: () => void;
  refreshing: boolean;
  userEmail: string;
  onSignOut: () => void;
  onNewAnalysis: () => void;
}

export default function Header({
  onRefresh,
  refreshing,
  userEmail,
  onSignOut,
  onNewAnalysis,
}: Props) {
  return (
    <header className="bg-brand-600 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-baseline gap-3">
          <Wordmark tone="light" className="text-2xl" />
          <span className="hidden text-sm font-medium text-brand-100 sm:inline">
            Slot Matcher
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {userEmail && (
            <span
              className="hidden max-w-[180px] truncate text-sm text-brand-100 md:inline"
              title={userEmail}
            >
              {userEmail}
            </span>
          )}

          <button
            type="button"
            onClick={onNewAnalysis}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nieuwe analyse</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Vernieuwen</span>
          </button>

          <a
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            title="Accountlijst beheren"
          >
            <Building2 className="h-4 w-4" />
            <span className="hidden lg:inline">Accounts</span>
          </a>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Uitloggen</span>
          </button>
        </div>
      </div>
    </header>
  );
}
