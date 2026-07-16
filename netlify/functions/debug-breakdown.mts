import { createClient } from '@supabase/supabase-js';

/**
 * TIJDELIJKE diagnostiek-functie — read-only matchverdeling per omgeving.
 * Token-beveiligd en wordt na gebruik weer verwijderd. Niet voor productie.
 */

const TOKEN = 'brk_9f3a2c7e51d84b6f';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { 'content-type': 'application/json' },
  });

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  if (url.searchParams.get('token') !== TOKEN) {
    return json({ error: 'forbidden' }, 403);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: 'config' }, 500);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('match_results')
    .select(
      'locatie, omgeving, startdatum, adverteerder, laatst_geanalyseerd',
    );
  if (error) return json({ error: error.message, code: error.code }, 500);

  const rows = data ?? [];
  const dayOf = (iso: string | null) => (iso ? String(iso).slice(0, 10) : 'onbekend');

  // Rijen per analyse-dag (om de nieuwe batch te isoleren van oude testdata).
  const perDay: Record<string, number> = {};
  for (const r of rows) perDay[dayOf((r as any).laatst_geanalyseerd)] = (perDay[dayOf((r as any).laatst_geanalyseerd)] ?? 0) + 1;

  // Nieuwste dag = de zojuist verwerkte batch.
  const days = Object.keys(perDay).filter((d) => d !== 'onbekend').sort();
  const latestDay = days[days.length - 1];
  const batch = rows.filter(
    (r) => dayOf((r as any).laatst_geanalyseerd) === latestDay,
  );

  const slotKey = (r: any) => `${r.locatie}||${r.startdatum}`;

  // Per omgeving: matches, unieke slots, unieke adverteerders.
  type Agg = {
    matches: number;
    slots: Set<string>;
    adverteerders: Set<string>;
  };
  const perOmgeving: Record<string, Agg> = {};
  const slotMatchCount: Record<string, number> = {};
  for (const r of batch as any[]) {
    const omg = r.omgeving || '(leeg)';
    (perOmgeving[omg] ??= {
      matches: 0,
      slots: new Set(),
      adverteerders: new Set(),
    });
    perOmgeving[omg].matches += 1;
    perOmgeving[omg].slots.add(slotKey(r));
    perOmgeving[omg].adverteerders.add(r.adverteerder);
    slotMatchCount[slotKey(r)] = (slotMatchCount[slotKey(r)] ?? 0) + 1;
  }

  const omgevingBreakdown = Object.entries(perOmgeving)
    .map(([omgeving, a]) => ({
      omgeving,
      matches: a.matches,
      unieke_slots: a.slots.size,
      unieke_adverteerders: a.adverteerders.size,
      gem_matches_per_slot: +(a.matches / a.slots.size).toFixed(2),
    }))
    .sort((x, y) => y.matches - x.matches);

  // Histogram: hoeveel slots kregen 1, 2, 3, 4+ matches.
  const hist: Record<string, number> = {};
  for (const c of Object.values(slotMatchCount)) {
    const bucket = c >= 4 ? '4+' : String(c);
    hist[bucket] = (hist[bucket] ?? 0) + 1;
  }

  return json({
    totaal_rijen_in_tabel: rows.length,
    rijen_per_analyse_dag: perDay,
    nieuwe_batch_dag: latestDay,
    nieuwe_batch: {
      matches: batch.length,
      unieke_slots: new Set(batch.map((r) => slotKey(r))).size,
      unieke_adverteerders: new Set(batch.map((r: any) => r.adverteerder)).size,
      matches_per_slot_histogram: hist,
      per_omgeving: omgevingBreakdown,
    },
  });
};
