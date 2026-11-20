'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RiskBadge, StateBadge, fmtDateTime } from '@/components/ui';
import { ProgressRing } from '@/components/ui/progress-ring';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { matchSupport, type RiskTier } from '@/lib/matching';

interface CaseData {
  id: string;
  risk_tier: RiskTier;
  state: string;
  instrument: string;
  total_score: number;
  score_band: string;
  created_at: string;
  sla_contact_due: string | null;
  sla_book_due: string | null;
  sla_followup_due: string | null;
  pseudo_id: string;
}

interface Explanation {
  text: string;
  source: 'llm' | 'template';
}

export default function ResultClient({ id }: { id: string }) {
  const t = useTranslations('result');
  const te = useTranslations('explain');
  const tc = useTranslations('common');
  const tt = useTranslations('tiers');
  const locale = useLocale();
  const reduce = useReducedMotion();
  const toast = useToast();
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [openOption, setOpenOption] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? t('loadError'));
        setData(d.case);
        return d.case as CaseData;
      })
      .then(async (c) => {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instrument: c.instrument,
            total: c.total_score,
            band: c.score_band,
            language: locale,
          }),
        });
        if (res.ok) setExplanation(await res.json());
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, locale]);

  async function accept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/cases/${id}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState: 'MATCHED' }),
      });
      const d = await res.json();
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, state: 'MATCHED' } : prev));
        toast(tc('saved'));
      } else setError(d.error);
    } finally {
      setAccepting(false);
    }
  }

  if (error) {
    return (
      <div className="data-panel mx-auto max-w-2xl p-6 sm:p-8">
        <p className="text-danger" role="alert">{error}</p>
        <Link href="/resident" className="mt-3 inline-block font-medium text-primary underline">{tc('back')}</Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <span className="sr-only">{t('loading')}</span>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  const match = matchSupport(data.risk_tier);
  const tier = data.risk_tier;
  const maxScore = data.instrument === 'PHQ9' ? 27 : 21;
  const expanded = openOption ?? match.options[0]?.key ?? null;
  const stagger = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <motion.section {...stagger(0)} className="surface-hero p-6 sm:p-8 lg:p-10">
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto] sm:gap-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge tier={tier} />
              <StateBadge state={data.state} />
            </div>
            <h1 className="page-heading mt-5">
              {t('scoreTitle', {
                instrument: data.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7',
                score: data.total_score,
              })}
            </h1>
            <p className="mt-4 break-all font-mono text-xs text-muted">{tc('pseudoId')}: {data.pseudo_id}</p>
          </div>
          <div className="flex justify-center rounded-card border border-border bg-card p-5 sm:p-6">
            <ProgressRing
              value={data.total_score}
              max={maxScore}
              label={String(data.total_score)}
              sublabel={tt(data.score_band)}
            />
          </div>
        </div>
        <div className="mt-8 grid gap-4 border-t border-border pt-6 md:grid-cols-2">
          <motion.div {...stagger(1)} className="text-base leading-relaxed">
            <h2 className="mb-2 font-semibold text-primary-strong">{t('whatMeans')}</h2>
            <p>{t('meansBody', { band: tt(data.score_band) })} {t(`why.${tier}`)}</p>
          </motion.div>
          <motion.div {...stagger(2)} className="rounded-btn border border-warning/25 bg-warning-soft p-5 text-sm leading-relaxed text-warning">
            <h2 className="mb-2 font-semibold">{t('whatNotMeans')}</h2>
            <p>{t('notMeansBody')}</p>
          </motion.div>
        </div>
      </motion.section>

      <div className="resident-grid items-start gap-6">
      <motion.section {...stagger(3)} className="data-panel min-w-0 p-6 sm:p-7 lg:col-start-2 lg:row-start-1">
        <h2 className="section-heading">{te('title')}</h2>
        {explanation ? (
          <>
            <p className="mt-2 text-sm leading-relaxed">{explanation.text}</p>
            <p className="mt-3 text-xs text-muted">
              {explanation.source === 'llm' ? te('aiLabel') : te('templateLabel')}
            </p>
          </>
        ) : (
          <div className="mt-3 space-y-2" aria-label={te('loading')}>
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        )}
      </motion.section>

      <motion.section {...stagger(4)} id="match" className="data-panel min-w-0 scroll-mt-24 p-6 sm:p-7 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <h2 className="section-heading">{t('whyTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t(`why.${tier}`)}</p>
        <p className="mt-4 rounded-btn bg-primary/10 p-4 text-sm font-semibold leading-relaxed text-primary-strong">{t(`sla.${tier}`)}</p>
        <ul className="mt-4 space-y-3">
          {match.options.map((opt, i) => {
            const open = expanded === opt.key;
            return (
              <motion.li key={opt.key} {...stagger(5 + i)} className="overflow-hidden rounded-btn border border-border">
                <button
                  onClick={() => setOpenOption(open ? '' : opt.key)}
                  aria-expanded={open}
                  className="flex min-h-16 w-full items-center justify-between gap-3 p-5 text-start font-semibold leading-relaxed transition-colors duration-150 hover:bg-surface-2"
                  style={{ minHeight: 44 }}
                >
                  {t(`options.${tier}.${opt.key}.title`)}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={`shrink-0 text-muted transition-transform duration-250 ${open ? 'rotate-180' : ''}`}
                  >
                    <path d="M4 6 L8 10 L12 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="space-y-4 border-t border-border bg-surface-2/50 px-5 py-5 text-sm leading-relaxed">
                        <p>
                          <span className="font-semibold">{t('eligibility')}</span>{' '}
                          {t(`options.${tier}.${opt.key}.eligibility`)}
                        </p>
                        <p>
                          <span className="font-semibold">{t('handoff')}</span>{' '}
                          {t(`options.${tier}.${opt.key}.handoff`)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
        {data.state === 'SCREENED' && (
          <motion.button
            whileTap={reduce ? undefined : { scale: 0.97 }}
            onClick={accept}
            disabled={accepting}
            className="btn btn-primary mt-5 w-full"
          >
            {accepting ? t('accepting') : t('accept')}
          </motion.button>
        )}
        {data.state !== 'SCREENED' && (
          <p className="mt-4 rounded-btn bg-success-soft p-3 text-sm font-semibold text-success">{t('inProgress')}</p>
        )}
      </motion.section>

      <motion.section {...stagger(7)} className="data-panel min-w-0 p-6 text-sm sm:p-7 lg:col-start-2">
        <h2 className="section-heading">{t('clockTitle')}</h2>
        <ul className="mt-5 space-y-3 text-muted">
          {data.sla_contact_due && <li className="timeline-item p-4">{t('contactBy')} <strong className="mt-1 block font-semibold text-foreground">{fmtDateTime(data.sla_contact_due)}</strong></li>}
          {data.sla_book_due && <li className="timeline-item p-4">{t('bookBy')} <strong className="mt-1 block font-semibold text-foreground">{fmtDateTime(data.sla_book_due)}</strong></li>}
          {data.sla_followup_due && <li className="timeline-item p-4">{t('followupBy')} <strong className="mt-1 block font-semibold text-foreground">{fmtDateTime(data.sla_followup_due)}</strong></li>}
        </ul>
        <Link href="/resident" className="mt-5 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">{t('backToFollowups')}</Link>
      </motion.section>
      </div>
    </div>
  );
}