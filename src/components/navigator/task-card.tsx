'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { fmtDateTime } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export interface NavigatorTask {
  id: string;
  pseudo_id: string;
  reason: string;
  call_outcome: 'reached' | 'not_reached' | null;
  call_note: string | null;
  contact_id: string | null;
  contact_label: string | null;
  contact_available: boolean;
  created_at: string;
}

// One open escalation task: log the human call, and only after a failed call
// with an opted-in contact, send the generic simulated message.
export function TaskCard({ task, onReload }: { task: NavigatorTask; onReload: () => Promise<void> }) {
  const t = useTranslations('navigator');
  const tct = useTranslations('contact');
  const tc = useTranslations('common');
  const reduce = useReducedMotion();
  const toast = useToast();
  const [outcome, setOutcome] = useState<'reached' | 'not_reached'>('reached');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<{ message: string; waLink: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logCall() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/navigator/tasks/${task.id}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, note }),
      });
      if (!r.ok) throw new Error();
      toast(t('callSaved'));
      await onReload();
    } catch {
      setError(t('loadError'));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!task.contact_id) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/trusted-contact/${task.contact_id}/send`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setSent({ message: d.message, waLink: d.waLink });
    } catch {
      setError(t('sendError'));
    } finally {
      setBusy(false);
    }
  }

  async function reply() {
    if (!task.contact_id) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/trusted-contact/${task.contact_id}/reply`, { method: 'POST' });
      if (!r.ok) throw new Error();
      toast(t('replyMade'));
      await onReload();
    } catch {
      setError(t('sendError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.li
      layout={reduce ? false : 'position'}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="card min-w-0 border-danger/30 border-s-4 p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone="danger">{t('escalationBadge')}</Badge>
        <span className="break-all font-mono text-base font-semibold tracking-tight">{task.pseudo_id}</span>
        <span className="text-xs tabular-nums text-muted sm:ms-auto">{fmtDateTime(task.created_at)}</span>
        {task.call_outcome && (
          <Badge tone={task.call_outcome === 'reached' ? 'success' : 'warning'}>
            {task.call_outcome === 'reached' ? t('reached') : t('notReached')}
          </Badge>
        )}
      </div>
      <p className="mt-3 break-words text-sm leading-relaxed text-muted">
        <span className="font-semibold text-foreground">{t('taskReason')}:</span> {task.reason}
      </p>

      {error && <p role="alert" className="mt-3 rounded-btn border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 min-w-0 rounded-btn border border-border bg-surface-2/50 p-4">
        <p className="section-heading text-sm font-semibold">{t('logCall')}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('logCall')}>
          {(['reached', 'not_reached'] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={outcome === o}
              onClick={() => setOutcome(o)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-btn border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                outcome === o ? 'border-primary bg-primary/10 text-primary-strong' : 'border-border bg-card text-muted hover:border-primary/40'
              }`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border ${outcome === o ? 'border-primary' : 'border-border'}`} aria-hidden="true">
                {outcome === o && <span className="h-2 w-2 rounded-pill bg-primary" />}
              </span>
              {o === 'reached' ? t('reached') : t('notReached')}
            </button>
          ))}
        </div>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block min-w-0 text-sm">
            <span className="text-xs font-semibold text-muted">{t('callNote')}</span>
            <input
              type="text"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('noteOptional')}
              className="input mt-1.5 w-full"
            />
          </label>
          <Button onClick={logCall} disabled={busy} className="w-full px-4 py-2 text-sm sm:w-auto">
            {busy ? tc('saving') : t('logCall')}
          </Button>
        </div>
      </div>

      {task.call_outcome === 'not_reached' && task.contact_available && !sent && (
        <div className="mt-3 min-w-0 rounded-btn border border-warning/40 bg-warning-soft/40 p-4">
          <p className="text-sm leading-relaxed text-muted">{t('contactEligible')}</p>
          <Button onClick={send} disabled={busy} variant="outline" className="mt-3 w-full px-4 py-2 text-sm sm:w-auto">
            {t('sendSimulated')}
          </Button>
        </div>
      )}

      {sent && (
        <div className="mt-3 min-w-0 rounded-btn border border-warning/30 bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">{tct('simulatedBadge')}</Badge>
            <span className="text-xs font-semibold text-muted">{tct('messagePreview')}</span>
          </div>
          <p className="mt-3 break-words rounded-sm bg-surface-2/60 p-3 text-sm leading-relaxed">{sent.message}</p>
          <a
            href={sent.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center break-words text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tct('waLink')}
          </a>
          <div className="mt-3 border-t border-border pt-3">
            <Button onClick={reply} disabled={busy} variant="outline" className="w-full px-4 py-2 text-sm sm:w-auto">
              {tct('reply')}
            </Button>
            <p className="mt-2 text-xs leading-relaxed text-muted">{tct('replyNote')}</p>
          </div>
        </div>
      )}
    </motion.li>
  );
}