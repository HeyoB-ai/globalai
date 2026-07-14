import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: update-accounts
 *
 * Beheer-endpoint (aangeroepen vanuit /admin). Ontvangt een nieuwe
 * accountlijst als .xlsx (multipart/form-data, veld "file"), uploadt die naar
 * de Anthropic Files API, en slaat de nieuwe file_id op in Supabase
 * (app_settings.accounts_file_id). Vanaf dat moment gebruikt elke nieuwe
 * analyse-sessie automatisch de nieuwe lijst — géén redeploy nodig.
 *
 * Schrijven gebeurt met de service-role key (omzeilt RLS); die key staat alleen
 * in de Netlify-omgeving, nooit in de frontend.
 */

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function safeName(raw: string): string {
  const base = (raw.split(/[\\/]/).pop() ?? '').trim();
  return base.length > 0 ? base : 'Accounts.xlsx';
}

function friendlyAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return 'Anthropic-authenticatie mislukt — controleer ANTHROPIC_API_KEY.';
  if (err instanceof Anthropic.RateLimitError)
    return 'Te veel aanvragen bij Anthropic (rate limit). Probeer het zo opnieuw.';
  if (err instanceof Anthropic.APIError)
    return 'Er ging iets mis bij het uploaden naar Anthropic. Probeer het opnieuw.';
  return 'Onverwachte fout bij het bijwerken van de accountlijst.';
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

  const name = safeName(file.name || 'Accounts.xlsx');
  if (!name.toLowerCase().endsWith('.xlsx')) {
    return json({ error: 'Alleen .xlsx-bestanden worden geaccepteerd.' }, 400);
  }

  const client = new Anthropic({ apiKey });

  // 2. Upload de nieuwe accountlijst naar de Files API.
  let fileId: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await client.beta.files.upload({
      file: await toFile(buffer, name, { type: XLSX_MIME }),
      purpose: 'agent',
    });
    fileId = uploaded.id;
  } catch (err) {
    return json({ error: friendlyAnthropicError(err) }, 502);
  }

  // 3. Nieuwe file_id opslaan in Supabase (bron van waarheid voor start-analysis).
  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.from('app_settings').upsert(
      {
        key: 'accounts_file_id',
        value: fileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
    if (error) throw error;
  } catch (err) {
    const e = err as { message?: string; code?: string };
    console.error('[update-accounts] Supabase-schrijffout:', {
      code: e?.code,
      message: e?.message,
    });
    return json(
      {
        error:
          'De lijst is wel geüpload naar Anthropic, maar kon niet als actief worden opgeslagen. Probeer het opnieuw.',
      },
      502,
    );
  }

  return json({ file_id: fileId, filename: name });
};
