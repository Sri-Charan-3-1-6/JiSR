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
    <div className="data-panel card min-w-0 p-4 sm:p-5">
      <h2 className="section-heading border-b border-border/70 pb-4 text-base font-bold text-foreground">{title}</h2>
      <div className="mt-3 min-w-0 max-w-full overflow-x-auto">
      <table className="w-full min-w-[180px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="py-2 pe-3 text-start font-medium">{t('group')}</th>
            <th className="py-2 text-end font-medium">{t('residents')}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => {
            const count = byValue.get(l.value);
            return (
              <tr key={l.value} className="border-b border-border/60 last:border-b-0">
                <td className="py-3 pe-4 font-medium">
                  {l.label}
                  {count !== undefined && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-2">
                      <div
                        className="bar-grow h-full w-full origin-left rounded-pill bg-primary/70 rtl:origin-right"
                        style={{ transform: `scaleX(${Number(count) / max})`, animationDelay: `${i * 50}ms` }}
                      />
                    </div>
                  )}
                </td>
                <td className="py-3 text-end align-top font-mono font-semibold tabular-nums">
                  {count === undefined ? (
                    <span className="inline-flex rounded-sm border border-border bg-surface-2 px-2 py-1 text-xs text-muted" title={t('suppressedTitle')} dir="ltr">
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
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <section className="surface-hero min-w-0 p-5 sm:p-7">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h1 className="page-heading text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
          <div className="flex flex-wrap items-center gap-2">
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
        <div className="mt-5 flex items-start gap-3 rounded-btn border border-primary/20 bg-primary/5 p-4">
          <svg className="mt-0.5 shrink-0 text-primary" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3 4 6v6c0 4.5 4.5 7.5 8 9 3.5-1.5 8-4.5 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="m8.5 12 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm font-semibold leading-relaxed text-primary-strong">{t('banner')}</p>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{t('note')}</p>
      </section>

      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title={t('suppressedTitle')} closeLabel={tc('close')}>
        <p className="leading-relaxed text-muted">{t('note')}</p>
        <p className="mt-2 leading-relaxed text-muted">{t('suppressedNotCounted')}</p>
      </Modal>

      {loading ? (
        <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <section className="grid min-w-0 grid-cols-2 items-stretch gap-3 sm:gap-4 [&>div]:min-w-0 [&>div]:h-full [&>div]:p-4 sm:[&>div]:p-6">
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
          <section className="grid min-w-0 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
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