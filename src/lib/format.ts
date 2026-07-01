/** Nederlandse datumnotatie, bijv. "6 jul". */
const dayMonth = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
});

/** Nederlandse datumnotatie met jaar, bijv. "6 jul 2026". */
const dayMonthYear = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Periode compact tonen: "6 – 19 jul 2026" of over jaargrens heen. */
export function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';

  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();

  if (sameMonth) {
    // "6 – 19 jul 2026"
    return `${s.getDate()} – ${dayMonthYear.format(e)}`;
  }
  if (sameYear) {
    // "10 jul – 10 aug 2026"
    return `${dayMonth.format(s)} – ${dayMonthYear.format(e)}`;
  }
  return `${dayMonthYear.format(s)} – ${dayMonthYear.format(e)}`;
}

/** Relatieve tijd, bijv. "2 dagen geleden", "vandaag". */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  const diffH = Math.floor(diffMs / 3_600_000);

  if (diffH < 1) return 'zojuist';
  if (diffH < 24) return `${diffH} uur geleden`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'gisteren';
  if (diffD < 7) return `${diffD} dagen geleden`;
  const diffW = Math.floor(diffD / 7);
  if (diffW === 1) return '1 week geleden';
  return `${diffW} weken geleden`;
}

/** Is de timestamp binnen de laatste 7 dagen? */
export function isWithinLastWeek(iso: string): boolean {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then <= 7 * 24 * 3_600_000;
}
