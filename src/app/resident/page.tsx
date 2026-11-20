'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { RiskBadge, StateBadge, fmtDateTime } from '@/components/ui';
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
  const reduce = useReducedMotion();
  const [residentId, setResidentId] = useState<string | null>(null);
  const [cases, setCases] = useState<ResidentCase[]>([]);
  const [consentRequired, setConsentRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    setResidentId(id);
    if (!id) {
      setLoading(false);
      return;
    }
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
    <div className="mx-auto max-w-xl space-y-5">
      <section className="card p-6" style={{ background: 'var(--gradient-soft), var(--card)' }}>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('intro')}</p>
        <div className="mt-6 grid gap-3">
          <Link href="/resident/screen/PHQ9" className="btn btn-primary w-full text-base">
            {t('startPhq9')}
          </Link>
          <Link href="/resident/screen/GAD7" className="btn btn-outline w-full text-base">
            {t('startGad7')}
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-bold">{t('followups')}</h2>
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
                className="rounded-btn border border-border bg-surface-2/50 p-4"
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
                  className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
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