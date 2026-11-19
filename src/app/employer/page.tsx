'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface GroupCount {
  group_value: string;
  resident_count: string;
}
interface Totals {
  screenings_total: string;
  crisis_screens_total: string;
}

const LANGUAGES = ['en', 'ar', 'hi'];
const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const AREAS = ['Area 1', 'Area 2', 'Area 3', 'Area 4', 'Area 5'];
const NATIONALITIES = ['Group A', 'Group B', 'Group C', 'Group D', 'Group S'];

function CountTable({ title, labels, rows }: {
  title: string;
  labels: { value: string; label: string }[];
  rows: GroupCount[];
}) {
  const t = useTranslations('employer');
  const byValue = new Map(rows.map((r) => [r.group_value, r.resident_count]));
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="py-1.5 text-start">{t('group')}</th>
            <th className="py-1.5 text-end">{t('residents')}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((l) => {
            const count = byValue.get(l.value);
            return (
              <tr key={l.value} className="border-b border-border/60">
                <td className="py-1.5">{l.label}</td>
                <td className="py-1.5 text-end font-mono">
                  {count === undefined ? (
                    <span className="text-muted" title={t('suppressedTitle')}>
                      &lt;10
                    </span>
                  ) : (
                    count
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function EmployerPage() {
  const t = useTranslations('employer');
  const [areas, setAreas] = useState<GroupCount[]>([]);
  const [languages, setLanguages] = useState<GroupCount[]>([]);
  const [ages, setAges] = useState<GroupCount[]>([]);
  const [nationalities, setNationalities] = useState<GroupCount[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employer')
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setAreas(d.areas);
        setLanguages(d.languages);
        setAges(d.ages);
        setNationalities(d.nationalities);
        setTotals(d.totals);
      })
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card p-6">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="mt-3 rounded-lg bg-teal-50 border border-teal-200 p-3 text-sm font-medium text-teal-900">
          {t('banner')}
        </p>
        <p className="mt-3 text-sm text-muted">{t('note')}</p>
      </section>

      {loading ? (
        <section className="card p-6 text-sm text-muted">{t('loading')}</section>
      ) : error ? (
        <section role="alert" className="card border-danger p-6 text-sm text-danger">
          {error}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t('screeningsTotal')}
              </p>
              <p className="mt-1 text-2xl font-bold">{totals?.screenings_total ?? '—'}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t('residentsTotal')}
              </p>
              <p className="mt-1 text-2xl font-bold">
                {areas.reduce((s, r) => s + Number(r.resident_count), 0) || '—'}
              </p>
              <p className="mt-1 text-xs text-muted">{t('suppressedNotCounted')}</p>
            </div>
          </section>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CountTable
              title={t('byLanguage')}
              labels={LANGUAGES.map((v) => ({ value: v, label: t(`languages.${v}`) }))}
              rows={languages}
            />
            <CountTable
              title={t('byAge')}
              labels={AGE_BANDS.map((v) => ({ value: v, label: v }))}
              rows={ages}
            />
            <CountTable
              title={t('byArea')}
              labels={AREAS.map((v) => ({ value: v, label: v }))}
              rows={areas}
            />
            <CountTable
              title={t('byNationality')}
              labels={NATIONALITIES.map((v) => ({ value: v, label: v }))}
              rows={nationalities}
            />
          </section>
        </>
      )}
    </div>
  );
}