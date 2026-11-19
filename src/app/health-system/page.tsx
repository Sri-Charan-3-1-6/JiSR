'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface Metrics {
  cases_total: string;
  matched_total: string;
  screen_to_match_rate: string | null;
  match_to_booked_sla_rate: string | null;
  booked_to_attended_rate: string | null;
  median_days_to_followup: string | null;
  median_waiting_days: string | null;
  crisis_total: string;
  crisis_responded: string;
  crisis_response_completion: string | null;
  adverse_missed_crisis_callbacks: string;
}
interface Improvement {
  paired_residents: string;
  avg_score_reduction: string | null;
  improved: string;
  improvement_rate: string | null;
}
interface FairnessRow {
  dimension: string;
  group_value: string;
  n: string;
  screen_to_match: string;
  match_to_booked_sla: string | null;
  booked_to_attended: string | null;
  median_waiting_days: string | null;
  best_screen_to_match: string;
  is_gap: boolean;
  best_match_to_booked: string | null;
  is_gap_booked: boolean;
}

const DIMENSION_LABELS: Record<string, string> = {
  language: 'Language',
  age_band: 'Age band',
  gender: 'Gender',
  nationality: 'Nationality group',
  area: 'Area',
};

const num = (v: string | number | null | undefined) =>
  v === null || v === undefined ? null : Number(v);
const pct = (v: string | number | null | undefined) => {
  const n = num(v);
  return n === null ? '—' : `${(n * 100).toFixed(1)}%`;
};
const days = (v: string | number | null | undefined) => {
  const n = num(v);
  return n === null ? '—' : `${n.toFixed(1)} d`;
};

