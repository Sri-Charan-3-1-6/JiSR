'use client';

import { useTranslations } from 'next-intl';
import type { RiskTier } from '@/lib/matching';

const TIER_CLASSES: Record<RiskTier, string> = {
  minimal: 'bg-success-soft text-success border-success/30',
  mild: 'bg-lime-100 text-lime-900 border-lime-300 dark:bg-lime-950 dark:text-lime-200 dark:border-lime-800',
  moderate: 'bg-warning-soft text-warning border-warning/30',
  moderately_severe: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800',
  severe: 'bg-danger-soft text-danger border-danger/30',
  crisis: 'bg-danger text-white border-danger dark:text-[#2a0d0b]',
};

export function RiskBadge({ tier }: { tier: RiskTier }) {
  const t = useTranslations('tiers');
  return (
    <span className={`inline-flex rounded-pill border px-2.5 py-1 text-xs font-semibold leading-none ${TIER_CLASSES[tier]}`}>
      {t(tier)}
    </span>
  );
}

export function StateBadge({ state }: { state: string }) {
  const t = useTranslations('states');
  return (
    <span className="inline-flex rounded-pill border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium leading-none text-muted">
      {t.has(state) ? t(state) : state}
    </span>
  );
}

export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// node-postgres parses PG interval into an object; raw psql gives text.
// Accept both shapes.
export function intervalToMs(
  iv: string | { days?: number; hours?: number; minutes?: number; seconds?: number; milliseconds?: number } | null | undefined,
): number {
  if (!iv) return 0;
  if (typeof iv === 'object') {
    return (
      ((iv.days ?? 0) * 24 + (iv.hours ?? 0)) * 3600_000 +
      (iv.minutes ?? 0) * 60_000 +
      (iv.seconds ?? 0) * 1000 +
      (iv.milliseconds ?? 0)
    );
  }
  const m = iv.match(/(?:(\d+) days? )?(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  return ((Number(m[1] ?? 0) * 24 + Number(m[2])) * 3600 + Number(m[3]) * 60 + Number(m[4])) * 1000;
}

export function fmtDuration(ms: number): string {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400_000);
  const hours = Math.floor((abs % 86400_000) / 3600_000);
  const mins = Math.floor((abs % 3600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}