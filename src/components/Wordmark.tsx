interface Props {
  /** 'light' = wit (op kobalt achtergrond), 'dark' = kobalt (op witte achtergrond). */
  tone?: 'light' | 'dark';
  /** Extra classes, bijv. voor lettergrootte (text-2xl, text-3xl, …). */
  className?: string;
}

/**
 * Tekst-placeholder voor het Global-logo: rond & bold (Poppins), waarbij de
 * "O" een ring met een stip in het midden is. Kleur volgt de tekstkleur
 * (border-current / bg-current), zodat dezelfde component op zowel de kobalt
 * header als de witte login-kaart werkt. Vervang door het echte logobestand
 * zodra beschikbaar.
 */
export default function Wordmark({ tone = 'light', className = '' }: Props) {
  const color = tone === 'light' ? 'text-white' : 'text-brand-600';

  return (
    <span
      className={`flex select-none items-center font-[var(--font-display)] font-extrabold uppercase leading-none tracking-tight ${color} ${className}`}
      aria-label="Global"
    >
      GL
      <span
        aria-hidden="true"
        className="mx-[0.03em] inline-flex h-[0.74em] w-[0.74em] items-center justify-center rounded-full border-[0.13em] border-current align-middle"
      >
        <span className="h-[0.17em] w-[0.17em] rounded-full bg-current" />
      </span>
      BAL
    </span>
  );
}
