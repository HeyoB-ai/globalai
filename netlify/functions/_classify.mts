import { createClient } from '@supabase/supabase-js';

/**
 * Gedeelde helpers voor de sectorclassificatie-cache (account_profiles).
 *
 * Onderstreept-prefix (_classify): Netlify behandelt dit als support-bestand,
 * niet als een eigen Netlify Function. Wordt geïmporteerd door
 * classify-accounts, check-classification-status en (later) start-analysis /
 * update-accounts.
 */

/** Sessie-outputbestand waar de classificatie-agent zijn resultaat wegschrijft. */
export const CLASSIFY_OUTPUT_FILENAME = 'account_profiles.json';
export const CLASSIFY_ACCOUNTS_MOUNT = '/mnt/session/accounts/accounts.xlsx';
export const CLASSIFY_OUTPUT_PATH =
  '/mnt/session/outputs/account_profiles.json';

/** Standaard batchgrootte: aantal bedrijven dat één sessie classificeert. */
export const DEFAULT_CLASSIFY_BATCH = 25;

/** Eén geclassificeerd bedrijf, klaar voor upsert in account_profiles. */
export interface AccountProfile {
  advertiser: string;
  sector: string;
  typische_doelgroep: string;
  korte_beschrijving: string | null;
  classified_at: string;
}

/**
 * Haalt de file_id van de actieve accountlijst op uit Supabase
 * (app_settings.accounts_file_id), met de env var ANTHROPIC_ACCOUNTS_FILE_ID
 * als fallback. Geeft null als geen van beide een waarde heeft.
 */
export async function resolveAccountsFileId(): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'accounts_file_id')
        .maybeSingle();
      if (!error && data?.value) return data.value as string;
    } catch {
      /* val door naar de env var-fallback */
    }
  }
  return process.env.ANTHROPIC_ACCOUNTS_FILE_ID ?? null;
}

/** Alle reeds geclassificeerde adverteerdersnamen (voor "overslaan"-lijst). */
export async function fetchKnownAdvertisers(): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return [];
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('account_profiles')
    .select('advertiser');
  if (error || !data) return [];
  return data.map((r) => String((r as { advertiser: string }).advertiser));
}

/**
 * Bouwt de kickoff-instructie voor één classificatie-batch. De agent leest de
 * gemounte accountlijst, slaat de al bekende bedrijven over, en classificeert
 * de eerstvolgende `batch` onbekende bedrijven (sector + doelgroep + 1 zin).
 */
export function buildClassifyKickoff(
  known: string[],
  batch: number,
): string {
  const knownBlock =
    known.length > 0
      ? known.map((n) => `- ${n}`).join('\n')
      : '(nog geen — dit is de eerste batch)';

  return [
    'Er staat één Excel-bestand voor je klaar: de accountlijst met adverteerders',
    `(kolom "Advertiser") op ${CLASSIFY_ACCOUNTS_MOUNT}.`,
    '',
    'Je taak is SECTORCLASSIFICATIE — NIET het zoeken van nieuws/newshooks.',
    '',
    'Stap 1. Lees de volledige lijst en bepaal de unieke bedrijfsnamen (exacte',
    'spelling zoals in het bestand, witruimte getrimd). Het totale aantal unieke',
    'bedrijven noem je total_in_list.',
    '',
    'Stap 2. De volgende bedrijven zijn AL geclassificeerd — SLA ZE OVER:',
    knownBlock,
    '',
    `Stap 3. Neem uit de nog NIET-geclassificeerde bedrijven, in de volgorde`,
    `waarin ze in het bestand staan, de EERSTE ${batch} stuks (of minder als er`,
    'minder resteren). Bepaal voor elk:',
    '- sector: korte Nederlandse sectoraanduiding (bijv. Verzekeringen,',
    '  Reisorganisatie, Bouwmarkt, Supermarkt, Telecom).',
    '- typische_doelgroep: korte omschrijving van wie dit bedrijf wil bereiken.',
    '- korte_beschrijving: één zin context over het bedrijf.',
    'Gebruik websearch UITSLUITEND waar nodig; voor bekende bedrijven niet.',
    '',
    `Stap 4. Schrijf het resultaat als één JSON-object naar ${CLASSIFY_OUTPUT_PATH}:`,
    '{',
    '  "total_in_list": <geheel getal>,',
    '  "profiles": [',
    '    { "advertiser": "<exact zoals in de lijst>", "sector": "...",',
    '      "typische_doelgroep": "...", "korte_beschrijving": "..." }',
    '  ]',
    '}',
    '',
    `- Zet in "profiles" UITSLUITEND de bedrijven die je NU nieuw classificeert (max ${batch}).`,
    '- "advertiser" MOET exact de naam uit de lijst zijn (zo wordt hij gecachet).',
    '- Schrijf uitsluitend geldige JSON — geen markdown, geen tekst eromheen.',
    '- Zijn alle bedrijven al geclassificeerd? Schrijf dan { "total_in_list": <n>, "profiles": [] }.',
  ].join('\n');
}

/** Normaliseert één ruw profiel-object uit de agent-output; null bij ongeldig. */
export function normalizeProfile(
  raw: Record<string, unknown>,
  now: string,
): AccountProfile | null {
  const advertiser = String(raw.advertiser ?? '').trim();
  const sector = String(raw.sector ?? '').trim();
  const doelgroep = String(raw.typische_doelgroep ?? '').trim();
  if (!advertiser || !sector || !doelgroep) return null;
  const besch = raw.korte_beschrijving;
  return {
    advertiser,
    sector,
    typische_doelgroep: doelgroep,
    korte_beschrijving:
      besch != null && String(besch).trim() !== ''
        ? String(besch).trim()
        : null,
    classified_at: now,
  };
}

/** Parse-resultaat van het account_profiles.json outputbestand. */
export interface ParsedClassifyOutput {
  totalInList: number | null;
  profiles: AccountProfile[];
}

/** Leest total_in_list + profiles uit de (reeds geparste) agent-output. */
export function extractClassifyOutput(parsed: unknown): ParsedClassifyOutput {
  const now = new Date().toISOString();
  // Ondersteun zowel { total_in_list, profiles:[...] } als een kale array.
  let list: unknown[] = [];
  let totalInList: number | null = null;
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.profiles)) list = obj.profiles;
    const t = Number(obj.total_in_list);
    if (Number.isFinite(t) && t >= 0) totalInList = t;
  }
  const profiles: AccountProfile[] = [];
  for (const item of list) {
    if (item && typeof item === 'object') {
      const clean = normalizeProfile(item as Record<string, unknown>, now);
      if (clean) profiles.push(clean);
    }
  }
  return { totalInList, profiles };
}
