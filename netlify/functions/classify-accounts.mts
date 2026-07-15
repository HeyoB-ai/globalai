import Anthropic from '@anthropic-ai/sdk';
import {
  CLASSIFY_ACCOUNTS_MOUNT,
  DEFAULT_CLASSIFY_BATCH,
  buildClassifyKickoff,
  fetchKnownAdvertisers,
  resolveAccountsFileId,
} from './_classify.mts';

/**
 * Netlify Function: classify-accounts
 *
 * Start ÉÉN batch van de sectorclassificatie. Mount de actieve Accounts.xlsx in
 * een Managed Agent-sessie en laat de agent de eerstvolgende ~25 nog niet
 * geclassificeerde bedrijven classificeren (sector + doelgroep + korte
 * beschrijving). De agent schrijft het resultaat naar een JSON-outputbestand;
 * check-classification-status haalt dat op en upsert't het in account_profiles.
 *
 * Net als start-analysis WACHT deze functie NIET op de agent — ze start de
 * sessie en returnt direct het session_id. De frontend polt daarna en start
 * zo nodig een volgende batch tot alle bedrijven bekend zijn.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function friendlyAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return 'Anthropic-authenticatie mislukt — controleer ANTHROPIC_API_KEY.';
  if (err instanceof Anthropic.PermissionDeniedError)
    return 'Geen toegang tot deze agent of environment.';
  if (err instanceof Anthropic.NotFoundError)
    return 'Agent, environment of accountlijst-bestand niet gevonden.';
  if (err instanceof Anthropic.RateLimitError)
    return 'Te veel aanvragen bij Anthropic (rate limit). Probeer het zo opnieuw.';
  if (err instanceof Anthropic.APIError)
    return 'Er ging iets mis bij het benaderen van de agent. Probeer het opnieuw.';
  return 'Onverwachte fout bij het starten van de classificatie.';
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'Methode niet toegestaan.' }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const agentId = process.env.ANTHROPIC_AGENT_ID;
  const environmentId = process.env.ANTHROPIC_ENVIRONMENT_ID;
  if (!apiKey || !agentId || !environmentId) {
    return json(
      { error: 'Serverconfiguratie onvolledig (Anthropic env vars ontbreken).' },
      500,
    );
  }

  // Optionele batchgrootte uit de body (default 25).
  let batch = DEFAULT_CLASSIFY_BATCH;
  try {
    const body = (await req.json()) as { batch_size?: number };
    if (Number.isFinite(body?.batch_size) && (body!.batch_size as number) > 0) {
      batch = Math.min(50, Math.floor(body!.batch_size as number));
    }
  } catch {
    /* geen body → default */
  }

  // 1. Actieve accountlijst-file_id ophalen (verplicht).
  const accountsFileId = await resolveAccountsFileId();
  if (!accountsFileId) {
    return json(
      {
        error:
          'Geen accountlijst geconfigureerd. Upload eerst een accountlijst via /admin.',
      },
      400,
    );
  }

  // 2. Reeds geclassificeerde bedrijven ophalen (worden overgeslagen).
  const known = await fetchKnownAdvertisers();

  const client = new Anthropic({ apiKey });

  try {
    // 3. Sessie starten met alleen de accountlijst gemount.
    const session = await client.beta.sessions.create({
      agent: agentId,
      environment_id: environmentId,
      title: `Sectorclassificatie (batch ${batch})`,
      resources: [
        {
          type: 'file',
          file_id: accountsFileId,
          mount_path: CLASSIFY_ACCOUNTS_MOUNT,
        },
      ],
    });

    // 4. Classificatie-opdracht sturen.
    await client.beta.sessions.events.send(session.id, {
      events: [
        {
          type: 'user.message',
          content: [
            { type: 'text', text: buildClassifyKickoff(known, batch) },
          ],
        },
      ],
    });

    return json({ session_id: session.id, known_before: known.length });
  } catch (err) {
    return json({ error: friendlyAnthropicError(err) }, 502);
  }
};
