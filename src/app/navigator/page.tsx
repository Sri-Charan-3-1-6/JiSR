'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RiskBadge, StateBadge, fmtDateTime, fmtDuration, intervalToMs } from '@/components/ui';
import { Tabs } from '@/components/ui/tabs';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { RiskTier } from '@/lib/matching';

interface QueueCase {
  id: string;
  pseudo_id: string;
  risk_tier: RiskTier;
  state: string;
  instrument: string | null;
  total_score: number | null;
  next_milestone: string | null;
  next_due: string | null;
  is_overdue: boolean;
  overdue_by: string | Record<string, number>;
  created_at: string;
}

interface Clock { now: string; offset: string }

export default function NavigatorConsole() {
  const t = useTranslations('navigator');
  const tc = useTranslations('common');
  const tm = useTranslations('milestones');
  const reduce = useReducedMotion();
  const [cases, setCases] = useState<QueueCase[]>([]);
  const [clock, setClock] = useState<Clock | null>(null);
  const [tab, setTab] = useState<'all' | 'overdue'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [traveling, setTraveling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/navigator/queue');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? t('loadError'));
      setCases(d.cases);
      setClock(d.clock);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function timeTravel(days: number) {
    setTraveling(true);
    try {
      await fetch('/api/demo/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      await load();
    } finally {
      setTraveling(false);
    }
  }

  const milestone = (m: string | null) => (m && tm.has(m) ? tm(m) : m ?? '');
  const shown = tab === 'overdue' ? cases.filter((c) => c.is_overdue) : cases;
  const overdueCount = cases.filter((c) => c.is_overdue).length;

  return (
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted">
              {t('subtitle')}{' '}
              <strong className="tabular-nums text-foreground">{clock ? fmtDateTime(clock.now) : '…'}</strong>
              {clock && clock.offset !== '00:00:00' && (
                <span className="ms-1 font-semibold text-warning">{t('offset', { offset: clock.offset })}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">{t('timeTravel')}</span>
            {[1, 3, 7].map((d) => (
              <motion.button
                key={d}
                whileTap={reduce ? undefined : { scale: 0.95 }}
                onClick={() => timeTravel(d)}
                disabled={traveling}
                className="btn btn-outline px-3 py-2 text-sm"
              >
                {d === 1 ? t('plusOneDay') : t('plusDays', { n: d })}
              </motion.button>
            ))}
            <button onClick={load} disabled={traveling} className="btn btn-ghost px-3 py-2 text-sm">
              {tc('refresh')}
            </button>
          </div>
        </div>
      </section>

      <Tabs
        layoutId="navigator-tabs"
        ariaLabel={t('title')}
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: t('allCases', { n: cases.length }) },
          { value: 'overdue', label: t('overdue', { n: overdueCount }), danger: true },
        ]}
      />

      {error && <p className="text-danger" role="alert">{error}</p>}
      {loading ? (
        <div className="space-y-3">
          <span className="sr-only">{t('loading')}</span>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : shown.length === 0 ? (
        <EmptyState title={tab === 'overdue' ? t('emptyOverdue') : t('emptyAll')} />
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {shown.map((c) => (
              <motion.li
                key={c.id}
                layout={reduce ? false : 'position'}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={`card card-hover p-4 ${c.is_overdue ? 'border-danger/50' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge tier={c.risk_tier} />
                    <StateBadge state={c.state} />
                    <span className="font-mono text-sm font-semibold">{c.pseudo_id}</span>
                    {c.instrument && (
                      <span className="text-xs text-muted">{c.instrument} · {c.total_score}</span>
                    )}
                  </div>
                  {c.is_overdue ? (
                    <span className="soft-pulse inline-flex items-center gap-1 rounded-pill bg-danger px-3 py-1.5 text-xs font-bold text-white dark:text-[#2a0d0b]">
                      {t('overdueBadge', { duration: fmtDuration(intervalToMs(c.overdue_by)), milestone: milestone(c.next_milestone) })}
                    </span>
                  ) : c.next_due ? (
                    <span className="text-xs text-muted">
                      {t('dueLine', { milestone: milestone(c.next_milestone), date: fmtDateTime(c.next_due) })}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-success">{t('noSla')}</span>
                  )}
                </div>
                <Link
                  href={`/navigator/case/${c.id}`}
                  className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {t('openCase')}
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}