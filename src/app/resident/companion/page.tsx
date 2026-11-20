'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  COMPANION_TREE, SESSION_STEP_CAP, moodFromPath, scanFreeText, sessionOver,
} from '@/lib/companion';

type Outcome = 'calm' | 'human' | 'checkin' | 'crisis' | 'capped';

export default function CompanionPage() {
  const t = useTranslations('companion');
  const router = useRouter();
  const reduce = useReducedMotion();
  const [nodeId, setNodeId] = useState('start');
  const [path, setPath] = useState<string[]>(['start']);
  const [steps, setSteps] = useState(0);
  const [freeText, setFreeText] = useState('');
  const [ended, setEnded] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const recorded = useRef(false);

  const node = COMPANION_TREE[nodeId];

  // Session metrics are recorded once; the mood tag travels to the server for
  // aggregate reports only and is never rendered here.
  async function record(outcome: Outcome, crisisFlag = false) {
    if (recorded.current) return;
    recorded.current = true;
    const residentId = localStorage.getItem('jisr_resident_id');
    if (!residentId) return;
    try {
      await fetch('/api/companion/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId, steps, outcome, moodTag: moodFromPath(path), crisisFlag,
        }),
      });
    } catch {
      // Recording is best-effort; the conversation itself never depends on it.
    }
  }

  async function crisisRoute() {
    setBusy(true);
    const residentId = localStorage.getItem('jisr_resident_id');
    try {
      const r = await fetch('/api/screenings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: 'PHQ9',
          answers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          freeText,
          residentId,
        }),
      });
      const d = await r.json();
      if (d.residentId) localStorage.setItem('jisr_resident_id', d.residentId);
      await record('crisis', true);
      router.push(`/emergency?caseId=${d.caseId}`);
    } catch {
      // Even if the API is unreachable, emergency guidance must open.
      await record('crisis', true);
      router.push('/emergency');
    }
  }

  async function choose(next: string) {
    if (busy || ended) return;
    // Fixed local crisis scan before any free text leaves this step.
    if (node.freeText && freeText.trim() && scanFreeText(freeText).crisis) {
      await crisisRoute();
      return;
    }
    const nextSteps = steps + 1;
    const nextNode = COMPANION_TREE[next];
    setSteps(nextSteps);
    setPath((p) => [...p, next]);
    setNodeId(next);
    if (nextNode.terminal) {
      setEnded(nextNode.terminal);
      await record(nextNode.terminal);
    } else if (sessionOver(nextSteps)) {
      setEnded('capped');
      await record('capped');
    }
  }

  async function talkToHuman() {
    if (busy) return;
    await record('human');
    router.push('/navigator');
  }

  function restart() {
    recorded.current = false;
    setNodeId('start');
    setPath(['start']);
    setSteps(0);
    setFreeText('');
    setEnded(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="surface-hero p-6 sm:p-8">
        <h1 className="page-heading">{t('title')}</h1>
        <p className="mt-5 rounded-btn border border-warning/25 bg-warning-soft p-4 text-sm leading-relaxed text-warning">
          {t('disclaimer')}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button onClick={talkToHuman} variant="outline" className="text-sm text-primary-strong">
            {t('human')}
          </Button>
          <span className="eyebrow text-muted">{t('stepCap', { k: Math.min(steps + 1, SESSION_STEP_CAP), n: SESSION_STEP_CAP })}</span>
        </div>
      </section>

      <motion.section
        key={nodeId + String(ended)}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="data-panel p-6 sm:p-8"
        aria-live="polite"
      >
        {ended ? (
          <>
            <span aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-pill bg-primary/10 text-2xl text-primary">✓</span>
            <h2 className="section-heading">{t('endTitle')}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">{t(node.promptKey)}</p>
            <p className="mt-3 text-base leading-relaxed text-muted">{t('endBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ended === 'calm' && (
                <Link href="/resident/calm" className="btn btn-primary px-3 py-2 text-sm">{t('optCalm')}</Link>
              )}
              {ended === 'checkin' && (
                <Link href="/resident/screen/PHQ9" className="btn btn-primary px-3 py-2 text-sm">{t('optCheckin')}</Link>
              )}
              {ended === 'human' && (
                <Link href="/navigator" className="btn btn-primary px-3 py-2 text-sm">{t('human')}</Link>
              )}
              <Link href="/resident/checkin" className="btn btn-outline px-3 py-2 text-sm">{t('backToCheckin')}</Link>
              <Button onClick={restart} variant="ghost" className="px-3 py-2 text-sm">{t('restart')}</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4 rounded-card rounded-ss-sm bg-surface-2/70 p-5 sm:p-6">
              <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" className="mt-1 shrink-0 text-accent"><path d="M20 4C8 3 3 9 5 15s13 6 15-11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="m4 21 11-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <h2 className="text-2xl font-semibold leading-snug tracking-tight">{t(node.promptKey)}</h2>
            </div>
            {node.freeText && (
              <>
                <label className="mt-6 block text-sm font-medium" htmlFor="companion-free-text">
                  {t('freeTextLabel')}
                </label>
                <textarea
                  id="companion-free-text"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  rows={3}
                  className="input mt-2 text-base"
                />
                <p className="mt-1 text-xs text-muted">{t('freeTextHint')}</p>
                <p className="mt-1 text-xs text-muted">{t('crisisNote')}</p>
              </>
            )}
            <div className="mt-6 grid gap-3">
              {node.options.map((o, i) => (
                <Button
                  key={o.labelKey}
                  onClick={() => choose(o.next)}
                  variant="outline"
                  disabled={busy}
                  className="group min-h-16 w-full justify-start gap-4 px-5 py-4 text-start text-base"
                >
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-xs tabular-nums text-muted group-hover:text-primary">{i + 1}</span>
                  <span className="flex-1">{t(o.labelKey)}</span>
                  <span aria-hidden="true" className="text-primary rtl:rotate-180">→</span>
                </Button>
              ))}
            </div>
          </>
        )}
      </motion.section>

      <section className="border-t border-border pt-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/resident/checkin" className="btn btn-outline px-3 py-2">{t('backToCheckin')}</Link>
          <Link href="/navigator" className="btn btn-outline px-3 py-2">{t('clockLink')}</Link>
          <Link href="/health-system" className="btn btn-outline px-3 py-2">{t('gapLink')}</Link>
        </div>
      </section>
    </div>
  );
}