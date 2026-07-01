import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface Props {
  message: string;
  onDismiss: () => void;
}

/** Kleine, niet-blokkerende bevestiging onderin het scherm. */
export default function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 2600);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
    >
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      {message}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Melding sluiten"
        className="ml-1 text-slate-400 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