function MetricCard({ label, value, hint, alert }: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className={`card p-4 ${alert ? 'border-danger' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? 'text-danger' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function HealthSystemPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [improvement, setImprovement] = useState<Improvement | null>(null);
  const [fairness, setFairness] = useState<FairnessRow[]>([]);
  const [suppressed, setSuppressed] = useState<{ dimension: string; group_value: string }[]>([]);
  const [residentsTotal, setResidentsTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [langOutreach, setLangOutreach] = useState(false);
  const [flexSlots, setFlexSlots] = useState(false);

  useEffect(() => {
    fetch('/api/gapfinder')
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setMetrics(d.metrics);
        setImprovement(d.improvement);
        setFairness(d.fairness);
        setSuppressed(d.suppressed ?? []);
        setResidentsTotal(d.counts?.residents_total ?? null);
      })
      .catch(() => setError('Could not load dashboard data. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const dimensions = useMemo(() => {
    const order = ['language', 'age_band', 'gender', 'nationality', 'area'];
    return order
      .map((dim) => ({ dim, rows: fairness.filter((r) => r.dimension === dim) }))
      .filter((d) => d.rows.length > 0);
  }, [fairness]);

  // Deterministic what-if simulation on the language dimension.
  // Intervention A: language-matched outreach closes 60% of each group's
  // screen-to-match gap vs the best group. Intervention B: flexible booking
  // slots close 50% of the booking-conversion gap. No AI, no randomness.
  const simulation = useMemo(() => {
    const rows = fairness.filter((r) => r.dimension === 'language');
    if (rows.length === 0 || !metrics) return null;
    const totalN = rows.reduce((s, r) => s + Number(r.n), 0);
    const baseMatch = Number(metrics.screen_to_match_rate ?? 0);
    const baseBooked = Number(metrics.match_to_booked_sla_rate ?? 0);
    const bestMatch = Math.max(...rows.map((r) => Number(r.screen_to_match)));
    const bestBooked = Math.max(...rows.map((r) => Number(r.match_to_booked_sla ?? 0)));

    const simRows = rows.map((r) => {
      const n = Number(r.n);
      const m = Number(r.screen_to_match);
      const b = Number(r.match_to_booked_sla ?? 0);
      const simM = langOutreach ? m + 0.6 * (bestMatch - m) : m;
      const simB = flexSlots ? b + 0.5 * (bestBooked - b) : b;
      return { group: r.group_value, n, m, b, simM, simB };
    });
    const simMatch = simRows.reduce((s, r) => s + r.n * r.simM, 0) / totalN;
    const matchedWeight = simRows.reduce((s, r) => s + r.n * r.simM, 0);
    const simBooked =
      simRows.reduce((s, r) => s + r.n * r.simM * r.simB, 0) / matchedWeight;
    return { simRows, baseMatch, baseBooked, simMatch, simBooked };
  }, [fairness, metrics, langOutreach, flexSlots]);

  if (loading) {
    return <div className="card mx-auto max-w-xl p-6 text-sm text-muted">Loading dashboard…</div>;
  }
  if (error || !metrics) {
    return (
      <div role="alert" className="card mx-auto max-w-xl border-danger p-6 text-sm text-danger">
        {error ?? 'No data available.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h1 className="text-xl font-bold">Gap Finder — Health-System dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          Where do people fall out of the pathway from screening to follow-up? Seeded synthetic
          dataset of {residentsTotal ?? '—'} residents with deliberately injected gaps. All
          metrics come from SQL views; groups smaller than 10 are suppressed inside the views.
        </p>
        <Link href="/employer" className="mt-2 inline-block text-sm font-medium text-teal-700 underline">
          See the employer-safe view (aggregates only)
        </Link>
      </section>

      <section aria-label="Pathway metrics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Screen → match" value={pct(metrics.screen_to_match_rate)}
          hint={`${metrics.matched_total} of ${metrics.cases_total} cases matched`} />
        <MetricCard label="Match → booked in SLA" value={pct(metrics.match_to_booked_sla_rate)}
          hint="Booked within the risk-tier deadline" />
        <MetricCard label="Booked → attended" value={pct(metrics.booked_to_attended_rate)} />
        <MetricCard label="Median time to follow-up" value={days(metrics.median_days_to_followup)} />
        <MetricCard label="Median waiting time" value={days(metrics.median_waiting_days)}
          hint="Screening to booking" />
        <MetricCard label="Crisis-response completion" value={pct(metrics.crisis_response_completion)}
          hint={`${metrics.crisis_responded} of ${metrics.crisis_total} crisis cases contacted`} />
        <MetricCard label="Adverse events" value={metrics.adverse_missed_crisis_callbacks}
          hint="Missed crisis callbacks past SLA"
          alert={Number(metrics.adverse_missed_crisis_callbacks) > 0} />
        <MetricCard label="Improved at 30 days" value={pct(improvement?.improvement_rate)}
          hint={
            improvement
              ? `${improvement.improved} of ${improvement.paired_residents} re-screened · avg score −${improvement.avg_score_reduction ?? '—'}`
              : undefined
          } />
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Fairness table — conversion vs the best group</h2>
        <p className="mt-1 text-sm text-muted">
          A group is flagged as a gap when its conversion is below 80% of the best group in the
          same dimension. Groups under 10 are hidden to protect privacy. Only residents who
          consented to anonymous aggregate statistics are counted.
        </p>
        <div className="mt-4 space-y-6">
          {dimensions.map(({ dim, rows }) => (
            <div key={dim}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {DIMENSION_LABELS[dim] ?? dim}
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="py-2 pr-3">Group</th>
                      <th className="py-2 pr-3">n</th>
                      <th className="py-2 pr-3">Screen → match</th>
                      <th className="py-2 pr-3">Match → booked (SLA)</th>
                      <th className="py-2 pr-3">Booked → attended</th>
                      <th className="py-2 pr-3">Median wait</th>
                      <th className="py-2">Gap flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.group_value} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-medium">{r.group_value}</td>
                        <td className="py-2 pr-3">{r.n}</td>
                        <td className="py-2 pr-3">
                          {pct(r.screen_to_match)}
                          <span className="ml-1 text-xs text-muted">
                            (best {pct(r.best_screen_to_match)})
                          </span>
                        </td>
                        <td className="py-2 pr-3">{pct(r.match_to_booked_sla)}</td>
                        <td className="py-2 pr-3">{pct(r.booked_to_attended)}</td>
                        <td className="py-2 pr-3">{days(r.median_waiting_days)}</td>
                        <td className="py-2">
                          <span className="flex flex-wrap gap-1">
                            {r.is_gap && (
                              <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800 border border-red-200">
                                GAP: matching
                              </span>
                            )}
                            {r.is_gap_booked && (
                              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 border border-amber-200">
                                GAP: booking
                              </span>
                            )}
                            {!r.is_gap && !r.is_gap_booked && (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {suppressed
                      .filter((s) => s.dimension === dim)
                      .map((s) => (
                        <tr key={`sup-${s.group_value}`} className="border-b border-border/60 text-muted">
                          <td className="py-2 pr-3 font-medium">{s.group_value}</td>
                          <td className="py-2 pr-3" title="Suppressed: fewer than 10 people">&lt;10</td>
                          <td className="py-2 pr-3">—</td>
                          <td className="py-2 pr-3">—</td>
                          <td className="py-2 pr-3">—</td>
                          <td className="py-2 pr-3">—</td>
                          <td className="py-2 text-xs">Hidden to protect privacy</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">What-if panel</h2>
          <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Simulation, not a real result
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Toggle an intervention to see a deterministic, simulated improvement on the language
          groups. This is a planning illustration — no real effect is measured or claimed.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={langOutreach}
              onChange={(e) => setLangOutreach(e.target.checked)}
              className="mt-1 h-5 w-5 accent-teal-700"
            />
            <span>
              <span className="font-medium">Language-matched navigator outreach</span>
              <span className="block text-xs text-muted">
                Simulates closing 60% of each language group&apos;s screen-to-match gap vs the best group.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={flexSlots}
              onChange={(e) => setFlexSlots(e.target.checked)}
              className="mt-1 h-5 w-5 accent-teal-700"
            />
            <span>
              <span className="font-medium">Flexible evening / weekend booking slots</span>
              <span className="block text-xs text-muted">
                Simulates closing 50% of each language group&apos;s booking-conversion gap.
              </span>
            </span>
          </label>
        </div>
        {simulation && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 pr-3">Language group</th>
                  <th className="py-2 pr-3">Screen → match (now)</th>
                  <th className="py-2 pr-3">Screen → match (simulated)</th>
                  <th className="py-2 pr-3">Match → booked (now)</th>
                  <th className="py-2">Match → booked (simulated)</th>
                </tr>
              </thead>
              <tbody>
                {simulation.simRows.map((r) => (
                  <tr key={r.group} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{r.group}</td>
                    <td className="py-2 pr-3">{pct(r.m)}</td>
                    <td className={`py-2 pr-3 ${langOutreach ? 'font-semibold text-teal-700' : ''}`}>
                      {pct(r.simM)}
                    </td>
                    <td className="py-2 pr-3">{pct(r.b)}</td>
                    <td className={`py-2 ${flexSlots ? 'font-semibold text-teal-700' : ''}`}>
                      {pct(r.simB)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 pr-3">Overall (weighted)</td>
                  <td className="py-2 pr-3">{pct(simulation.baseMatch)}</td>
                  <td className={`py-2 pr-3 ${langOutreach ? 'text-teal-700' : ''}`}>
                    {pct(simulation.simMatch)}
                  </td>
                  <td className="py-2 pr-3">{pct(simulation.baseBooked)}</td>
                  <td className={`py-2 ${flexSlots ? 'text-teal-700' : ''}`}>
                    {pct(simulation.simBooked)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              Simulation, not a real result. Deterministic arithmetic on the seeded synthetic
              data; no model, no randomness.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}