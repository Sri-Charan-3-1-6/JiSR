'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CountUp, Stat } from '@/components/ui/stat';
import { Modal } from '@/components/ui/modal';
import { SkeletonCard } from '@/components/ui/skeleton';
import { SyntheticBadge } from '@/components/header';

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
  const max = Math.max(1, ...rows.map((r) => Number(r.resident_count)));
  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="py-1.5 text-start">{t('group')}</th>
            <th className="py-1.5 text-end">{t('residents')}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => {
            const count = byValue.get(l.value);
            return (
              <tr key={l.value} className="border-b border-border/60">
                <td className="py-2">
                  {l.label}
                  {count !== undefined && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-pill bg-surface-2">
                      <div
                        className="bar-grow h-full w-full origin-left rounded-pill bg-primary/70 rtl:origin-right"
                        style={{ transform: `scaleX(${Number(count) / max})`, animationDelay: `${i * 50}ms` }}
                      />
                    </div>
                  )}
                </td>
                <td className="py-2 text-end font-mono align-top">
                  {count === undefined ? (
                    <span className="text-muted" title={t('suppressedTitle')} dir="ltr">
                      &lt;10
                    </span>
                  ) : (
                    <CountUp value={Number(count)} />
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
  const tc = useTranslations('common');
  const [areas, setAreas] = useState<GroupCount[]>([]);
  const [languages, setLanguages] = useState<GroupCount[]>([]);
  const [ages, setAges] = useState<GroupCount[]>([]);
  const [nationalities, setNationalities] = useState<GroupCount[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

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
    <div className="space-y-6">
      <section className="card p-6" style={{ background: 'var(--gradient-soft), var(--card)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
          <div className="flex items-center gap-2">
            <SyntheticBadge />
            <button
              onClick={() => setInfoOpen(true)}
              aria-label={t('suppressedTitle')}
              className="btn btn-ghost h-11 w-11 rounded-pill p-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 11 V16.5 M12 7.5 V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <p className="mt-3 rounded-btn border border-primary/25 bg-primary/10 p-3 text-sm font-semibold text-primary-strong">
          {t('banner')}
        </p>
        <p className="mt-3 text-sm text-muted">{t('note')}</p>
      </section>

      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title={t('suppressedTitle')} closeLabel={tc('close')}>
        <p className="leading-relaxed text-muted">{t('note')}</p>
        <p className="mt-2 leading-relaxed text-muted">{t('suppressedNotCounted')}</p>
      </Modal>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <span className="sr-only">{t('loading')}</span>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} lines={5} />
          ))}
        </div>
      ) : error ? (
        <section role="alert" className="card border-danger/50 p-6 text-sm text-danger">
          {error}
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <Stat
              label={t('screeningsTotal')}
              value={totals?.screenings_total ?? '—'}
              numericValue={totals ? Number(totals.screenings_total) : undefined}
            />
            <Stat
              label={t('residentsTotal')}
              value={String(areas.reduce((s, r) => s + Number(r.resident_count), 0) || '—')}
              numericValue={areas.reduce((s, r) => s + Number(r.resident_count), 0) || undefined}
              hint={t('suppressedNotCounted')}
            />
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