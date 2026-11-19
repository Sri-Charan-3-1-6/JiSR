'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { RiskBadge, StateBadge, fmtDateTime } from '@/components/ui';
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
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);

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
      if (res.ok) setData((prev) => (prev ? { ...prev, state: 'MATCHED' } : prev));
      else setError(d.error);
    } finally {
      setAccepting(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl card p-6">
        <p className="text-danger" role="alert">{error}</p>
        <Link href="/resident" className="mt-3 inline-block text-teal-700 underline">{tc('back')}</Link>
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto max-w-xl card p-6 text-muted">{t('loading')}</div>;
  }

  const match = matchSupport(data.risk_tier);
  const tier = data.risk_tier;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge tier={tier} />
          <StateBadge state={data.state} />
        </div>
        <h1 className="mt-3 text-xl font-bold">
          {t('scoreTitle', {
            instrument: data.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7',
            score: data.total_score,
          })}
        </h1>
        <p className="mt-2 text-sm">
          <strong>{t('whatMeans')}</strong>{' '}
          {t('meansBody', { band: tt(data.score_band) })} {t(`why.${tier}`)}
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <strong>{t('whatNotMeans')}</strong> {t('notMeansBody')}
        </p>
        <p className="mt-2 text-xs text-muted">{tc('pseudoId')}: {data.pseudo_id}</p>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">{te('title')}</h2>
        {explanation ? (
          <>
            <p className="mt-2 text-sm leading-relaxed">{explanation.text}</p>
            <p className="mt-2 text-xs text-muted">
              {explanation.source === 'llm' ? te('aiLabel') : te('templateLabel')}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">{te('loading')}</p>
        )}
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">{t('whyTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t(`why.${tier}`)}</p>
        <p className="mt-2 text-sm font-medium text-teal-800">{t(`sla.${tier}`)}</p>
        <ul className="mt-4 space-y-4">
          {match.options.map((opt) => (
            <li key={opt.key} className="rounded-lg border border-border p-4">
              <h3 className="font-semibold">{t(`options.${tier}.${opt.key}.title`)}</h3>
              <p className="mt-1 text-sm">
                <span className="font-medium">{t('eligibility')}</span>{' '}
                {t(`options.${tier}.${opt.key}.eligibility`)}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-medium">{t('handoff')}</span>{' '}
                {t(`options.${tier}.${opt.key}.handoff`)}
              </p>
            </li>
          ))}
        </ul>
        {data.state === 'SCREENED' && (
          <button onClick={accept} disabled={accepting} className="btn btn-primary mt-5 w-full">
            {accepting ? t('accepting') : t('accept')}
          </button>
        )}
        {data.state !== 'SCREENED' && (
          <p className="mt-4 text-sm text-teal-800 font-medium">{t('inProgress')}</p>
        )}
      </section>

      <section className="card p-6 text-sm">
        <h2 className="font-semibold">{t('clockTitle')}</h2>
        <ul className="mt-2 space-y-1 text-muted">
          {data.sla_contact_due && <li>{t('contactBy')} {fmtDateTime(data.sla_contact_due)}</li>}
          {data.sla_book_due && <li>{t('bookBy')} {fmtDateTime(data.sla_book_due)}</li>}
          {data.sla_followup_due && <li>{t('followupBy')} {fmtDateTime(data.sla_followup_due)}</li>}
        </ul>
        <Link href="/resident" className="mt-3 inline-block text-teal-700 underline">{t('backToFollowups')}</Link>
      </section>
    </div>
  );
}