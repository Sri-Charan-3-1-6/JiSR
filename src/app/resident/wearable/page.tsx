'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SyntheticBadge } from '@/components/header';
import type { ChangeResult, WearableDay } from '@/lib/wearable';

export default function WearablePage() {
  const t = useTranslations('wearable');
  const tc = useTranslations('common');
  const [residentId, setResidentId] = useState<string | null>(null);
  const [days, setDays] = useState<WearableDay[]>([]);
  const [change, setChange] = useState<ChangeResult | null>(null);
  const [consentRequired, setConsentRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    setResidentId(id);
    if (!id) {
      setLoading(false);
      return;
    }
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
    <div className="mx-auto max-w-xl space-y-5">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <SyntheticBadge />
        </div>
        <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs font-semibold text-amber-900">
          {t('simulatedNote')}
        </p>
        <p className="mt-2 text-sm text-muted">{t('intro')}</p>
      </section>

      {!residentId && !loading ? (
        <section className="card p-6 text-sm text-muted">
          {t('insufficient')}{' '}
          <Link href="/resident" className="text-teal-700 underline">{tc('back')}</Link>
        </section>
      ) : loading ? (
        <section className="card p-6 text-sm text-muted">{t('loading')}</section>
      ) : consentRequired ? (
        <section className="card space-y-3 p-6 text-sm">
          <p className="text-muted">{t('consentRequired')}</p>
          <Link href="/resident/consent" className="btn btn-primary">{t('consentLink')}</Link>
        </section>
      ) : (
        <>
          {error && (
            <p role="alert" className="card border-danger p-4 text-sm text-danger">{error}</p>
          )}
          <section className="card p-6">
            <button onClick={loadDemo} disabled={busy} className="btn btn-outline w-full">
              {busy ? tc('saving') : t('loadDemo')}
            </button>

            {change && !change.insufficientData && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted">{t('baseline')}</p>
                  <p className="mt-1">{t('sleep')}: <strong>{fmtSleep(change.baseline.sleep)}</strong></p>
                  <p>{t('steps')}: <strong>{fmtSteps(change.baseline.steps)}</strong></p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted">{t('recent')}</p>
                  <p className="mt-1">{t('sleep')}: <strong>{fmtSleep(change.recent.sleep)}</strong></p>
                  <p>{t('steps')}: <strong>{fmtSteps(change.recent.steps)}</strong></p>
                </div>
              </div>
            )}

            {days.length > 0 && (
              <div className="mt-4 flex items-end gap-0.5" aria-hidden="true">
                {days.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${fmtSleep(d.sleep_hours)} h`}
                    className="flex-1 rounded-t bg-teal-700/70"
                    style={{ height: `${Math.max(4, Number(d.sleep_hours ?? 0) * 10)}px` }}
                  />
                ))}
              </div>
            )}

            {change?.insufficientData ? (
              <p className="mt-4 text-sm text-muted">{t('insufficient')}</p>
            ) : change?.changed ? (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <h2 className="font-semibold text-amber-900">{t('changedTitle')}</h2>
                <p className="mt-1 text-sm text-amber-900">{t('changedBody')}</p>
                <Link href="/resident/screen/PHQ9" className="btn btn-primary mt-3 w-full">
                  {t('checkIn')}
                </Link>
              </div>
            ) : change ? (
              <p className="mt-4 text-sm font-medium text-emerald-700">{t('noChange')}</p>
            ) : null}

            <p className="mt-4 text-xs text-muted">{t('neverDiagnoses')}</p>
          </section>
        </>
      )}
    </div>
  );
}