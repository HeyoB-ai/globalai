import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  CLASSIFY_OUTPUT_FILENAME,
  extractClassifyOutput,
} from './_classify.mts';

/**
 * Netlify Function: check-classification-status
 *
 * Ontvangt { session_id } van een classificatie-batch en vraagt de sessie-
 * status op bij Anthropic.
 * - running/rescheduling → { status: "running" }
 * - terminated           → { status: "failed" }
 * - idle (klaar)         → download account_profiles.json, upsert de profielen
 *                          naar Supabase (account_profiles), en geef voortgang:
 *                          { status: "completed", added, known_after,
 *                            total_in_list, remaining }
 *
 * Upsert op de primary key `advertiser`. Schrijven met de service-role key
 * (omzeilt RLS) — die key staat alleen in de Netlify-omgeving.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function friendlyAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return 'Anthropic-authenticatie mislukt — controleer ANTHROPIC_API_KEY.';
  if (err instanceof Anthropic.NotFoundError)
    return 'De classificatie-sessie is niet gevonden.';
  if (err instanceof Anthropic.RateLimitError)
    return 'Te veel aanvragen bij Anthropic (rate limit). Probeer het zo opnieuw.';
  if (err instanceof Anthropic.APIError)
    return 'Er ging iets mis bij het ophalen van de status. Probeer het opnieuw.';
  return 'Onverwachte fout bij het ophalen van de status.';
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
        'De classificatie is vastgelopen (sessie beëindigd). Check de sessie in de Anthropic Console.',
    });
  }

  // status === 'idle' → agent klaar. Zoek het outputbestand.
  let outputFileId: string | undefined;
  try {
    const list = await client.beta.files.list({
      scope_id: sessionId,
      betas: ['managed-agents-2026-04-01'],
    });
    for (const f of list.data) {
      const fn = f.filename ?? '';
      if (fn === CLASSIFY_OUTPUT_FILENAME) {
        outputFileId = f.id;
        break;
      }
      if (fn.toLowerCase().endsWith('.json')) {
        outputFileId = outputFileId ?? f.id;
      }
    }
  } catch (err) {
    return json({ status: 'failed', error: friendlyAnthropicError(err) });
  }

  if (!outputFileId) {
    return json({
      status: 'running',
      note: 'Nog geen outputbestand gevonden — probeer het over enkele seconden opnieuw.',
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
        'Het classificatie-outputbestand kon niet worden gelezen of is geen geldige JSON.',
    });
  }

  const { totalInList, profiles } = extractClassifyOutput(parsed);

  // 3. Upsert de profielen naar Supabase (op primary key advertiser).
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (profiles.length > 0) {
      const { error: upsertErr } = await supabase
        .from('account_profiles')
        .upsert(profiles, { onConflict: 'advertiser', ignoreDuplicates: false });
      if (upsertErr) throw upsertErr;
    }
  } catch (err) {
    const e = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    console.error('[check-classification-status] Supabase-schrijffout:', {
      code: e?.code,
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
    });
    return json({
      status: 'failed',
      error:
        'De bedrijven zijn wel geclassificeerd, maar konden niet worden opgeslagen. Probeer het opnieuw.',
    });
  }

  // 4. Actuele telling ophalen voor de voortgang in de UI.
  let knownAfter = 0;
  try {
    const { count } = await supabase
      .from('account_profiles')
      .select('advertiser', { count: 'exact', head: true });
    knownAfter = count ?? 0;
  } catch {
    /* telling is best-effort */
  }

  const remaining =
    totalInList != null ? Math.max(0, totalInList - knownAfter) : null;

  return json({
    status: 'completed',
    added: profiles.length,
    known_after: knownAfter,
    total_in_list: totalInList,
    remaining,
  });
};
