import type { ReactNode } from 'react';

type Tone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success' | 'accent';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  primary: 'bg-primary/10 text-primary-strong border-primary/25',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
  success: 'bg-success-soft text-success border-success/25',
  accent: 'bg-card text-accent border-accent/25',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-semibold leading-none ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}