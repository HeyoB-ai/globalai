import { createClient } from '@supabase/supabase-js';

/**
 * Gedeelde helper om de "in behandeling zijnde" analyse-sessie te onthouden in
 * Supabase (app_settings.pending_analysis_session_id). Zo kan het dashboard bij
 * heropenen/verversen een reeds voltooide maar nog niet verwerkte sessie
 * herkennen en alsnog laten verwerken — ook als de gebruiker het "Nieuwe
 * analyse"-venster sloot of de pagina ververste.
 *
 * Onderstreept-prefix (_session): support-bestand, geen eigen Netlify Function.
 * Schrijven met de service-role key (omzeilt RLS); lezen doet de frontend zelf
 * met de anon/authenticated key (app_settings heeft een SELECT-policy).
 */

export const PENDING_SESSION_KEY = 'pending_analysis_session_id';

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Onthoud de zojuist gestarte analyse-sessie (best-effort; faalt stil). */
export async function setPendingAnalysisSession(
  sessionId: string,
): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;
  try {
    await supabase.from('app_settings').upsert(
      {
        key: PENDING_SESSION_KEY,
        value: sessionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  } catch {
    /* best-effort: een mislukte schrijf mag de analyse niet blokkeren */
  }
}

/**
 * Wis de onthouden sessie — maar UITSLUITEND als de opgeslagen waarde exact deze
 * sessie is. Zo wist het verwerken van een oude sessie niet per ongeluk een
 * nieuwere, nog lopende analyse die inmiddels is gestart.
 */
export async function clearPendingAnalysisSession(
  sessionId: string,
): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', PENDING_SESSION_KEY)
      .maybeSingle();
    if ((data as { value?: string } | null)?.value !== sessionId) return;
    await supabase.from('app_settings').upsert(
      {
        key: PENDING_SESSION_KEY,
        value: '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
  } catch {
    /* best-effort */
  }
}
