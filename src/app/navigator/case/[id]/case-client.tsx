'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RiskBadge, StateBadge, fmtDateTime, fmtDuration, intervalToMs, STATE_LABELS } from '@/components/ui';
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
    if (!res.ok) { setError(d.error ?? 'Failed to load case'); return; }
    setKase(d.case);
    setSla(d.sla);
    setEvents(d.events);
    setOutreach(d.outreach);
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
      setNote('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error && !kase) {
    return <div className="card p-6 text-danger" role="alert">{error}</div>;
  }
  if (!kase) return <div className="card p-6 text-muted">Loading case…</div>;

  const match = matchSupport(kase.risk_tier);
  const next = nextState(kase.state);

  return (
    <div className="space-y-5">
      <Link href="/navigator" className="text-sm text-teal-700 underline">← Back to queue</Link>

      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge tier={kase.risk_tier} />
          <StateBadge state={kase.state} />
          <h1 className="text-lg font-bold">{kase.pseudo_id}</h1>
        </div>
        <p className="mt-2 text-sm text-muted">
          Language: {kase.language} · Age band: {kase.age_band ?? '—'} · Area: {kase.area ?? '—'} ·
          Screened {fmtDateTime(kase.created_at)}
        </p>
        {sla?.is_overdue && (
          <p className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white">
            ⏱ SLA BREACHED — {sla.next_milestone} overdue by {fmtDuration(intervalToMs(sla.overdue_by))}
          </p>
        )}
        {!sla?.is_overdue && sla?.next_due && (
          <p className="mt-3 text-sm text-muted">
            Next SLA: {sla.next_milestone} due {fmtDateTime(sla.next_due)}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Screening</h2>
          {kase.instrument ? (
            <>
              <p className="mt-2 text-sm">
                {kase.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} total:{' '}
                <strong>{kase.total_score}</strong> ({kase.score_band?.replace('_', ' ')})
              </p>
              {kase.crisis_flag && (
                <p className="mt-1 text-sm font-semibold text-danger">
                  Crisis trigger: {kase.crisis_reason === 'item9' ? 'PHQ-9 item 9 > 0' : 'crisis keyword in free text'} (fixed rule)
                </p>
              )}
              {kase.answers && (
                <p className="mt-2 text-xs text-muted">Answers: [{kase.answers.join(', ')}]</p>
              )}
              {kase.free_text && (
                <p className="mt-2 rounded bg-background p-2 text-sm italic">“{kase.free_text}”</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No screening linked.</p>
          )}
          <h3 className="mt-4 font-semibold text-sm">Suggested step</h3>
          <p className="mt-1 text-sm text-muted">{match.options[0].title} — {match.slaSummary}</p>
          <p className="mt-1 text-xs text-muted">{match.why}</p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Follow-up clock</h2>
          <ol className="mt-3 space-y-2">
            {STATE_ORDER.map((s) => {
              const reached = STATE_ORDER.indexOf(s) <= STATE_ORDER.indexOf(kase.state);
              return (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block h-3 w-3 rounded-full ${reached ? 'bg-teal-700' : 'bg-border'}`} />
                  <span className={reached ? 'font-medium' : 'text-muted'}>{STATE_LABELS[s]}</span>
                </li>
              );
            })}
          </ol>
          {next ? (
            <button onClick={advance} disabled={busy} className="btn btn-primary mt-4 w-full">
              {busy ? 'Saving…' : `Mark as ${STATE_LABELS[next]}`}
            </button>
          ) : (
            <p className="mt-4 text-sm font-medium text-emerald-700">Follow-up complete.</p>
          )}

          <h3 className="mt-5 font-semibold text-sm">Log outreach attempt</h3>
          <div className="mt-2 flex gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
              aria-label="Outreach channel"
            >
              <option value="call">Call</option>
              <option value="sms">SMS</option>
              <option value="message">Message</option>
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              aria-label="Outreach note"
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => logOutreach('reached')} disabled={busy} className="btn btn-primary text-sm">
              Reached
            </button>
            <button onClick={() => logOutreach('not_reached')} disabled={busy} className="btn btn-outline text-sm">
              Not reached
            </button>
          </div>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Timeline</h2>
        {events.length === 0 && outreach.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No events yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {events.map((e) => (
              <li key={`e${e.id}`} className="flex gap-2">
                <span className="shrink-0 text-xs text-muted">{fmtDateTime(e.created_at)}</span>
                <span>
                  {e.event_type === 'state_change'
                    ? `${e.from_state ? STATE_LABELS[e.from_state] + ' → ' : ''}${STATE_LABELS[e.to_state ?? ''] ?? e.to_state}`
                    : e.event_type === 'outreach'
                      ? `Outreach (${(e.detail?.channel as string) ?? '?'}): ${(e.detail?.outcome as string) ?? '?'}${e.detail?.note ? ` — ${e.detail.note}` : ''}`
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