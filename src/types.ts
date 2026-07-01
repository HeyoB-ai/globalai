export type MatchStatus = 'nog_open' | 'benaderd' | 'gescoord' | 'afgewezen';

/** Eén rij uit de Supabase-tabel `match_results`. */
export interface MatchResult {
  id: string;
  locatie: string;
  omgeving: string;
  doelgroep: string;
  startdatum: string; // ISO date (YYYY-MM-DD)
  einddatum: string; // ISO date (YYYY-MM-DD)
  aantal_schermen: number;
  adverteerder: string;
  newshook: string | null;
  newshook_bron: string | null;
  pitchregel: string | null;
  status: MatchStatus;
  laatst_geanalyseerd: string; // ISO timestamp
}

/**
 * Een "slot" = een fysieke plek + periode. De agent kan meerdere
 * adverteerder-matches voorstellen voor hetzelfde slot; die groeperen we
 * onder één kaart.
 */
export interface Slot {
  key: string;
  locatie: string;
  omgeving: string;
  doelgroep: string;
  startdatum: string;
  einddatum: string;
  aantal_schermen: number;
  matches: MatchResult[];
}
