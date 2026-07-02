import Anthropic, { toFile } from '@anthropic-ai/sdk';

/**
 * Netlify Function: start-analysis
 *
 * Ontvangt een geüpload .xlsx-bestand (multipart/form-data, veld "file"),
 * uploadt het naar de Anthropic Files API, start een sessie op de bestaande
 * Global Sales Assistant agent + environment, mount het bestand op
 * /mnt/session/uploads/<naam>, en stuurt één user.message om de analyse te
 * starten. Geeft de session_id terug.
 *
 * BELANGRIJK: deze functie WACHT NIET tot de agent klaar is — ze start de
 * sessie en returnt direct (ruim binnen Netlify's ~10s timeout).
 */

const UPLOAD_DIR = '/mnt/session/uploads';
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
    return 'Agent of environment niet gevonden — controleer ANTHROPIC_AGENT_ID en ANTHROPIC_ENVIRONMENT_ID.';
  if (err instanceof Anthropic.RateLimitError)
    return 'Te veel aanvragen bij Anthropic (rate limit). Probeer het over een minuut opnieuw.';
  if (err instanceof Anthropic.APIError)
    return 'Er ging iets mis bij het benaderen van de agent. Probeer het opnieuw of check de Anthropic Console.';
  return 'Onverwachte fout bij het starten van de analyse.';
}

/** Instructie aan de agent: analyseer + schrijf een vast JSON-formaat weg. */
function kickoffMessage(mountPath: string): string {
  return [
    `Er is een Excel-bestand gemount op ${mountPath}.`,
    'Voer de standaard slot-analyse uit: koppel lege advertentieslots aan',
    'potentiële adverteerders en actuele newshooks.',
    '',
    `Schrijf het eindresultaat als één JSON-array naar ${OUTPUT_PATH}.`,
    'Elk object MOET exact deze velden bevatten:',
    '- locatie (string)',
    '- omgeving (string) — bijv. Treinstation, Sportschool, Winkelcentrum, Luchthaven',
    '- doelgroep (string)',
    '- startdatum (string, formaat YYYY-MM-DD)',
    '- einddatum (string, formaat YYYY-MM-DD)',
    '- aantal_schermen (geheel getal)',
    '- adverteerder (string)',
    '- newshook (string)',
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
    // 2. Upload naar de Files API.
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await client.beta.files.upload({
      file: await toFile(buffer, name, { type: XLSX_MIME }),
      purpose: 'agent',
    });

    // 3. Sessie starten met het bestand gemount. Dit blokkeert alleen tot de
    //    mount klaar is en returnt daarna — het wacht NIET op de agent.
    const mountPath = `${UPLOAD_DIR}/${name}`;
    const session = await client.beta.sessions.create({
      agent: agentId,
      environment_id: environmentId,
      title: `Excel-analyse: ${name}`,
      resources: [{ type: 'file', file_id: uploaded.id, mount_path: mountPath }],
    });

    // 4. Analyse starten via één user.message.
    await client.beta.sessions.events.send(session.id, {
      events: [
        {
          type: 'user.message',
          content: [{ type: 'text', text: kickoffMessage(mountPath) }],
        },
      ],
    });

    return json({ session_id: session.id, filename: name });
  } catch (err) {
    return json({ error: friendlyAnthropicError(err) }, 502);
  }
};
