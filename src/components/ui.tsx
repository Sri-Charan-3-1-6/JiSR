import type { RiskTier } from '@/lib/matching';

export const TIER_LABELS: Record<RiskTier, string> = {
  minimal: 'Minimal',
  mild: 'Mild',
  moderate: 'Moderate',
  moderately_severe: 'Moderately severe',
  severe: 'Severe',
  crisis: 'CRITICAL — crisis',
};

const TIER_CLASSES: Record<RiskTier, string> = {
  minimal: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  mild: 'bg-lime-100 text-lime-900 border-lime-300',
  moderate: 'bg-amber-100 text-amber-900 border-amber-300',
  moderately_severe: 'bg-orange-100 text-orange-900 border-orange-300',
  severe: 'bg-red-100 text-red-900 border-red-300',
  crisis: 'bg-red-600 text-white border-red-700',
};

export function RiskBadge({ tier }: { tier: RiskTier }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIER_CLASSES[tier]}`}>
      {TIER_LABELS[tier]}
    </span>
  );
}

export const STATE_LABELS: Record<string, string> = {
  SCREENED: 'Screened',
  MATCHED: 'Matched',
  NAVIGATOR_CONTACTED: 'Navigator contacted',
  BOOKED: 'Booked',
  ATTENDED: 'Attended',
  FOLLOWED_UP_30D: 'Followed up (30d)',
};

export function StateBadge({ state }: { state: string }) {
  return (
    <span className="inline-flex rounded-full border border-border bg-white px-2.5 py-0.5 text-xs font-medium text-muted">
      {STATE_LABELS[state] ?? state}
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