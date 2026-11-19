'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fmtDateTime } from '@/components/ui';

const SCOPE_INFO: { scope: string; title: string; description: string }[] = [
  {
    scope: 'store_results',
    title: 'Store my screening results',
    description:
      'Needed to save your result and show your follow-up plan. Turned on automatically when you complete a screening; turn it off any time and your past results are immediately hidden.',
  },
  {
    scope: 'navigator_contact',
    title: 'Let a human navigator contact me',
    description: 'Allows a care navigator to reach out about your follow-up steps.',
  },
  {
    scope: 'share_with_primary_care',
    title: 'Share a summary with my primary care',
    description: 'Allows a one-page summary to be shared with your primary-care clinician.',
  },
  {
    scope: 'anonymous_aggregate_stats',
    title: 'Include me in anonymous statistics',
    description:
      'Your data joins anonymous, aggregated counts only. Groups smaller than 10 are never shown.',
  },
  {
    scope: 'wearable_signal',
    title: 'Use my wearable signals',
    description:
      'Allows sleep/activity signals to invite you to a check-in. Never used to diagnose.',
  },
];

interface Scope {
  scope: string;
  granted: boolean;
  updated_at: string;
}
interface AuditEntry {
  scope: string;
  action: string;
  actor: string;
  created_at: string;
}

export default function ConsentPage() {
  const [residentId, setResidentId] = useState<string | null>(null);
  const [pseudoId, setPseudoId] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/residents/${id}/consent`);
    if (!r.ok) throw new Error('Could not load consent settings');
    const d = await r.json();
    setPseudoId(d.resident.pseudo_id);
    setScopes(d.scopes);
    setAudit(d.audit);
  }, []);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    setResidentId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    load(id)
      .catch(() => setError('Could not load consent settings. Please try again.'))
      .finally(() => setLoading(false));
  }, [load]);

  async function toggle(scope: string, granted: boolean) {
    if (!residentId) return;
    setBusy(scope);
    setError(null);
    try {
      const r = await fetch(`/api/residents/${residentId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, granted }),
      });
      if (!r.ok) throw new Error();
      await load(residentId);
    } catch {
      setError('Could not update consent. Nothing was changed.');
    } finally {
      setBusy(null);
    }
  }

  const grantedMap = new Map(scopes.map((s) => [s.scope, s.granted]));
  const scopeLabel = (scope: string) =>
    SCOPE_INFO.find((s) => s.scope === scope)?.title ?? scope;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="card p-6">
        <h1 className="text-xl font-bold">Privacy &amp; consent</h1>
        <p className="mt-2 text-sm text-muted">
          Everything is off by default except what a specific action needs. Changes take effect
          immediately and are recorded in your audit log below.
          {pseudoId && <> Your pseudonymous ID: <span className="font-mono">{pseudoId}</span>.</>}
        </p>
      </section>

      {!residentId && !loading ? (
        <section className="card p-6 text-sm text-muted">
          No screenings on this device yet. Complete a screening first, then manage consent here.{' '}
          <Link href="/resident" className="text-teal-700 underline">
            Go to screening
          </Link>
        </section>
      ) : loading ? (
        <section className="card p-6 text-sm text-muted">Loading…</section>
      ) : (
        <>
          {error && (
            <p role="alert" className="card border-danger p-4 text-sm text-danger">
              {error}
            </p>
          )}
          <section className="card divide-y divide-border">
            {SCOPE_INFO.map((info) => {
              const on = grantedMap.get(info.scope) ?? false;
              return (
                <div key={info.scope} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{info.title}</p>
                    <p className="mt-1 text-sm text-muted">{info.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={info.title}
                    disabled={busy !== null}
                    onClick={() => toggle(info.scope, !on)}
                    className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${
                      on ? 'bg-primary' : 'bg-border'
                    } ${busy === info.scope ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                        on ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Your consent audit log</h2>
            <p className="mt-1 text-xs text-muted">
              Every grant and revocation, newest first. This log is visible only to you.
            </p>
            {audit.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No consent changes yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {audit.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        a.action === 'grant'
                          ? 'bg-teal-50 text-teal-800'
                          : 'bg-red-50 text-red-800'
                      }`}
                    >
                      {a.action === 'grant' ? 'Granted' : 'Revoked'}
                    </span>
                    <span>{scopeLabel(a.scope)}</span>
                    <span className="text-xs text-muted">
                      {fmtDateTime(a.created_at)} · by {a.actor}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}