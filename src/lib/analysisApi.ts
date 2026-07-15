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

export interface UpdateAccountsResult {
  file_id: string;
  filename: string;
}

/**
 * Uploadt een nieuwe accountlijst (.xlsx) en maakt die de actieve lijst.
 * Gebruikt door het /admin-scherm.
 */
export async function updateAccounts(file: File): Promise<UpdateAccountsResult> {
  const form = new FormData();
  form.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${BASE}/update-accounts`, { method: 'POST', body: form });
  } catch {
    throw new Error('Geen verbinding met de server. Controleer je internet.');
  }

  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error || 'De accountlijst kon niet worden bijgewerkt.');
  }
  if (!data?.file_id) {
    throw new Error('Onverwacht antwoord van de server bij het uploaden.');
  }
  return data as UpdateAccountsResult;
}

export interface ClassifyStartResult {
  session_id: string;
  known_before: number;
}

export interface ClassifyStatusResult {
  status: AnalysisStatus;
  added?: number;
  known_after?: number;
  total_in_list?: number | null;
  remaining?: number | null;
  note?: string;
  error?: string;
}

/** Start één classificatie-batch (sectorclassificatie van de accountlijst). */
export async function startClassification(): Promise<ClassifyStartResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/classify-accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
  } catch {
    throw new Error('Geen verbinding met de server. Controleer je internet.');
  }
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error || 'De classificatie kon niet worden gestart.');
  }
  if (!data?.session_id) {
    throw new Error('Onverwacht antwoord van de server bij het starten.');
  }
  return data as ClassifyStartResult;
}

/** Vraag de status van een lopende classificatie-batch op. */
export async function checkClassificationStatus(
  sessionId: string,
): Promise<ClassifyStatusResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/check-classification-status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch {
    throw new Error('Geen verbinding met de server. Controleer je internet.');
  }
  const data = await safeJson(res);
  if (!data?.status) {
    throw new Error(data?.error || 'De status kon niet worden opgehaald.');
  }
  return data as ClassifyStatusResult;
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
