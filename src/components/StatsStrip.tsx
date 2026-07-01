import { DoorOpen, Sparkles, PhoneCall } from 'lucide-react';
import type { Stats } from '../lib/selectors';

interface Props {
  stats: Stats;
}

interface Stat {
  label: string;
  value: string;
  hint: string;
  icon: typeof DoorOpen;
}

export default function StatsStrip({ stats }: Props) {
  const items: Stat[] = [
    {
      label: 'Open slots',
      value: String(stats.openSlots),
      hint: 'locaties met nog openstaande matches',
      icon: DoorOpen,
    },
    {
      label: 'Matches deze week',
      value: String(stats.matchesDezeWeek),
      hint: 'door de agent gegenereerd (7 dagen)',
      icon: Sparkles,
    },
    {
      label: 'Benaderd',
      value: `${stats.benaderdPct}%`,
      hint: 'van alle matches is benaderd',
      icon: PhoneCall,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((s) => (
        <div
          key={s.label}
          className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <s.icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="tabular text-2xl font-bold leading-none text-slate-900 font-[var(--font-display)]">
              {s.value}
            </div>
            <div className="mt-1.5 text-sm font-semibold text-slate-700">
              {s.label}
            </div>
            <div className="text-xs text-slate-400">{s.hint}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
