/**
 * Client voor de Netlify Functions die de Excel-analyse aansturen.
 * De Anthropic API-key zit uitsluitend in die functions, nooit hier.
 */

const BASE = '/.netlify/functions';

export interface StartResult {
  session_id: string;
  filename: string;
}

export type AnalysisStatus = 'running' | 'completed' | 'failed';

export interface StatusResult {
  status: AnalysisStatus;
  inserted?: number;
  updated?: number;
  total?: number;
  note?: string;
  error?: string;
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Start een nieuwe analyse door het .xlsx-bestand te uploaden. */
export async function startAnalysis(file: File): Promise<StartResult> {
  const form = new FormData();
  form.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${BASE}/start-analysis`, { method: 'POST', body: form });
  } catch {
    throw new Error('Geen verbinding met de server. Controleer je internet.');
  }

  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error || 'De analyse kon niet worden gestart.');
  }
  if (!data?.session_id) {
    throw new Error('Onverwacht antwoord van de server bij het starten.');
  }
  return data as StartResult;
}

/** Vraag de status van een lopende analyse op. */
export async function checkAnalysisStatus(
  sessionId: string,
): Promise<StatusResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/check-analysis-status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch {
    throw new Error('Geen verbinding met de server. Controleer je internet.');
  }

  const data = await safeJson(res);
  // De function geeft bij 'failed' een 200 met status-veld; alleen echte
  // serverfouten zonder status behandelen we als harde fout.
  if (!data?.status) {
    throw new Error(data?.error || 'De status kon niet worden opgehaald.');
  }
  return data as StatusResult;
}
