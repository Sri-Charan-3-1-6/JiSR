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

  const load = useCallback(() =>
    fetch(`/api/cases/${id}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data: d }) => {
        if (!ok) { setError(d.error ?? t('loadError')); return; }
        setKase(d.case);
        setSla(d.sla);
        setEvents(d.events);
        setOutreach(d.outreach);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id]);

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
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Link href="/navigator" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
        <svg className="rtl:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5m5-5-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t('backToQueue')}
      </Link>

      <section className="surface-hero min-w-0 p-5 sm:p-7">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="page-heading break-all font-mono text-2xl font-bold tracking-tight sm:text-3xl">{kase.pseudo_id}</h1>
          <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
            <RiskBadge tier={kase.risk_tier} />
            <StateBadge state={kase.state} />
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {t('meta', {
            language: kase.language,
            age: kase.age_band ?? '—',
            area: kase.area ?? '—',
            date: fmtDateTime(kase.created_at),
          })}
        </p>
        {sla?.is_overdue && (
          <p className="mt-4 flex items-center gap-3 rounded-btn border border-danger/30 border-s-4 bg-danger-soft px-4 py-3 text-sm font-bold leading-relaxed text-danger">
            <span className="soft-pulse h-1.5 w-1.5 shrink-0 rounded-pill bg-current" aria-hidden="true" />
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

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-6">
        <section className="card min-w-0 p-5 sm:p-6 lg:col-start-1 lg:row-start-1">
          <h2 className="section-heading border-b border-border/70 pb-3 font-bold">{t('screening')}</h2>
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
                <p className="mt-3 break-words font-mono text-xs leading-relaxed text-muted">{t('answers')} [{kase.answers.join(', ')}]</p>
              )}
              {kase.free_text && (
                <p className="mt-4 break-words rounded-btn border-s-2 border-accent/40 bg-surface-2 p-4 text-sm italic leading-relaxed">“{kase.free_text}”</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('noScreening')}</p>
          )}
          <div className="mt-5 rounded-btn border border-primary/15 bg-primary/5 p-4">
            <h3 className="eyebrow text-xs font-bold text-primary">{t('suggestedStep')}</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed">
              {tr(`options.${kase.risk_tier}.${match.options[0].key}.title`)} — {tr(`sla.${kase.risk_tier}`)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{tr(`why.${kase.risk_tier}`)}</p>
          </div>
        </section>

        <section className="card min-w-0 p-5 sm:p-6 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <h2 className="section-heading border-b border-border/70 pb-3 font-bold">{t('clockTitle')}</h2>
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

          <div className="mt-6 min-w-0 rounded-btn border border-border bg-surface-2/50 p-4">
            <h3 className="section-heading text-sm font-bold">{t('logOutreach')}</h3>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <label className="block min-w-0 text-xs font-semibold text-muted">
                {t('channel')}
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="input mt-1.5 min-w-0 text-sm font-normal"
                  aria-label={t('channel')}
                >
                  <option value="call">{t('call')}</option>
                  <option value="sms">{t('sms')}</option>
                  <option value="message">{t('message')}</option>
                </select>
              </label>
              <label className="block min-w-0 text-xs font-semibold text-muted">
                {t('note')}
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('note')}
                  className="input mt-1.5 min-w-0 text-sm font-normal"
                  aria-label={t('note')}
                />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button onClick={() => logOutreach('reached')} disabled={busy} className="btn btn-primary text-sm">
                {t('reached')}
              </button>
              <button onClick={() => logOutreach('not_reached')} disabled={busy} className="btn btn-outline text-sm">
                {t('notReached')}
              </button>
            </div>
          </div>
        </section>

        <section className="card min-w-0 p-5 sm:p-6 lg:col-start-1 lg:row-start-2">
          <h2 className="section-heading border-b border-border/70 pb-3 font-bold">{t('timeline')}</h2>
          {events.length === 0 && outreach.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t('noEvents')}</p>
          ) : (
            <ul className="mt-4 space-y-0 text-sm">
              {events.map((e) => (
                <li key={`e${e.id}`} className="relative min-w-0 border-s border-border ps-5 pb-5 last:pb-1">
                  <span className="absolute -start-1 top-1.5 h-2 w-2 rounded-pill bg-primary" aria-hidden="true" />
                  <span className="block font-mono text-xs tabular-nums leading-relaxed text-muted">{fmtDateTime(e.created_at)}</span>
                  <span className="mt-1 block break-words leading-relaxed">
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
    </div>
  );
}