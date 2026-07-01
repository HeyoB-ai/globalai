import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Veilige helper om omgevingsvariabelen op te halen zonder crash in
 * verschillende JS-runtimes (zelfde patroon als het Greenspeed-project).
 */
const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key as keyof ImportMetaEnv];
    }
  } catch {
    /* negeer */
  }
  return undefined;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

/** True zodra beide env-vars gezet zijn; gebruikt voor de config-melding. */
export const isSupabaseConfigured =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.length > 0 &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 0;

/**
 * Supabase-client. `null` wanneer de env-vars ontbreken, zodat de app een
 * nette melding kan tonen in plaats van te crashen.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
