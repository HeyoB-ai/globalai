import type { MatchResult, MatchStatus, Slot } from '../types';
import { isWithinLastWeek } from './format';

export interface Filters {
  omgevingen: string[]; // leeg = alle
  status: MatchStatus | 'alle';
  van: string; // ISO date of ''
  tot: string; // ISO date of ''
  zoek: string;
}

export const EMPTY_FILTERS: Filters = {
  omgevingen: [],
  status: 'alle',
  van: '',
  tot: '',
  zoek: '',
};

/** Unieke omgevingen (gesorteerd) voor de multi-select. */
export function uniqueOmgevingen(matches: MatchResult[]): string[] {
  return [...new Set(matches.map((m) => m.omgeving))].sort((a, b) =>
    a.localeCompare(b, 'nl'),
  );
}

/** Filter toepassen op de platte matchlijst. */
export function applyFilters(
  matches: MatchResult[],
  f: Filters,
): MatchResult[] {
  const zoek = f.zoek.trim().toLowerCase();

  return matches.filter((m) => {
    if (f.omgevingen.length > 0 && !f.omgevingen.includes(m.omgeving)) {
      return false;
    }
    if (f.status !== 'alle' && m.status !== f.status) {
      return false;
    }
    // Periode-overlap: slot valt af als het volledig buiten [van, tot] ligt.
    if (f.van && m.einddatum < f.van) return false;
    if (f.tot && m.startdatum > f.tot) return false;

    if (zoek) {
      const haystack = `${m.locatie} ${m.adverteerder}`.toLowerCase();
      if (!haystack.includes(zoek)) return false;
    }
    return true;
  });
}

/** Platte matches groeperen tot slots (locatie + periode). */
export function groupIntoSlots(matches: MatchResult[]): Slot[] {
  const map = new Map<string, Slot>();

  for (const m of matches) {
    const key = `${m.locatie}__${m.startdatum}__${m.einddatum}`;
    let slot = map.get(key);
    if (!slot) {
      slot = {
        key,
        locatie: m.locatie,
        omgeving: m.omgeving,
        doelgroep: m.doelgroep,
        startdatum: m.startdatum,
        einddatum: m.einddatum,
        aantal_schermen: m.aantal_schermen,
        matches: [],
      };
      map.set(key, slot);
    }
    slot.matches.push(m);
  }

  // Slots op startdatum, matches binnen een slot op status-relevantie.
  return [...map.values()].sort((a, b) =>
    a.startdatum.localeCompare(b.startdatum),
  );
}

export interface Stats {
  openSlots: number;
  matchesDezeWeek: number;
  benaderdPct: number;
}

/**
 * Statistieken over de VOLLEDIGE dataset (niet de gefilterde), zodat de
 * strip een stabiel totaalbeeld geeft.
 */
export function computeStats(matches: MatchResult[]): Stats {
  const total = matches.length;

  // Open slots = unieke slots met minstens één 'nog_open' match.
  const openSlotKeys = new Set<string>();
  for (const m of matches) {
    if (m.status === 'nog_open') {
      openSlotKeys.add(`${m.locatie}__${m.startdatum}__${m.einddatum}`);
    }
  }

  const matchesDezeWeek = matches.filter((m) =>
    isWithinLastWeek(m.laatst_geanalyseerd),
  ).length;

  const benaderd = matches.filter((m) => m.status === 'benaderd').length;
  const benaderdPct = total === 0 ? 0 : Math.round((benaderd / total) * 100);

  return {
    openSlots: openSlotKeys.size,
    matchesDezeWeek,
    benaderdPct,
  };
}
