import { supabase } from './supabase';
import type { MatchResult, MatchStatus } from '../types';

const TABLE = 'match_results';

/** Alle matches ophalen, gesorteerd op recentheid van analyse. */
export async function fetchMatches(): Promise<MatchResult[]> {
  if (!supabase) {
    throw new Error('Supabase is niet geconfigureerd (env-vars ontbreken).');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('startdatum', { ascending: true })
    .order('laatst_geanalyseerd', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MatchResult[];
}

/**
 * Leest de onthouden, mogelijk nog niet verwerkte analyse-sessie uit
 * app_settings (gezet door start-analysis, gewist door check-analysis-status).
 * Geeft null als er geen openstaande sessie is.
 */
export async function getPendingAnalysisSessionId(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'pending_analysis_session_id')
    .maybeSingle();
  if (error) return null;
  const value = (data as { value?: string } | null)?.value;
  return value && value.length > 0 ? value : null;
}

/** Status van één match bijwerken in Supabase. */
export async function updateMatchStatus(
  id: string,
  status: MatchStatus,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is niet geconfigureerd (env-vars ontbreken).');
  }

  const { error } = await supabase
    .from(TABLE)
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}
