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
    <div className="mx-auto max-w-xl space-y-5">
      <section className="card p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="mt-2 rounded-btn border border-warning/25 bg-warning-soft p-3 text-xs font-semibold text-warning">
          {t('disclaimer')}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={talkToHuman} variant="danger" className="px-3 py-2 text-sm">
            {t('human')}
          </Button>
          <span className="text-xs text-muted">{t('stepCap', { k: Math.min(steps + 1, SESSION_STEP_CAP), n: SESSION_STEP_CAP })}</span>
        </div>
      </section>

      <motion.section
        key={nodeId + String(ended)}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="card p-6"
        aria-live="polite"
      >
        {ended ? (
          <>
            <h2 className="text-lg font-bold">{t('endTitle')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t(node.promptKey)}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('endBody')}</p>
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
            <h2 className="text-lg font-bold">{t(node.promptKey)}</h2>
            {node.freeText && (
              <>
                <label className="mt-3 block text-sm font-medium" htmlFor="companion-free-text">
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
            <div className="mt-4 grid gap-2">
              {node.options.map((o) => (
                <Button
                  key={o.labelKey}
                  onClick={() => choose(o.next)}
                  variant="outline"
                  disabled={busy}
                  className="w-full justify-start text-start"
                >
                  {t(o.labelKey)}
                </Button>
              ))}
            </div>
          </>
        )}
      </motion.section>

      <section className="card p-6">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/resident/checkin" className="btn btn-outline px-3 py-2">{t('backToCheckin')}</Link>
          <Link href="/navigator" className="btn btn-outline px-3 py-2">{t('clockLink')}</Link>
          <Link href="/health-system" className="btn btn-outline px-3 py-2">{t('gapLink')}</Link>
        </div>
      </section>
    </div>
  );
}