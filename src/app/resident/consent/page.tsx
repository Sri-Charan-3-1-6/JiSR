'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { fmtDateTime, useResidentId } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

const SCOPES = [
  'store_results',
  'navigator_contact',
  'share_with_primary_care',
  'anonymous_aggregate_stats',
  'wearable_signal',
  'reminders',
  'trusted_contact',
] as const;

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
  const t = useTranslations('consent');
  const tc = useTranslations('common');
  const reduce = useReducedMotion();
  const toast = useToast();
  const residentId = useResidentId();
  const [pseudoId, setPseudoId] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [fetching, setLoading] = useState(true);
  const loading = residentId === undefined || (residentId !== null && fetching);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((id: string) =>
    fetch(`/api/residents/${id}/consent`)
      .then((r) => {
        if (!r.ok) throw new Error('load failed');
        return r.json();
      })
      .then((d) => {
        setPseudoId(d.resident.pseudo_id);
        setScopes(d.scopes);
        setAudit(d.audit);
      }), []);

  useEffect(() => {
    const id = localStorage.getItem('jisr_resident_id');
    if (!id) return;
    load(id)
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast(tc('saved'));
    } catch {
      setError(t('updateError'));
    } finally {
      setBusy(null);
    }
  }

  const grantedMap = new Map(scopes.map((s) => [s.scope, s.granted]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <section className="surface-hero p-6 sm:p-8 lg:p-10">
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-5 text-accent"><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="m8 12 3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h1 className="page-heading">{t('title')}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          {t('intro')}
          {pseudoId && <> {t('pseudoIdLine')} <span className="font-mono">{pseudoId}</span>.</>}
        </p>
      </section>

      {!residentId && !loading ? (
        <section className="card p-6 text-sm text-muted">
          {t('noResident')}{' '}
          <Link href="/resident" className="font-semibold text-primary underline">
            {t('goScreening')}
          </Link>
        </section>
      ) : loading ? (
        <>
          <span className="sr-only">{tc('loading')}</span>
          <SkeletonCard lines={5} />
        </>
      ) : (
        <>
          {error && (
            <p role="alert" className="card border-danger/50 p-4 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="resident-grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="data-panel min-w-0 divide-y divide-border">
            {SCOPES.map((scope, i) => {
              const on = grantedMap.get(scope) ?? false;
              const title = t(`scopes.${scope}.title`);
              return (
                <div key={scope} className="flex items-start gap-3 p-5 sm:gap-4 sm:p-6">
                  <span aria-hidden="true" className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-xs font-medium tabular-nums text-accent sm:flex">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug">{title}</p>
                    <p id={`consent-${scope}-description`} className="mt-2 text-sm leading-relaxed text-muted">{t(`scopes.${scope}.description`)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={title}
                    aria-describedby={`consent-${scope}-description`}
                    disabled={busy !== null}
                    onClick={() => toggle(scope, !on)}
                    className={`relative h-11 w-16 shrink-0 rounded-pill transition-colors duration-250 motion-reduce:transition-none ${
                      on ? 'bg-primary' : 'bg-border'
                    } ${busy === scope ? 'opacity-50' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute start-1.5 top-1.5 h-8 w-8 rounded-pill bg-primary-foreground shadow-1 transition-transform duration-250 motion-reduce:transition-none ${
                        on ? 'translate-x-[20px] rtl:-translate-x-[20px]' : ''
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </section>

          <section className="data-panel min-w-0 p-6 sm:p-7">
            <h2 className="section-heading">{t('auditTitle')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t('auditHint')}</p>
            {audit.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t('noChanges')}</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {audit.map((a, i) => (
                  <motion.li
                    key={`${a.created_at}-${a.scope}-${a.action}`}
                    initial={reduce || i > 0 ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="timeline-item flex flex-wrap items-center gap-2 p-4 text-sm"
                  >
                    <Badge tone={a.action === 'grant' ? 'success' : 'danger'}>
                      {a.action === 'grant' ? t('granted') : t('revoked')}
                    </Badge>
                    <span>{t.has(`scopes.${a.scope}.title`) ? t(`scopes.${a.scope}.title`) : a.scope}</span>
                    <span className="text-xs text-muted">
                      {fmtDateTime(a.created_at)} · {t('by')} {a.actor}
                    </span>
                  </motion.li>
                ))}
              </ul>
            )}
          </section>
          </div>
        </>
      )}
    </div>
  );
}