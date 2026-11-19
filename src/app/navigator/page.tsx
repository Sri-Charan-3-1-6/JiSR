'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RiskBadge, StateBadge, fmtDateTime, fmtDuration, intervalToMs } from '@/components/ui';
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
      if (!res.ok) throw new Error(d.error ?? 'Failed to load queue');
      setCases(d.cases);
      setClock(d.clock);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
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

  const shown = tab === 'overdue' ? cases.filter((c) => c.is_overdue) : cases;
  const overdueCount = cases.filter((c) => c.is_overdue).length;

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Navigator console</h1>
            <p className="text-sm text-muted">
              Queue sorted by risk, then overdue time. Simulated clock:{' '}
              <strong>{clock ? fmtDateTime(clock.now) : '…'}</strong>
              {clock && clock.offset !== '00:00:00' && (
                <span className="ml-1 text-amber-700">(+{clock.offset} demo offset)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Demo time-travel:</span>
            {[1, 3, 7].map((d) => (
              <button
                key={d}
                onClick={() => timeTravel(d)}
                disabled={traveling}
                className="btn btn-outline px-3 py-2 text-sm"
                style={{ minHeight: 40 }}
              >
                +{d} day{d > 1 ? 's' : ''}
              </button>
            ))}
            <button onClick={load} disabled={traveling} className="btn btn-outline px-3 py-2 text-sm" style={{ minHeight: 40 }}>
              Refresh
            </button>
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('all')}
          className={`btn px-4 py-2 text-sm ${tab === 'all' ? 'btn-primary' : 'btn-outline'}`}
          style={{ minHeight: 40 }}
        >
          All cases ({cases.length})
        </button>
        <button
          onClick={() => setTab('overdue')}
          className={`btn px-4 py-2 text-sm ${tab === 'overdue' ? 'btn-danger' : 'btn-outline'}`}
          style={{ minHeight: 40 }}
        >
          Overdue ({overdueCount})
        </button>
      </div>

      {error && <p className="text-danger" role="alert">{error}</p>}
      {loading ? (
        <p className="text-muted">Loading queue…</p>
      ) : shown.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          {tab === 'overdue' ? 'No overdue cases — every SLA is currently met.' : 'No cases yet. Cases appear here after a resident screens.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => (
            <li key={c.id} className={`card p-4 ${c.is_overdue ? 'border-red-400' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge tier={c.risk_tier} />
                  <StateBadge state={c.state} />
                  <span className="text-sm font-medium">{c.pseudo_id}</span>
                  {c.instrument && (
                    <span className="text-xs text-muted">{c.instrument} · {c.total_score}</span>
                  )}
                </div>
                {c.is_overdue ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                    ⏱ OVERDUE {fmtDuration(intervalToMs(c.overdue_by))} — {c.next_milestone}
                  </span>
                ) : c.next_due ? (
                  <span className="text-xs text-muted">
                    {c.next_milestone} due {fmtDateTime(c.next_due)}
                  </span>
                ) : (
                  <span className="text-xs text-emerald-700 font-medium">No pending SLA</span>
                )}
              </div>
              <Link
                href={`/navigator/case/${c.id}`}
                className="mt-2 inline-block text-sm font-medium text-teal-700 underline"
              >
                Open case
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}