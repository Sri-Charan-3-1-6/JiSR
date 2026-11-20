'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { SyntheticBadge } from '@/components/header';
import { useResidentId } from '@/components/ui';
import { SkeletonCard } from '@/components/ui/skeleton';
import type { ChangeResult, WearableDay } from '@/lib/wearable';

export default function WearablePage() {
  const t = useTranslations('wearable');
  const tc = useTranslations('common');
  const reduce = useReducedMotion();
  const residentId = useResidentId();
  const [days, setDays] = useState<WearableDay[]>([]);
  const [change, setChange] = useState<ChangeResult | null>(null);
  const [consentRequired, setConsentRequired] = useState(false);
  const [fetching, setLoading] = useState(true);
  const loading = residentId === undefined || (residentId !== null && fetching);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    if (!id) return;
    fetch(`/api/residents/${id}/wearable`)
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 403 && d.consentRequired) {
          setConsentRequired(true);
          return;
        }
        if (!r.ok) throw new Error();
        setDays(d.days);
        setChange(d.change);
      })
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDemo() {
    if (!residentId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/residents/${residentId}/wearable`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setDays(d.days);
      setChange(d.change);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const fmtSleep = (v: number | null) => (v === null ? '—' : Number(v).toFixed(1));
  const fmtSteps = (v: number | null) => (v === null ? '—' : Math.round(Number(v)).toLocaleString('en-US'));

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <section className="surface-hero p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="page-heading">{t('title')}</h1>
          <SyntheticBadge />
        </div>
        <p className="mt-3 rounded-btn border border-warning/25 bg-warning-soft p-3 text-xs font-semibold text-warning">
          {t('simulatedNote')}
        </p>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{t('intro')}</p>
      </section>

      {!residentId && !loading ? (
        <section className="card p-6 text-sm text-muted">
          {t('insufficient')}{' '}
          <Link href="/resident" className="font-semibold text-primary underline">{tc('back')}</Link>
        </section>
      ) : loading ? (
        <>
          <span className="sr-only">{t('loading')}</span>
          <SkeletonCard lines={4} />
        </>
      ) : consentRequired ? (
        <section className="card space-y-3 p-6 text-sm">
          <p className="text-muted">{t('consentRequired')}</p>
          <Link href="/resident/consent" className="btn btn-primary">{t('consentLink')}</Link>
        </section>
      ) : (
        <>
          {error && (
            <p role="alert" className="card border-danger/50 p-4 text-sm text-danger">{error}</p>
          )}
          <section className="data-panel p-6 sm:p-8">
            <motion.button
              whileTap={reduce ? undefined : { scale: 0.97 }}
              onClick={loadDemo}
              disabled={busy}
              className="btn btn-outline"
            >
              {busy ? tc('saving') : t('loadDemo')}
            </motion.button>

            <div className="resident-grid mt-6 items-start gap-6 border-t border-border pt-6">
            <div className="min-w-0">
            {change && !change.insufficientData && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-btn border border-border bg-surface-2/50 p-4 sm:p-5">
                  <p className="eyebrow text-muted">{t('baseline')}</p>
                  <p className="mt-2">{t('sleep')}: <strong>{fmtSleep(change.baseline.sleep)}</strong></p>
                  <p className="mt-1">{t('steps')}: <strong>{fmtSteps(change.baseline.steps)}</strong></p>
                </div>
                <div className="rounded-btn border border-border bg-surface-2/50 p-4 sm:p-5">
                  <p className="eyebrow text-muted">{t('recent')}</p>
                  <p className="mt-2">{t('sleep')}: <strong>{fmtSleep(change.recent.sleep)}</strong></p>
                  <p className="mt-1">{t('steps')}: <strong>{fmtSteps(change.recent.steps)}</strong></p>
                </div>
              </div>
            )}

            {days.length > 0 && (
              <div className="mt-6 flex h-32 items-end gap-1 border-b border-border px-2" aria-hidden="true">
                {days.map((d, i) => (
                  <motion.div
                    key={d.day}
                    title={`${d.day}: ${fmtSleep(d.sleep_hours)} h`}
                    className="flex-1 origin-bottom rounded-t-sm bg-primary/70"
                    style={{ height: `${Math.max(4, Number(d.sleep_hours ?? 0) * 10)}px` }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.015, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </div>
            )}

            </div>
            <div className="min-w-0">
            {change?.insufficientData ? (
              <p className="mt-4 text-sm text-muted">{t('insufficient')}</p>
            ) : change?.changed ? (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-card border border-warning/30 bg-warning-soft p-6"
              >
                <h2 className="section-heading text-warning">{t('changedTitle')}</h2>
                <p className="mt-1 text-sm leading-relaxed text-warning">{t('changedBody')}</p>
                <Link href="/resident/screen/PHQ9" className="btn btn-primary mt-4 w-full">
                  {t('checkIn')}
                </Link>
              </motion.div>
            ) : change ? (
              <p className="mt-4 rounded-btn bg-success-soft p-3 text-sm font-semibold text-success">{t('noChange')}</p>
            ) : null}

            <p className="mt-5 border-s-2 border-accent ps-4 text-sm leading-relaxed text-muted">{t('neverDiagnoses')}</p>
            </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}