'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RiskBadge, StateBadge, fmtDateTime } from '@/components/ui';
import type { RiskTier } from '@/lib/matching';

interface ResidentCase {
  id: string;
  risk_tier: RiskTier;
  state: string;
  created_at: string;
  instrument: string | null;
  total_score: number | null;
}

export default function ResidentHome() {
  const [residentId, setResidentId] = useState<string | null>(null);
  const [cases, setCases] = useState<ResidentCase[]>([]);
  const [consentRequired, setConsentRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    setResidentId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/residents/${id}/cases`)
      .then((r) => r.json())
      .then((d) => {
        setCases(d.cases ?? []);
        setConsentRequired(Boolean(d.consentRequired));
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="card p-6">
        <h1 className="text-xl font-bold">How are you feeling?</h1>
        <p className="mt-2 text-sm text-muted">
          Two short, validated questionnaires. One question at a time, about 2 minutes each.
          This is a screening, not a diagnosis. No name or ID number is needed — you get a
          pseudonymous ID.
        </p>
        <div className="mt-5 grid gap-3">
          <Link href="/resident/screen/PHQ9" className="btn btn-primary w-full">
            Start PHQ-9 (mood, 9 questions)
          </Link>
          <Link href="/resident/screen/GAD7" className="btn btn-outline w-full">
            Start GAD-7 (anxiety, 7 questions)
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">My follow-ups</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : consentRequired ? (
          <p className="mt-3 text-sm text-warning">
            Storing your results is currently turned off, so past results are hidden. You can
            turn it back on in{' '}
            <Link href="/resident/consent" className="underline">
              Privacy &amp; consent
            </Link>
            .
          </p>
        ) : cases.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No screenings yet. Your results and follow-up steps will appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {cases.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge tier={c.risk_tier} />
                  <StateBadge state={c.state} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {c.instrument} score {c.total_score} · {fmtDateTime(c.created_at)}
                </p>
                <Link
                  href={`/resident/result/${c.id}`}
                  className="mt-1 inline-block text-sm font-medium text-teal-700 underline"
                >
                  View result and support options
                </Link>
              </li>
            ))}
          </ul>
        )}
        {residentId && (
          <p className="mt-4 text-xs text-muted">Your pseudonymous ID is stored on this device only.</p>
        )}
        <Link
          href="/resident/consent"
          className="mt-3 inline-block text-sm font-medium text-teal-700 underline"
        >
          Privacy &amp; consent — control what is stored and shared
        </Link>
      </section>
    </div>
  );
}