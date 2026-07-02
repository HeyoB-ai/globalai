import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: check-analysis-status
 *
 * Ontvangt { session_id } en vraagt de sessie-status op bij Anthropic.
 * - running/rescheduling → { status: "running" }
 * - terminated           → { status: "failed" }
 * - idle (klaar)         → haal /mnt/session/outputs/match_results.json op,
 *                          parse + valideer, upsert naar Supabase, en geef
 *                          { status: "completed", inserted, updated, total }
 *
 * Upsert zonder schemawijziging: per rij wordt op de samengestelde sleutel
 * (locatie + adverteerder + startdatum) gecheckt of een rij bestaat; zo ja
 * update, anders insert. Schrijven gebeurt met de service-role key (omzeilt
 * RLS) — die key staat alleen in de Netlify-omgeving, nooit in de frontend.
 */

const OUTPUT_FILENAME = 'match_results.json';
const REQUIRED = [
  'locatie',
  'omgeving',
  'doelgroep',
  'startdatum',
  'einddatum',
  'adverteerder',
] as const;
const STATUSES = ['nog_open', 'benaderd', 'gescoord', 'afgewezen'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function friendlyAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return 'Anthropic-authenticatie mislukt — controleer ANTHROPIC_API_KEY.';
  if (err instanceof Anthropic.NotFoundError)
    return 'De analyse-sessie is niet gevonden.';
  if (err instanceof Anthropic.RateLimitError)
    return 'Te veel aanvragen bij Anthropic (rate limit). Probeer het zo opnieuw.';
  if (err instanceof Anthropic.APIError)
    return 'Er ging iets mis bij het ophalen van de status. Probeer het opnieuw.';
  return 'Onverwachte fout bij het ophalen van de status.';
}

interface CleanRow {
  locatie: string;
  omgeving: string;
  doelgroep: string;
  startdatum: string;
  einddatum: string;
  aantal_schermen: number;
  adverteerder: string;
  newshook: string | null;
  newshook_bron: string | null;
  pitchregel: string | null;
  status: string;
  laatst_geanalyseerd: string;
}

function normalizeRow(r: Record<string, unknown>): CleanRow | null {
  for (const key of REQUIRED) {
    const v = r[key];
    if (v === undefined || v === null || String(v).trim() === '') return null;
  }
  const schermen = Number.parseInt(String(r.aantal_schermen), 10);
  const status = STATUSES.includes(String(r.status)) ? String(r.status) : 'nog_open';
  return {
    locatie: String(r.locatie),
    omgeving: String(r.omgeving),
    doelgroep: String(r.doelgroep),
    startdatum: String(r.startdatum),
    einddatum: String(r.einddatum),
    aantal_schermen: Number.isFinite(schermen) && schermen > 0 ? schermen : 1,
    adverteerder: String(r.adverteerder),
    newshook: r.newshook != null ? String(r.newshook) : null,
    newshook_bron: r.newshook_bron != null ? String(r.newshook_bron) : null,
    pitchregel: r.pitchregel != null ? String(r.pitchregel) : null,
    status,
    laatst_geanalyseerd: new Date().toISOString(),
  };
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'Methode niet toegestaan.' }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Serverconfiguratie onvolledig.' }, 500);
  }

  let sessionId: string | undefined;
  try {
    const body = (await req.json()) as { session_id?: string };
    sessionId = body?.session_id;
  } catch {
    /* val door naar de check hieronder */
  }
  if (!sessionId) return json({ error: 'Geen session_id ontvangen.' }, 400);

  const client = new Anthropic({ apiKey });

  // 1. Sessie-status ophalen.
  let session;
  try {
    session = await client.beta.sessions.retrieve(sessionId);
  } catch (err) {
    return json({ status: 'failed', error: friendlyAnthropicError(err) });
  }

  if (session.status === 'running' || session.status === 'rescheduling') {
    return json({ status: 'running' });
  }
  if (session.status === 'terminated') {
    return json({
      status: 'failed',
      error:
        'De analyse is vastgelopen (sessie beëindigd). Check de sessie handmatig in de Anthropic Console.',
    });
  }

  // status === 'idle' → agent is klaar. Zoek het outputbestand.
  let outputFileId: string | undefined;
  let sawJsonFile = false;
  try {
    const list = await client.beta.files.list({
      scope_id: sessionId,
      betas: ['managed-agents-2026-04-01'],
    });
    for (const f of list.data) {
      const fn = f.filename ?? '';
      if (fn === OUTPUT_FILENAME) {
        outputFileId = f.id;
        break;
      }
      if (fn.toLowerCase().endsWith('.json')) {
        outputFileId = outputFileId ?? f.id;
        sawJsonFile = true;
      }
    }
  } catch (err) {
    return json({ status: 'failed', error: friendlyAnthropicError(err) });
  }

  if (!outputFileId) {
    // Kan indexeer-vertraging zijn (~1-3s na idle) of de agent produceerde
    // geen output. Laat de gebruiker het zo nog eens proberen.
    return json({
      status: 'running',
      note: 'Nog geen outputbestand gevonden — probeer over enkele seconden opnieuw op "Check status".',
    });
  }

  // 2. Output downloaden en parsen.
  let parsed: unknown;
  try {
    const resp = await client.beta.files.download(outputFileId);
    const text = await resp.text();
    parsed = JSON.parse(text);
  } catch {
    return json({
      status: 'failed',
      error:
        'Het outputbestand kon niet worden gelezen of is geen geldige JSON. Check het resultaat handmatig in de Anthropic Console.',
    });
  }

  if (!Array.isArray(parsed)) {
    return json({
      status: 'failed',
      error:
        'Onverwacht outputformaat (geen JSON-lijst met matches). Check het resultaat handmatig in de Anthropic Console.',
    });
  }

  const rows: CleanRow[] = [];
  for (const item of parsed) {
    if (item && typeof item === 'object') {
      const clean = normalizeRow(item as Record<string, unknown>);
      if (clean) rows.push(clean);
    }
  }

  if (rows.length === 0) {
    const hint = sawJsonFile
      ? 'De gevonden JSON bevatte geen bruikbare rijen (verplichte velden ontbreken).'
      : 'Het outputbestand bevatte geen bruikbare rijen (verplichte velden ontbreken).';
    return json({
      status: 'failed',
      error: `${hint} Check het resultaat handmatig in de Anthropic Console.`,
    });
  }

  // 3. Upsert naar Supabase op (locatie + adverteerder + startdatum).
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let inserted = 0;
  let updated = 0;
  try {
    for (const row of rows) {
      const { data: existing, error: selErr } = await supabase
        .from('match_results')
        .select('id')
        .eq('locatie', row.locatie)
        .eq('adverteerder', row.adverteerder)
        .eq('startdatum', row.startdatum)
        .limit(1);
      if (selErr) throw selErr;

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('match_results')
          .update(row)
          .eq('id', existing[0].id);
        if (error) throw error;
        updated += 1;
      } else {
        const { error } = await supabase.from('match_results').insert(row);
        if (error) throw error;
        inserted += 1;
      }
    }
  } catch {
    return json({
      status: 'failed',
      error:
        'De resultaten zijn wel geanalyseerd, maar konden niet worden opgeslagen in de database. Probeer het opnieuw.',
    });
  }

  return json({ status: 'completed', inserted, updated, total: rows.length });
};
