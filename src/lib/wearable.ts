export interface WearableDay {
  day: string;
  sleep_hours: number | null;
  steps: number | null;
  resting_hr: number | null;
}

export interface ChangeResult {
  changed: boolean;
  insufficientData: boolean;
  reason: 'sleep' | 'activity' | 'both' | null;
  baseline: { sleep: number | null; steps: number | null };
  recent: { sleep: number | null; steps: number | null };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Compares the last 3 days against the person's OWN earlier baseline.
// Only ever used to INVITE a screening — never to diagnose or score.
export function detectChange(days: WearableDay[]): ChangeResult {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const empty: ChangeResult = {
    changed: false,
    insufficientData: true,
    reason: null,
    baseline: { sleep: null, steps: null },
    recent: { sleep: null, steps: null },
  };
  if (sorted.length < 10) return empty;
  const recentDays = sorted.slice(-3);
  const baselineDays = sorted.slice(0, -3);
  const num = (v: number | null) => (v === null ? null : Number(v));
  const baseline = {
    sleep: avg(baselineDays.map((d) => num(d.sleep_hours)).filter((v): v is number => v !== null)),
    steps: avg(baselineDays.map((d) => num(d.steps)).filter((v): v is number => v !== null)),
  };
  const recent = {
    sleep: avg(recentDays.map((d) => num(d.sleep_hours)).filter((v): v is number => v !== null)),
    steps: avg(recentDays.map((d) => num(d.steps)).filter((v): v is number => v !== null)),
  };
  const sleepDrop = baseline.sleep !== null && recent.sleep !== null && recent.sleep < 0.75 * baseline.sleep;
  const activityDrop = baseline.steps !== null && recent.steps !== null && recent.steps < 0.6 * baseline.steps;
  const reason = sleepDrop && activityDrop ? 'both' : sleepDrop ? 'sleep' : activityDrop ? 'activity' : null;
  return { changed: reason !== null, insufficientData: false, reason, baseline, recent };
}