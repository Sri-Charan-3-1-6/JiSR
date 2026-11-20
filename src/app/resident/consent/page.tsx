'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { fmtDateTime } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

const SCOPES = [
  'store_results',
  'navigator_contact',
  'share_with_primary_care',
  'anonymous_aggregate_stats',
  'wearable_signal',
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
  const [residentId, setResidentId] = useState<string | null>(null);
  const [pseudoId, setPseudoId] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/residents/${id}/consent`);
    if (!r.ok) throw new Error('load failed');
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
    <div className="mx-auto max-w-xl space-y-5">
      <section className="card p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
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
          <section className="card divide-y divide-border">
            {SCOPES.map((scope) => {
              const on = grantedMap.get(scope) ?? false;
              const title = t(`scopes.${scope}.title`);
              return (
                <div key={scope} className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{t(`scopes.${scope}.description`)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={title}
                    disabled={busy !== null}
                    onClick={() => toggle(scope, !on)}
                    className={`relative mt-1 h-8 w-[52px] shrink-0 rounded-pill transition-colors duration-250 ${
                      on ? 'bg-primary' : 'bg-border'
                    } ${busy === scope ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute start-1 top-1 h-6 w-6 rounded-pill bg-white shadow-1 transition-transform duration-250 ${
                        on ? 'translate-x-[20px] rtl:-translate-x-[20px]' : ''
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </section>

          <section className="card p-6">
            <h2 className="font-bold">{t('auditTitle')}</h2>
            <p className="mt-1 text-xs text-muted">{t('auditHint')}</p>
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
                    className="flex flex-wrap items-center gap-2 text-sm"
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
        </>
      )}
    </div>
  );
}