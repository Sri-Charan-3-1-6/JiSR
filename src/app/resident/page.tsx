'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { RiskBadge, StateBadge, fmtDateTime, useResidentId } from '@/components/ui';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { RiskTier } from '@/lib/matching';

interface ResidentCase {
  id: string;
  risk_tier: RiskTier;
  state: string;
  created_at: string;
  instrument: string | null;
  total_score: number | null;
}

export default function ResidentHome() {
  const t = useTranslations('resident');
  const tc = useTranslations('common');
  const tcheck = useTranslations('checkin');
  const reduce = useReducedMotion();
  const residentId = useResidentId();
  const [cases, setCases] = useState<ResidentCase[]>([]);
  const [consentRequired, setConsentRequired] = useState(false);
  const [fetching, setLoading] = useState(true);
  const loading = residentId === undefined || (residentId !== null && fetching);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    if (!id) return;
    fetch(`/api/residents/${id}/cases`)
      .then((r) => r.json())
      .then((d) => {
        setCases(d.cases ?? []);
        setConsentRequired(Boolean(d.consentRequired));
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="resident-grid mx-auto max-w-5xl items-start gap-6 lg:gap-8">
      <div className="min-w-0 space-y-5">
        <section className="surface-hero overflow-hidden p-6 sm:p-8 lg:p-10">
          <svg aria-hidden="true" viewBox="0 0 64 40" fill="none" className="mb-8 h-10 w-16 text-accent">
            <path d="M4 34h56M10 34V20a22 22 0 0 1 44 0v14M20 34V20a12 12 0 0 1 24 0v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h1 className="page-heading max-w-lg">{t('title')}</h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">{t('intro')}</p>
          <div className="mt-8 grid gap-3">
            <Link href="/resident/screen/PHQ9" className="feature-link group flex items-center gap-4 bg-card text-start font-semibold">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/10 text-primary">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" /></svg>
              </span>
              <span className="flex-1">{t('startPhq9')}</span>
              <span aria-hidden="true" className="text-primary rtl:rotate-180">→</span>
            </Link>
            <Link href="/resident/screen/GAD7" className="feature-link group flex items-center gap-4 bg-card text-start font-semibold">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-accent/10 text-accent">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 9c3-5 5 5 8 0s5 5 8 0M4 15c3-5 5 5 8 0s5 5 8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
              <span className="flex-1">{t('startGad7')}</span>
              <span aria-hidden="true" className="text-primary rtl:rotate-180">→</span>
            </Link>
          </div>
        </section>
        <section className="data-panel p-5 sm:p-6">
          <Link href="/resident/companion" className="feature-link flex items-center gap-3 font-semibold text-primary-strong">
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0"><path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 10h8m-8 4h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <span className="flex-1">{tcheck('openCompanion')}</span>
            <span aria-hidden="true" className="rtl:rotate-180">→</span>
          </Link>
          <Link href="/resident/calm" className="feature-link mt-3 flex items-center gap-3 font-semibold text-primary-strong">
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>
            <span className="flex-1">{tcheck('openCalm')}</span>
            <span aria-hidden="true" className="rtl:rotate-180">→</span>
          </Link>
          <Link href="/resident/checkin" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-muted underline-offset-4 hover:text-primary hover:underline">
            {t('checkinLink')}
          </Link>
        </section>
      </div>

      <section className="data-panel min-w-0 p-6 sm:p-8">
        <h2 className="section-heading">{t('followups')}</h2>
        {loading ? (
          <div className="mt-3">
            <span className="sr-only">{tc('loading')}</span>
            <SkeletonCard lines={2} />
          </div>
        ) : consentRequired ? (
          <p className="mt-3 rounded-btn bg-warning-soft p-3 text-sm text-warning">
            {t('consentOff')}{' '}
            <Link href="/resident/consent" className="font-semibold underline">
              {t('consentLink')}
            </Link>
          </p>
        ) : cases.length === 0 ? (
          <div className="mt-3">
            <EmptyState title={t('noneYet')} />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {cases.map((c, i) => (
              <motion.li
                key={c.id}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="timeline-item p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge tier={c.risk_tier} />
                  <StateBadge state={c.state} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {t('scoreLine', {
                    instrument: c.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7',
                    score: c.total_score ?? '—',
                    date: fmtDateTime(c.created_at),
                  })}
                </p>
                <Link
                  href={`/resident/result/${c.id}`}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {t('viewResult')}
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
        {residentId && <p className="mt-4 text-xs text-muted">{t('deviceNote')}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/resident/consent" className="btn btn-outline px-3 py-2 text-sm">
            {t('consentLink')}
          </Link>
          <Link href="/resident/summary" className="btn btn-outline px-3 py-2 text-sm">
            {t('summaryLink')}
          </Link>
          <Link href="/resident/wearable" className="btn btn-outline px-3 py-2 text-sm">
            {t('wearableLink')}
          </Link>
        </div>
      </section>
    </div>
  );
}