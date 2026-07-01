import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'brand' | 'warning';
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-400',
  brand: 'bg-brand-50 text-brand-700',
  warning: 'bg-amber-50 text-amber-600',
} as const;

export default function EmptyState({
  icon,
  title,
  children,
  action,
  tone = 'neutral',
}: Props) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-14 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${TONES[tone]}`}
      >
        {icon}
      </div>
      <h2 className="mt-5 font-[var(--font-display)] text-lg font-bold text-slate-900">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
