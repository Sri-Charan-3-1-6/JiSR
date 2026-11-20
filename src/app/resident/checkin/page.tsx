'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { fmtDateTime, useResidentId } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PrefsForm } from '@/components/checkin/prefs-form';
import { DEFAULT_PREFS, type ReminderPrefs } from '@/lib/reminders';

interface Checkin {
  id: string;
  state: string;
  due_at: string;
  consecutive_misses: number;
  reminders_sent: number;
}
interface ReminderEvent {
  id: number;
  checkin_id: string | null;
  kind: string;
  note: string | null;
  read_at: string | null;
  created_at: string;
}

const KIND_TONE: Record<string, 'primary' | 'warning' | 'danger' | 'success' | 'neutral'> = {
  reminder: 'primary',
  soft_reminder: 'primary',
  snoozed: 'neutral',
  completed: 'success',
  missed: 'warning',
  escalated: 'danger',
  stopped: 'neutral',
  skipped_quiet_hours: 'neutral',
  skipped_daily_cap: 'neutral',
};

export default function CheckinPage() {
  const t = useTranslations('checkin');
  const tc = useTranslations('common');
  const reduce = useReducedMotion();
  const residentId = useResidentId();
  const [consent, setConsent] = useState(true);
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [events, setEvents] = useState<ReminderEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [audit, setAudit] = useState<ReminderEvent[]>([]);
  const [fetching, setLoading] = useState(true);
  const loading = residentId === undefined || (residentId !== null && fetching);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((id: string) =>
    Promise.all([
      fetch(`/api/residents/${id}/reminder-prefs`).then((r) => r.json()),
      fetch(`/api/residents/${id}/checkins`).then((r) => r.json()),
      fetch(`/api/residents/${id}/notifications`).then((r) => r.json()),
      fetch(`/api/residents/${id}/audit`).then((r) => r.json()),
    ]).then(([p, c, n, a]) => {
      setConsent(Boolean(p.consent));
      setPrefs(p.prefs ?? DEFAULT_PREFS);
      setCheckins(c.checkins ?? []);
      setEvents(n.events ?? []);
      setUnread(Number(n.unread ?? 0));
      setAudit(a.reminders ?? []);
    }), []);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    if (!id) return;
    load(id)
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function evaluate() {
    if (!residentId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/residents/${residentId}/checkins/evaluate`, { method: 'POST' });
      const d = await r.json();
      if (r.status === 403 && d.consentRequired) {
        setConsent(false);
        return;
      }
      if (!r.ok) throw new Error();
      const sentNow = (d.events ?? []).some(
        (e: ReminderEvent) => e.kind === 'reminder' || e.kind === 'soft_reminder',
      );
      // Vibration is opt-in, foreground-only, and never a background signal.
      if (
        sentNow && prefs.vibration &&
        document.visibilityState === 'visible' &&
        typeof navigator !== 'undefined' && 'vibrate' in navigator
      ) {
        navigator.vibrate(80);
      }
      await load(residentId);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function act(checkinId: string, action: 'complete' | 'snooze') {
    if (!residentId) return;
    setError(null);
    try {
      const r = await fetch(`/api/checkins/${checkinId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error();
      await load(residentId);
    } catch {
      setError(t('error'));
    }
  }

  async function markRead(eventId: number) {
    if (!residentId) return;
    try {
      const r = await fetch(`/api/notifications/${eventId}/read`, { method: 'POST' });
      if (!r.ok) throw new Error();
      setEvents((ev) => ev.map((e) => (e.id === eventId ? { ...e, read_at: new Date().toISOString() } : e)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      setError(t('error'));
    }
  }

  const latestMiss = checkins.find((c) => c.state === 'missed');
  const streak = latestMiss?.consecutive_misses ?? 0;
  const kindLabel = (kind: string) => (t.has(`eventKinds.${kind}`) ? t(`eventKinds.${kind}`) : kind);

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <section className="surface-hero grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:p-10">
        <div>
          <h1 className="page-heading">{t('title')}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{t('intro')}</p>
        </div>
        <div className="grid gap-3">
          <Link href="/resident/companion" className="feature-link flex items-center justify-between gap-4 bg-card font-semibold text-primary-strong">
            {t('openCompanion')}<span aria-hidden="true" className="text-accent rtl:rotate-180">→</span>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/resident/calm" className="btn btn-outline flex-1 text-sm">{t('openCalm')}</Link>
            <Link href="/resident/trusted-contact" className="btn btn-outline flex-1 text-sm">{t('openContact')}</Link>
          </div>
        </div>
      </section>

      {!residentId && !loading ? (
        <section className="card p-6 text-sm text-muted">
          {t('noResident')}{' '}
          <Link href="/resident" className="font-semibold text-primary underline">{t('goScreening')}</Link>
        </section>
      ) : loading ? (
        <>
          <span className="sr-only">{t('loading')}</span>
          <SkeletonCard lines={5} />
        </>
      ) : !consent ? (
        <section className="card space-y-3 p-6 text-sm">
          <p className="text-muted">{t('consentRequired')}</p>
          <Link href="/resident/consent" className="btn btn-primary">{t('consentLink')}</Link>
        </section>
      ) : (
        <>
          {error && (
            <p role="alert" className="card border-danger/50 p-4 text-sm text-danger">{error}</p>
          )}

          <div className="resident-grid items-start gap-6">
          <div className="min-w-0 space-y-6">
          <section className="data-panel p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-heading">{t('notificationsTitle')}</h2>
              {unread > 0 && <Badge tone="primary">{t('unread', { n: unread })}</Badge>}
            </div>
            <Button onClick={evaluate} disabled={busy} variant="outline" className="mt-3 px-3 py-2 text-sm">
              {busy ? tc('loading') : t('checkNow')}
            </Button>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t('notificationsEmpty')}</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {events.map((e, i) => (
                  <motion.li
                    key={e.id}
                    initial={reduce || i > 2 ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    className="timeline-item flex flex-wrap items-center gap-3 p-4 text-sm"
                  >
                    <Badge tone={KIND_TONE[e.kind] ?? 'neutral'}>{kindLabel(e.kind)}</Badge>
                    <span className="text-xs text-muted">{fmtDateTime(e.created_at)}</span>
                    {!e.read_at && (
                      <button
                        type="button"
                        onClick={() => markRead(e.id)}
                        className="ms-auto inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        {t('markRead')}
                      </button>
                    )}
                  </motion.li>
                ))}
              </ul>
            )}
          </section>

          <section className="data-panel border-primary/25 p-6 sm:p-7">
            <h2 className="section-heading">{t('checkinsTitle')}</h2>
            {checkins.length === 0 ? (
              <div className="mt-3"><EmptyState title={t('checkinsEmpty')} /></div>
            ) : (
              <ul className="mt-3 space-y-3">
                {checkins.map((c) => (
                  <li key={c.id} className="timeline-item p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.state === 'completed' ? 'success' : c.state === 'missed' ? 'warning' : 'neutral'}>
                        {t.has(`states.${c.state}`) ? t(`states.${c.state}`) : c.state}
                      </Badge>
                      <span className="text-xs text-muted">{t('due', { date: fmtDateTime(c.due_at) })}</span>
                    </div>
                    {(c.state === 'pending' || c.state === 'snoozed' || c.state === 'missed') && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button onClick={() => act(c.id, 'complete')} className="px-3 py-2 text-sm">
                          {t('complete')}
                        </Button>
                        <Button onClick={() => act(c.id, 'snooze')} variant="outline" className="px-3 py-2 text-sm">
                          {t('snooze')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-card border border-border bg-surface-2/50 p-6">
            <h2 className="section-heading">{t('ladderTitle')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t('ladderBody', { n: prefs.ladderMissLimit })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={streak > 0 ? 'warning' : 'neutral'}>{t('streak', { n: streak })}</Badge>
            </div>
          </section>

          </div>
          <div className="min-w-0 space-y-6">
          <PrefsForm residentId={residentId!} prefs={prefs} onSaved={setPrefs} />
          <section className="data-panel p-6 sm:p-7">
            <h2 className="section-heading">{t('auditTitle')}</h2>
            {audit.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t('auditEmpty')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {audit.slice(0, 20).map((e) => (
                  <li key={e.id} className="timeline-item flex flex-wrap items-center gap-2 p-3 text-sm">
                    <Badge tone={KIND_TONE[e.kind] ?? 'neutral'}>{kindLabel(e.kind)}</Badge>
                    <span className="text-xs text-muted">{fmtDateTime(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>
          </div>
        </>
      )}

      <section className="border-t border-border pt-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/navigator" className="btn btn-outline px-3 py-2">{t('clockLink')}</Link>
          <Link href="/health-system" className="btn btn-outline px-3 py-2">{t('gapLink')}</Link>
        </div>
      </section>
    </div>
  );
}