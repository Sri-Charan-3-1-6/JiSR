'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Stat, CountUp } from '@/components/ui/stat';
import { SkeletonCard } from '@/components/ui/skeleton';
import type { CompareRow } from '@/components/charts';

const CompareChart = dynamic(() => import('@/components/charts').then((m) => m.CompareChart), {
  ssr: false,
  loading: () => <div className="skeleton h-56 w-full" />,
});

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
const pctFmt = (v: number) => `${v.toFixed(1)}%`;
const daysFmt = (v: number) => `${v.toFixed(1)} d`;

function AnimatedPct({ value, active }: { value: number; active?: boolean }) {
  return (
    <CountUp
      value={value * 100}
      format={pctFmt}
      className={active ? 'font-semibold text-primary' : ''}
    />
  );
}

export default function HealthSystemPage() {
  const t = useTranslations('health');
  const reduce = useReducedMotion();
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
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return (
      <div className="space-y-4">
        <span className="sr-only">{t('loading')}</span>
        <SkeletonCard lines={2} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <SkeletonCard lines={6} />
      </div>
    );
  }
  if (error || !metrics) {
    return (
      <div role="alert" className="card border-danger/50 p-6 text-sm text-danger">
        {error ?? t('error')}
      </div>
    );
  }

  const chartRows: CompareRow[] =
    simulation?.simRows.map((r) => ({ group: r.group, current: r.m, simulated: r.simM })) ?? [];

  return (
    <div className="space-y-6">
      <section className="card p-6" style={{ background: 'var(--gradient-soft), var(--card)' }}>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('intro', { n: residentsTotal ?? '—' })}</p>
        <Link href="/employer" className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline">
          {t('employerLink')}
        </Link>
      </section>

      <section aria-label="Pathway metrics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={t('screenToMatch')}
          value={pct(metrics.screen_to_match_rate)}
          numericValue={num(metrics.screen_to_match_rate) === null ? undefined : Number(metrics.screen_to_match_rate) * 100}
          format={pctFmt}
          hint={t('screenToMatchHint', { matched: metrics.matched_total, total: metrics.cases_total })}
        />
        <Stat
          label={t('matchToBooked')}
          value={pct(metrics.match_to_booked_sla_rate)}
          numericValue={num(metrics.match_to_booked_sla_rate) === null ? undefined : Number(metrics.match_to_booked_sla_rate) * 100}
          format={pctFmt}
          hint={t('matchToBookedHint')}
        />
        <Stat
          label={t('bookedToAttended')}
          value={pct(metrics.booked_to_attended_rate)}
          numericValue={num(metrics.booked_to_attended_rate) === null ? undefined : Number(metrics.booked_to_attended_rate) * 100}
          format={pctFmt}
        />
        <Stat
          label={t('medianFollowup')}
          value={days(metrics.median_days_to_followup)}
          numericValue={num(metrics.median_days_to_followup) ?? undefined}
          format={daysFmt}
        />
        <Stat
          label={t('medianWait')}
          value={days(metrics.median_waiting_days)}
          numericValue={num(metrics.median_waiting_days) ?? undefined}
          format={daysFmt}
          hint={t('medianWaitHint')}
        />
        <Stat
          label={t('crisisCompletion')}
          value={pct(metrics.crisis_response_completion)}
          numericValue={num(metrics.crisis_response_completion) === null ? undefined : Number(metrics.crisis_response_completion) * 100}
          format={pctFmt}
          hint={t('crisisCompletionHint', { responded: metrics.crisis_responded, total: metrics.crisis_total })}
        />
        <Stat
          label={t('adverse')}
          value={metrics.adverse_missed_crisis_callbacks}
          numericValue={Number(metrics.adverse_missed_crisis_callbacks)}
          hint={t('adverseHint')}
          alert={Number(metrics.adverse_missed_crisis_callbacks) > 0}
        />
        <Stat
          label={t('improved')}
          value={pct(improvement?.improvement_rate)}
          numericValue={num(improvement?.improvement_rate) === null ? undefined : Number(improvement?.improvement_rate) * 100}
          format={pctFmt}
          hint={
            improvement
              ? t('improvedHint', {
                  improved: improvement.improved,
                  paired: improvement.paired_residents,
                  reduction: improvement.avg_score_reduction ?? '—',
                })
              : undefined
          }
        />
      </section>

      <section className="card p-6">
        <h2 className="font-bold">{t('fairnessTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('fairnessNote')}</p>
        <div className="mt-4 space-y-6">
          {dimensions.map(({ dim, rows }) => (
            <div key={dim}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
                {t(`dimensions.${dim}`)}
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-start text-xs text-muted">
                      <th className="py-2 pe-3 text-start">{t('group')}</th>
                      <th className="py-2 pe-3 text-start">{t('n')}</th>
                      <th className="py-2 pe-3 text-start">{t('screenToMatch')}</th>
                      <th className="py-2 pe-3 text-start">{t('matchToBooked')}</th>
                      <th className="py-2 pe-3 text-start">{t('bookedToAttended')}</th>
                      <th className="py-2 pe-3 text-start">{t('medianWait')}</th>
                      <th className="py-2 text-start">{t('gapFlag')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={r.group_value}
                        className={`border-b border-border/60 transition-colors duration-150 hover:bg-surface-2/60 ${
                          r.is_gap ? 'bg-danger-soft/40' : r.is_gap_booked ? 'bg-warning-soft/40' : ''
                        }`}
                        style={
                          r.is_gap
                            ? { borderInlineStart: '3px solid var(--danger)' }
                            : r.is_gap_booked
                              ? { borderInlineStart: '3px solid var(--warning)' }
                              : undefined
                        }
                      >
                        <td className="py-2.5 pe-3 font-semibold">{r.group_value}</td>
                        <td className="py-2.5 pe-3 tabular-nums">{r.n}</td>
                        <td className="py-2.5 pe-3">
                          <span className="tabular-nums">{pct(r.screen_to_match)}</span>
                          <span className="ms-1 text-xs text-muted">
                            ({t('best', { value: pct(r.best_screen_to_match) })})
                          </span>
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-pill bg-surface-2">
                            <motion.div
                              className={`h-full w-full origin-left rounded-pill rtl:origin-right ${r.is_gap ? 'bg-danger/70' : 'bg-primary'}`}
                              initial={reduce ? false : { scaleX: 0 }}
                              animate={{ scaleX: Number(r.screen_to_match) }}
                              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 pe-3 tabular-nums">{pct(r.match_to_booked_sla)}</td>
                        <td className="py-2.5 pe-3 tabular-nums">{pct(r.booked_to_attended)}</td>
                        <td className="py-2.5 pe-3 tabular-nums">{days(r.median_waiting_days)}</td>
                        <td className="py-2.5">
                          <span className="flex flex-wrap gap-1">
                            {r.is_gap && <Badge tone="danger">{t('gapMatch')}</Badge>}
                            {r.is_gap_booked && <Badge tone="warning">{t('gapBook')}</Badge>}
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
                          <td className="py-2.5 pe-3 font-semibold">{s.group_value}</td>
                          <td className="py-2.5 pe-3" title={t('suppressedTitle')}><span dir="ltr">&lt;10</span></td>
                          <td className="py-2.5 pe-3">—</td>
                          <td className="py-2.5 pe-3">—</td>
                          <td className="py-2.5 pe-3">—</td>
                          <td className="py-2.5 pe-3">—</td>
                          <td className="py-2.5 text-xs">{t('hiddenPrivacy')}</td>
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
          <h2 className="font-bold">{t('whatIfTitle')}</h2>
          <Badge tone="warning">{t('simBadge')}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted">{t('whatIfIntro')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-btn border p-4 transition-colors duration-250 ${langOutreach ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
            <input
              type="checkbox"
              checked={langOutreach}
              onChange={(e) => setLangOutreach(e.target.checked)}
              className="mt-1 h-5 w-5 accent-(--primary)"
            />
            <span>
              <span className="font-semibold">{t('interventionA')}</span>
              <span className="block text-xs leading-relaxed text-muted">{t('interventionADesc')}</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-btn border p-4 transition-colors duration-250 ${flexSlots ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
            <input
              type="checkbox"
              checked={flexSlots}
              onChange={(e) => setFlexSlots(e.target.checked)}
              className="mt-1 h-5 w-5 accent-(--primary)"
            />
            <span>
              <span className="font-semibold">{t('interventionB')}</span>
              <span className="block text-xs leading-relaxed text-muted">{t('interventionBDesc')}</span>
            </span>
          </label>
        </div>
        {simulation && (
          <div className="mt-5">
            <CompareChart
              rows={chartRows}
              currentLabel={t('now')}
              simulatedLabel={t('simulated')}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-2 pe-3 text-start">{t('languageGroup')}</th>
                    <th className="py-2 pe-3 text-start">{t('screenToMatch')} ({t('now')})</th>
                    <th className="py-2 pe-3 text-start">{t('screenToMatch')} ({t('simulated')})</th>
                    <th className="py-2 pe-3 text-start">{t('matchToBooked')} ({t('now')})</th>
                    <th className="py-2 text-start">{t('matchToBooked')} ({t('simulated')})</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.simRows.map((r) => (
                    <tr key={r.group} className="border-b border-border/60">
                      <td className="py-2.5 pe-3 font-semibold">{r.group}</td>
                      <td className="py-2.5 pe-3 tabular-nums">{pct(r.m)}</td>
                      <td className="py-2.5 pe-3"><AnimatedPct value={r.simM} active={langOutreach} /></td>
                      <td className="py-2.5 pe-3 tabular-nums">{pct(r.b)}</td>
                      <td className="py-2.5"><AnimatedPct value={r.simB} active={flexSlots} /></td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2.5 pe-3">{t('overall')}</td>
                    <td className="py-2.5 pe-3 tabular-nums">{pct(simulation.baseMatch)}</td>
                    <td className="py-2.5 pe-3"><AnimatedPct value={simulation.simMatch} active={langOutreach} /></td>
                    <td className="py-2.5 pe-3 tabular-nums">{pct(simulation.baseBooked)}</td>
                    <td className="py-2.5"><AnimatedPct value={simulation.simBooked} active={flexSlots} /></td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">{t('simFootnote')}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}