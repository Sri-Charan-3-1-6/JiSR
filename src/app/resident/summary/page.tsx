'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { RiskBadge, StateBadge, fmtDateTime, useResidentId } from '@/components/ui';
import { SyntheticBadge } from '@/components/header';
import { SkeletonCard } from '@/components/ui/skeleton';
import type { RiskTier } from '@/lib/matching';

interface Screening {
  instrument: string;
  total_score: number;
  band: string;
  created_at: string;
}
interface Flags {
  physical_conditions: string[] | null;
  sleep_flag: boolean;
  pain_flag: boolean;
}
interface CaseRow {
  risk_tier: RiskTier;
  state: string;
  created_at: string;
}
interface SummaryData {
  resident: { pseudo_id: string; language: string };
  screenings: Screening[];
  flags: Flags | null;
  cases: CaseRow[];
  fhir: unknown;
}

export default function SummaryPage() {
  const t = useTranslations('summary');
  const tc = useTranslations('common');
  const tt = useTranslations('tiers');
  const reduce = useReducedMotion();
  const [data, setData] = useState<SummaryData | null>(null);
  const [consentRequired, setConsentRequired] = useState(false);
  const residentId = useResidentId();
  const noResident = residentId === null;
  const [error, setError] = useState<string | null>(null);
  const [fetching, setLoading] = useState(true);
  const loading = residentId === undefined || (residentId !== null && fetching);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    if (!id) return;
    fetch(`/api/residents/${id}/summary`)
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 403 && d.consentRequired) {
          setConsentRequired(true);
          return;
        }
        if (!r.ok) throw new Error();
        setData(d);
      })
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadFhir() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.fhir, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jisr-${data.resident.pseudo_id}-fhir.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <span className="sr-only">{t('loading')}</span>
        <SkeletonCard lines={6} />
      </div>
    );
  }
  if (noResident || consentRequired) {
    return (
      <div className="surface-hero mx-auto max-w-2xl space-y-4 p-6 text-base sm:p-8">
        <h1 className="page-heading">{t('title')}</h1>
        <p className="text-muted">{noResident ? t('noScreenings') : t('consentRequired')}</p>
        <Link href={noResident ? '/resident' : '/resident/consent'} className="btn btn-primary">
          {noResident ? tc('back') : t('consentLink')}
        </Link>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div role="alert" className="card mx-auto max-w-xl border-danger/50 p-6 text-sm text-danger">
        {error ?? t('error')}
      </div>
    );
  }

  const maxScore = Math.max(1, ...data.screenings.map((s) => s.total_score));

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none">
      <section className="surface-hero p-6 sm:p-8 lg:p-10 print:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="page-heading">{t('title')}</h1>
          <SyntheticBadge />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{t('intro')}</p>
        <p className="mt-2 font-mono text-xs text-muted">
          {t('generatedAt', { date: fmtDateTime(new Date()), id: data.resident.pseudo_id })}
        </p>
        <p className="mt-3 rounded-btn border border-warning/25 bg-warning-soft p-3 text-xs leading-relaxed text-warning">
          {tc('screeningNotDiagnosis')}
        </p>

      </section>
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-6 print:hidden">
        <button onClick={() => window.print()} className="btn btn-primary">
          {t('print')}
        </button>
        <button onClick={downloadFhir} className="btn btn-outline">
          {t('downloadFhir')}
        </button>
        <p className="max-w-xl text-xs leading-relaxed text-muted">{t('interoperable')}</p>
      </div>
      <div className="resident-grid items-start gap-6 print:block print:space-y-5">
      <section className="data-panel min-w-0 p-6 sm:p-7 print:p-5">
        <h2 className="section-heading">{t('trend')}</h2>
        {data.screenings.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t('noScreenings')}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.screenings.map((s, i) => (
              <li key={i} className="border-b border-border pb-4 text-sm last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {s.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} · <strong>{s.total_score}</strong>
                    {tt.has(s.band) ? ` (${tt(s.band)})` : ''}
                  </span>
                  <span className="text-xs text-muted">{fmtDateTime(s.created_at)}</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-pill bg-surface-2">
                  <motion.div
                    className="h-full w-full origin-left rounded-pill rtl:origin-right"
                    style={{ background: 'var(--gradient-brand)' }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: s.total_score / maxScore }}
                    transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

      </section>
      <section className="data-panel min-w-0 p-6 sm:p-7 print:p-5">
        <h2 className="section-heading">{t('conditions')}</h2>
        <p className="mt-1 text-sm text-muted">
          {data.flags?.physical_conditions?.length
            ? data.flags.physical_conditions.join(', ')
            : t('noneRecorded')}
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <p className="rounded-btn bg-surface-2 p-3">
            <span className="font-semibold">{t('sleepFlag')}:</span>{' '}
            {data.flags?.sleep_flag ? t('yes') : t('no')}
          </p>
          <p className="rounded-btn bg-surface-2 p-3">
            <span className="font-semibold">{t('painFlag')}:</span>{' '}
            {data.flags?.pain_flag ? t('yes') : t('no')}
          </p>
        </div>

        <h2 className="section-heading mt-7 border-t border-border pt-6">{t('followupStatus')}</h2>
        {data.cases.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t('noneRecorded')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.cases.map((c, i) => (
              <li key={i} className="timeline-item flex flex-wrap items-center gap-2 p-4 text-sm">
                <RiskBadge tier={c.risk_tier} />
                <StateBadge state={c.state} />
                <span className="text-xs text-muted">{fmtDateTime(c.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}