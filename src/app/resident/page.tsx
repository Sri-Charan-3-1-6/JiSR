'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RiskBadge, StateBadge, fmtDateTime } from '@/components/ui';
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
    <div className="mx-auto max-w-xl space-y-6">
      <section className="card p-6">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('intro')}</p>
        <div className="mt-5 grid gap-3">
          <Link href="/resident/screen/PHQ9" className="btn btn-primary w-full">
            {t('startPhq9')}
          </Link>
          <Link href="/resident/screen/GAD7" className="btn btn-outline w-full">
            {t('startGad7')}
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">{t('followups')}</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted">{tc('loading')}</p>
        ) : consentRequired ? (
          <p className="mt-3 text-sm text-warning">
            {t('consentOff')}{' '}
            <Link href="/resident/consent" className="underline">
              {t('consentLink')}
            </Link>
          </p>
        ) : cases.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t('noneYet')}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {cases.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3">
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
                  className="mt-1 inline-block text-sm font-medium text-teal-700 underline"
                >
                  {t('viewResult')}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {residentId && <p className="mt-4 text-xs text-muted">{t('deviceNote')}</p>}
        <div className="mt-3 flex flex-col gap-1">
          <Link href="/resident/consent" className="text-sm font-medium text-teal-700 underline">
            {t('consentLink')}
          </Link>
          <Link href="/resident/summary" className="text-sm font-medium text-teal-700 underline">
            {t('summaryLink')}
          </Link>
          <Link href="/resident/wearable" className="text-sm font-medium text-teal-700 underline">
            {t('wearableLink')}
          </Link>
        </div>
      </section>
    </div>
  );
}