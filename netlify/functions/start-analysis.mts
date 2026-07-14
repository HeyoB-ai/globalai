import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: start-analysis
 *
 * Ontvangt een geüpload .xlsx-bestand (multipart/form-data, veld "file")
 * met lege advertentieslots, uploadt het naar de Anthropic Files API, en start
 * een sessie op de bestaande Global Sales Assistant agent + environment.
 *
 * Elke sessie krijgt ALTIJD twee bestanden gemount:
 *   1. Het geüploade SLOTS-bestand      → /mnt/session/uploads/<naam>
 *   2. De vaste ACCOUNTLIJST (Accounts) → /mnt/session/accounts/accounts.xlsx
 *
 * De accountlijst-file_id komt uit Supabase (app_settings.accounts_file_id),
 * met de env var ANTHROPIC_ACCOUNTS_FILE_ID als fallback/bootstrap. Zo kan de
 * lijst via /admin worden vervangen zonder redeploy.
 *
 * BELANGRIJK: deze functie WACHT NIET tot de agent klaar is — ze start de
 * sessie en returnt direct (ruim binnen Netlify's ~10s timeout).
 */

const UPLOAD_DIR = '/mnt/session/uploads';
const ACCOUNTS_MOUNT = '/mnt/session/accounts/accounts.xlsx';
const OUTPUT_PATH = '/mnt/session/outputs/match_results.json';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Alleen de bestandsnaam, zonder padscheidingstekens (path-traversal-veilig). */
function safeName(raw: string): string {
  const base = (raw.split(/[\\/]/).pop() ?? '').trim();
  return base.length > 0 ? base : 'analyse.xlsx';
}

function friendlyAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return 'Anthropic-authenticatie mislukt — controleer ANTHROPIC_API_KEY.';
  if (err instanceof Anthropic.PermissionDeniedError)
    return 'Geen toegang tot deze agent of environment.';
  if (err instanceof Anthropic.NotFoundError)
    return 'Agent, environment of accountlijst-bestand niet gevonden — controleer ANTHROPIC_AGENT_ID, ANTHROPIC_ENVIRONMENT_ID en de accountlijst-file_id.';
  if (err instanceof Anthropic.RateLimitError)
    return 'Te veel aanvragen bij Anthropic (rate limit). Probeer het over een minuut opnieuw.';
  if (err instanceof Anthropic.APIError)
    return 'Er ging iets mis bij het benaderen van de agent. Probeer het opnieuw of check de Anthropic Console.';
  return 'Onverwachte fout bij het starten van de analyse.';
}

/**
 * Haalt de file_id van de actieve accountlijst op: eerst uit Supabase
 * (app_settings.accounts_file_id), dan uit de env var als fallback. Geeft null
 * als geen van beide een waarde heeft.
 */
async function resolveAccountsFileId(): Promise<string | null> {
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
      if (!error && data?.value) return data.value;
    } catch {
      /* val door naar de env var-fallback */
    }
  }
  return process.env.ANTHROPIC_ACCOUNTS_FILE_ID ?? null;
}

/** Instructie aan de agent: analyseer met accountlijst-only + vast JSON-formaat. */
function kickoffMessage(slotsPath: string, accountsPath: string): string {
  return [
    'Er staan twee Excel-bestanden voor je klaar:',
    `- SLOTS-bestand (de te analyseren lege advertentieslots): ${slotsPath}`,
    `- ACCOUNTLIJST (echte, bestaande bedrijven — de ENIGE toegestane adverteerders): ${accountsPath}`,
    '',
    'Lees eerst de volledige accountlijst in. Koppel vervolgens elk geschikt slot',
    'aan één of meer adverteerders UIT DE ACCOUNTLIJST (nooit zelf verzinnen), met',
    'per bedrijf een actuele, bedrijfsspecifieke newshook. Sla slots over waar geen',
    'enkel bedrijf uit de lijst goed bij past.',
    '',
    `Schrijf het eindresultaat als één JSON-array naar ${OUTPUT_PATH}.`,
    'Eén object per (slot × voorgesteld bedrijf). Elk object MOET exact deze velden bevatten:',
    '- locatie (string)',
    '- omgeving (string) — bijv. Treinstation, Sportschool, Winkelcentrum, Luchthaven',
    '- doelgroep (string)',
    '- startdatum (string, formaat YYYY-MM-DD)',
    '- einddatum (string, formaat YYYY-MM-DD)',
    '- aantal_schermen (geheel getal)',
    '- adverteerder (string) — EXACT de bedrijfsnaam zoals in de accountlijst',
    '- newshook (string) — bedrijfsspecifiek; laat leeg als er geen actuele haak is',
    '- newshook_bron (string) — url of bronnaam',
    '- pitchregel (string)',
    "- status (één van: nog_open, benaderd, gescoord, afgewezen — gebruik nog_open als default)",
    '',
    'Schrijf uitsluitend geldige JSON naar dat bestand — geen markdown, geen',
    'commentaar, geen tekst eromheen. Als een waarde onbekend is, gebruik een',
    'lege string (of 1 voor aantal_schermen).',
  ].join('\n');
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

  // 0. Accountlijst-file_id ophalen (verplicht — zonder lijst geen analyse).
  const accountsFileId = await resolveAccountsFileId();
  if (!accountsFileId) {
    return json(
      {
        error:
          'Geen accountlijst geconfigureerd. Upload eerst een accountlijst via /admin, of zet ANTHROPIC_ACCOUNTS_FILE_ID.',
      },
      500,
    );
  }

  // 1. Bestand uit de multipart-body halen.
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return json({ error: 'Kon het geüploade bestand niet lezen.' }, 400);
  }
  if (!file) return json({ error: 'Geen bestand ontvangen.' }, 400);

  const name = safeName(file.name || 'analyse.xlsx');
  if (!name.toLowerCase().endsWith('.xlsx')) {
    return json({ error: 'Alleen .xlsx-bestanden worden geaccepteerd.' }, 400);
  }

  const client = new Anthropic({ apiKey });

  try {
    // 2. Upload het slots-bestand naar de Files API.
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await client.beta.files.upload({
      file: await toFile(buffer, name, { type: XLSX_MIME }),
      purpose: 'agent',
    });

    // 3. Sessie starten met BEIDE bestanden gemount. Dit blokkeert alleen tot de
    //    mounts klaar zijn en returnt daarna — het wacht NIET op de agent.
    const slotsPath = `${UPLOAD_DIR}/${name}`;
    const session = await client.beta.sessions.create({
      agent: agentId,
      environment_id: environmentId,
      title: `Excel-analyse: ${name}`,
      resources: [
        { type: 'file', file_id: uploaded.id, mount_path: slotsPath },
        { type: 'file', file_id: accountsFileId, mount_path: ACCOUNTS_MOUNT },
      ],
    });

    // 4. Analyse starten via één user.message dat naar beide bestanden verwijst.
    await client.beta.sessions.events.send(session.id, {
      events: [
        {
          type: 'user.message',
          content: [
            { type: 'text', text: kickoffMessage(slotsPath, ACCOUNTS_MOUNT) },
          ],
        },
      ],
    });

    return json({ session_id: session.id, filename: name });
  } catch (err) {
    return json({ error: friendlyAnthropicError(err) }, 502);
  }
};
