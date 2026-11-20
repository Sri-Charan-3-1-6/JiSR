'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { RiskBadge, StateBadge, fmtDateTime, fmtDuration, intervalToMs } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { matchSupport, nextState, STATE_ORDER, type CaseState, type RiskTier } from '@/lib/matching';

interface CaseDetail {
  id: string;
  pseudo_id: string;
  language: string;
  age_band: string | null;
  area: string | null;
  risk_tier: RiskTier;
  state: CaseState;
  instrument: string | null;
  answers: number[] | null;
  free_text: string | null;
  total_score: number | null;
  score_band: string | null;
  crisis_flag: boolean;
  crisis_reason: string | null;
  created_at: string;
}

interface SlaInfo {
  next_milestone: string | null;
  next_due: string | null;
  is_overdue: boolean;
  overdue_by: string | Record<string, number>;
}

interface EventRow {
  id: number;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

interface OutreachRow {
  id: number;
  channel: string;
  outcome: string;
  note: string | null;
  attempted_at: string;
}

export default function CaseClient({ id }: { id: string }) {
  const t = useTranslations('case');
  const tc = useTranslations('common');
  const ts = useTranslations('states');
  const tm = useTranslations('milestones');
  const tr = useTranslations('result');
  const tt = useTranslations('tiers');
  const reduce = useReducedMotion();
  const toast = useToast();
  const [kase, setKase] = useState<CaseDetail | null>(null);
  const [sla, setSla] = useState<SlaInfo | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [outreach, setOutreach] = useState<OutreachRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState('call');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${id}`);
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? t('loadError')); return; }
    setKase(d.case);
    setSla(d.sla);
    setEvents(d.events);
    setOutreach(d.outreach);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function advance() {
    if (!kase) return;
    const to = nextState(kase.state);
    if (!to) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${id}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState: to }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error);
      else toast(tc('saved'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function logOutreach(outcome: 'reached' | 'not_reached') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${id}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, outcome, note: note || null }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error);
      else toast(tc('saved'));
      setNote('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error && !kase) {
    return <div className="card p-6 text-danger" role="alert">{error}</div>;
  }
  if (!kase) return <div className="card p-6 text-muted">{t('loading')}</div>;

  const match = matchSupport(kase.risk_tier);
  const next = nextState(kase.state);
  const stateLabel = (s: string | null | undefined) => (s && ts.has(s) ? ts(s) : s ?? '');
  const milestone = (m: string | null) => (m && tm.has(m) ? tm(m) : m ?? '');
  const channelLabel = (c: string) => (t.has(c) ? t(c) : c);
  const outcomeLabel = (o: string) => (o === 'reached' ? t('reached') : o === 'not_reached' ? t('notReached') : o);
  const reachedIndex = STATE_ORDER.indexOf(kase.state);

  return (
    <div className="space-y-5">
      <Link href="/navigator" className="inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline">{t('backToQueue')}</Link>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge tier={kase.risk_tier} />
          <StateBadge state={kase.state} />
          <h1 className="font-mono text-lg font-bold">{kase.pseudo_id}</h1>
        </div>
        <p className="mt-2 text-sm text-muted">
          {t('meta', {
            language: kase.language,
            age: kase.age_band ?? '—',
            area: kase.area ?? '—',
            date: fmtDateTime(kase.created_at),
          })}
        </p>
        {sla?.is_overdue && (
          <p className="soft-pulse mt-3 rounded-btn bg-danger px-4 py-2.5 text-sm font-bold text-white dark:text-[#2a0d0b]">
            {t('slaBreached', { milestone: milestone(sla.next_milestone), duration: fmtDuration(intervalToMs(sla.overdue_by)) })}
          </p>
        )}
        {!sla?.is_overdue && sla?.next_due && (
          <p className="mt-3 text-sm text-muted">
            {t('nextSla', { milestone: milestone(sla.next_milestone), date: fmtDateTime(sla.next_due) })}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="font-bold">{t('screening')}</h2>
          {kase.instrument ? (
            <>
              <p className="mt-2 text-sm">
                {t('total', { instrument: kase.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7' })}{' '}
                <strong>{kase.total_score}</strong>
                {kase.score_band && tt.has(kase.score_band) ? ` (${tt(kase.score_band)})` : ''}
              </p>
              {kase.crisis_flag && (
                <p className="mt-2 rounded-btn bg-danger-soft p-2 text-sm font-semibold text-danger">
                  {kase.crisis_reason === 'item9' ? t('crisisTriggerItem9') : t('crisisTriggerKeyword')}
                </p>
              )}
              {kase.answers && (
                <p className="mt-2 font-mono text-xs text-muted">{t('answers')} [{kase.answers.join(', ')}]</p>
              )}
              {kase.free_text && (
                <p className="mt-2 rounded-btn bg-surface-2 p-3 text-sm italic">“{kase.free_text}”</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('noScreening')}</p>
          )}
          <h3 className="mt-5 text-sm font-bold">{t('suggestedStep')}</h3>
          <p className="mt-1 text-sm text-muted">
            {tr(`options.${kase.risk_tier}.${match.options[0].key}.title`)} — {tr(`sla.${kase.risk_tier}`)}
          </p>
          <p className="mt-1 text-xs text-muted">{tr(`why.${kase.risk_tier}`)}</p>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="font-bold">{t('clockTitle')}</h2>
          <ol className="mt-4 space-y-0">
            {STATE_ORDER.map((s, i) => {
              const reached = i <= reachedIndex;
              const isCurrent = i === reachedIndex;
              return (
                <li key={s} className="relative flex items-center gap-3 pb-4 last:pb-0">
                  {i < STATE_ORDER.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute start-[7px] top-4 h-full w-0.5 ${i < reachedIndex ? 'bg-primary' : 'bg-border'}`}
                    />
                  )}
                  <motion.span
                    initial={false}
                    animate={reached && !reduce ? { scale: [0.6, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={`relative z-10 inline-block h-4 w-4 shrink-0 rounded-pill border-2 ${
                      reached ? 'border-primary bg-primary' : 'border-border bg-card'
                    } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}
                  />
                  <span className={`text-sm ${reached ? 'font-semibold' : 'text-muted'}`}>{ts(s)}</span>
                </li>
              );
            })}
          </ol>
          {next ? (
            <motion.button
              whileTap={reduce ? undefined : { scale: 0.97 }}
              onClick={advance}
              disabled={busy}
              className="btn btn-primary mt-4 w-full"
            >
              {busy ? tc('saving') : t('markAs', { state: ts(next) })}
            </motion.button>
          ) : (
            <p className="mt-4 rounded-btn bg-success-soft p-3 text-sm font-semibold text-success">{t('complete')}</p>
          )}

          <h3 className="mt-6 text-sm font-bold">{t('logOutreach')}</h3>
          <div className="mt-2 flex gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="input shrink-0"
              style={{ width: 'auto' }}
              aria-label={t('channel')}
            >
              <option value="call">{t('call')}</option>
              <option value="sms">{t('sms')}</option>
              <option value="message">{t('message')}</option>
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('note')}
              className="input min-w-0 flex-1"
              aria-label={t('note')}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => logOutreach('reached')} disabled={busy} className="btn btn-primary text-sm">
              {t('reached')}
            </button>
            <button onClick={() => logOutreach('not_reached')} disabled={busy} className="btn btn-outline text-sm">
              {t('notReached')}
            </button>
          </div>
        </section>
      </div>

      <section className="card p-5 sm:p-6">
        <h2 className="font-bold">{t('timeline')}</h2>
        {events.length === 0 && outreach.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('noEvents')}</p>
        ) : (
          <ul className="mt-3 space-y-2.5 text-sm">
            {events.map((e) => (
              <li key={`e${e.id}`} className="flex gap-3">
                <span className="shrink-0 font-mono text-xs text-muted">{fmtDateTime(e.created_at)}</span>
                <span>
                  {e.event_type === 'state_change'
                    ? `${e.from_state ? stateLabel(e.from_state) + ' → ' : ''}${stateLabel(e.to_state)}`
                    : e.event_type === 'outreach'
                      ? `${t('outreachEvent', {
                          channel: channelLabel((e.detail?.channel as string) ?? '?'),
                          outcome: outcomeLabel((e.detail?.outcome as string) ?? '?'),
                        })}${e.detail?.note ? ` — ${e.detail.note}` : ''}`
                      : e.event_type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}