import type { MatchStatus } from '../types';

interface StatusMeta {
  label: string;
  /** Klassen voor de badge (achtergrond + tekst + rand). */
  badge: string;
  /** Kleine kleurstip, voor de dropdown. */
  dot: string;
}

/**
 * Statuskleuren volgens opdracht:
 * nog_open = blauw, benaderd = geel, gescoord = groen, afgewezen = grijs.
 * We gebruiken bewust rustige tinten met voldoende contrast (WCAG AA).
 */
export const STATUS_META: Record<MatchStatus, StatusMeta> = {
  nog_open: {
    label: 'Nog open',
    badge: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    dot: 'bg-blue-500',
  },
  benaderd: {
    label: 'Benaderd',
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/30',
    dot: 'bg-amber-500',
  },
  gescoord: {
    label: 'Gescoord',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  afgewezen: {
    label: 'Afgewezen',
    badge: 'bg-slate-100 text-slate-500 ring-slate-400/30',
    dot: 'bg-slate-400',
  },
};

/** Vaste volgorde voor status-filter en dropdown. */
export const STATUS_ORDER: MatchStatus[] = [
  'nog_open',
  'benaderd',
  'gescoord',
  'afgewezen',
];
