'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RiskBadge, StateBadge, fmtDateTime } from '@/components/ui';
import { matchSupport, type RiskTier } from '@/lib/matching';

interface CaseData {
  id: string;
  risk_tier: RiskTier;
  state: string;
  instrument: string;
  total_score: number;
  score_band: string;
  created_at: string;
  sla_contact_due: string | null;
  sla_book_due: string | null;
  sla_followup_due: string | null;
  pseudo_id: string;
}

export default function ResultClient({ id }: { id: string }) {
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Failed to load result');
        setData(d.case);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function accept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/cases/${id}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState: 'MATCHED' }),
      });
      const d = await res.json();
      if (res.ok) setData((prev) => (prev ? { ...prev, state: 'MATCHED' } : prev));
      else setError(d.error);
    } finally {
      setAccepting(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl card p-6">
        <p className="text-danger" role="alert">{error}</p>
        <Link href="/resident" className="mt-3 inline-block text-teal-700 underline">Back</Link>
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto max-w-xl card p-6 text-muted">Loading your result…</div>;
  }

  const match = matchSupport(data.risk_tier);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge tier={data.risk_tier} />
          <StateBadge state={data.state} />
        </div>
        <h1 className="mt-3 text-xl font-bold">
          {data.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} score: {data.total_score}
        </h1>
        <p className="mt-2 text-sm">
          <strong>What this means:</strong> your answers fall in the{' '}
          <strong>{data.score_band.replace('_', ' ')}</strong> range. {match.why}
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <strong>What this does not mean:</strong> this is a screening, not a diagnosis.
          It does not label you with any condition, and it is not a substitute for a
          professional assessment.
        </p>
        <p className="mt-2 text-xs text-muted">Pseudonymous ID: {data.pseudo_id}</p>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Why this suggestion</h2>
        <p className="mt-1 text-sm text-muted">{match.why}</p>
        <p className="mt-2 text-sm font-medium text-teal-800">{match.slaSummary}</p>
        <ul className="mt-4 space-y-4">
          {match.options.map((opt) => (
            <li key={opt.key} className="rounded-lg border border-border p-4">
              <h3 className="font-semibold">{opt.title}</h3>
              <p className="mt-1 text-sm"><span className="font-medium">Eligibility:</span> {opt.eligibility}</p>
              <p className="mt-1 text-sm"><span className="font-medium">What happens next:</span> {opt.handoff}</p>
            </li>
          ))}
        </ul>
        {data.state === 'SCREENED' && (
          <button onClick={accept} disabled={accepting} className="btn btn-primary mt-5 w-full">
            {accepting ? 'Saving…' : 'Accept — connect me with support'}
          </button>
        )}
        {data.state !== 'SCREENED' && (
          <p className="mt-4 text-sm text-teal-800 font-medium">
            Your follow-up is in progress. A human navigator can see your case and its deadline.
          </p>
        )}
      </section>

      <section className="card p-6 text-sm">
        <h2 className="font-semibold">Your follow-up clock</h2>
        <ul className="mt-2 space-y-1 text-muted">
          {data.sla_contact_due && <li>Human contact by: {fmtDateTime(data.sla_contact_due)}</li>}
          {data.sla_book_due && <li>Appointment by: {fmtDateTime(data.sla_book_due)}</li>}
          {data.sla_followup_due && <li>Re-screen / check-in by: {fmtDateTime(data.sla_followup_due)}</li>}
        </ul>
        <Link href="/resident" className="mt-3 inline-block text-teal-700 underline">Back to my follow-ups</Link>
      </section>
    </div>
  );
}