'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { BreathingCircle } from '@/components/calm/breathing-circle';
import { GroundingStepper } from '@/components/calm/grounding-stepper';
import { MemoryMatch } from '@/components/calm/memory-match';
import { CALM_LINES_CACHE_PREFIX, type Exercise } from '@/lib/calm';

interface CalmLine {
  id: number;
  language: string;
  kind: 'support' | 'joke';
  exercise: string | null;
  body: string;
  reviewed: boolean;
}

export default function CalmPage() {
  const t = useTranslations('calm');
  const locale = useLocale();
  const reduce = useReducedMotion();
  const toast = useToast();
  const [active, setActive] = useState<Exercise>('breathing');
  const [lines, setLines] = useState<CalmLine[]>([]);
  const [jokesOptIn, setJokesOptIn] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);

  const residentId = () =>
    typeof window === 'undefined' ? null : localStorage.getItem('jisr_resident_id');

  const loadLines = useCallback(async (jokes: boolean) => {
    const id = residentId();
    const cacheKey = `${CALM_LINES_CACHE_PREFIX}${locale}${jokes ? '_jokes' : ''}`;
    try {
      const url = `/api/calm/lines?language=${locale}${id ? `&residentId=${id}` : ''}${jokes ? '&jokes=1' : ''}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setLines(d.lines ?? []);
      localStorage.setItem(cacheKey, JSON.stringify(d.lines ?? []));
    } catch {
      // Offline fallback: the cached pre-written lines from the last visit.
      const cached = localStorage.getItem(cacheKey);
      if (cached) setLines(JSON.parse(cached));
    }
  }, [locale]);

  useEffect(() => {
    const id = residentId();
    (async () => {
      let jokes = false;
      if (id) {
        try {
          const r = await fetch(`/api/residents/${id}/companion-prefs`);
          if (r.ok) jokes = Boolean((await r.json()).jokesOptIn);
        } catch { /* offline: default off */ }
      }
      setJokesOptIn(jokes);
      await loadLines(jokes);
    })();
  }, [loadLines]);

  async function toggleJokes() {
    const id = residentId();
    const next = !jokesOptIn;
    setJokesOptIn(next);
    if (id) {
      try {
        await fetch(`/api/residents/${id}/companion-prefs`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jokesOptIn: next }),
        });
      } catch { /* preference stays local for this visit */ }
    }
    await loadLines(next);
  }

  // Recording is best-effort and consent-gated server-side; the exercises
  // themselves always run, even offline or with consent revoked.
  async function recordSession(exercise: Exercise, seconds: number, completed: boolean) {
    const id = residentId();
    if (!id) return;
    try {
      const r = await fetch('/api/calm/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId: id, exercise, seconds, completed }),
      });
      if (r.ok) toast(t('sessionSaved'));
    } catch { /* offline: session simply not recorded */ }
  }

  const support = lines.filter((l) => l.kind === 'support');
  const jokes = lines.filter((l) => l.kind === 'joke');
  const line = support.length > 0 ? support[lineIndex % support.length] : null;

  const exercises: { key: Exercise; title: string; hint: string }[] = [
    { key: 'breathing', title: t('breathing'), hint: t('breathingHint') },
    { key: 'grounding', title: t('grounding'), hint: t('groundingHint') },
    { key: 'memory', title: t('memory'), hint: t('memoryHint') },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <header className="surface-hero flex items-center justify-between gap-6 p-6 sm:p-8 lg:p-10">
        <div>
          <h1 className="page-heading">{t('title')}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{t('intro')}</p>
        </div>
        <svg aria-hidden="true" viewBox="0 0 80 80" fill="none" className="hidden h-24 w-24 shrink-0 text-accent sm:block"><circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="1" /><circle cx="40" cy="40" r="23" stroke="currentColor" strokeWidth="1" /><circle cx="40" cy="40" r="12" stroke="currentColor" strokeWidth="1" /></svg>
      </header>

      <div className="resident-grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section className="data-panel min-w-0 p-5 sm:p-8">
        <div className="grid grid-cols-3 gap-2 rounded-btn bg-surface-2/60 p-2" role="tablist" aria-label={t('title')}>
          {exercises.map((e, i) => (
            <button
              key={e.key}
              type="button"
              role="tab"
              id={`calm-tab-${e.key}`}
              aria-controls="calm-exercise-panel"
              aria-selected={active === e.key}
              onClick={() => setActive(e.key)}
              className={`btn flex-col gap-2 px-2 py-3 text-sm leading-snug ${active === e.key ? 'btn-primary' : 'btn-ghost'}`}
            >
              <span aria-hidden="true" className="text-xs tabular-nums opacity-70">0{i + 1}</span>
              {e.title}
            </button>
          ))}
        </div>
        <p className="mt-5 text-center text-sm leading-relaxed text-muted">{exercises.find((e) => e.key === active)!.hint}</p>
        <motion.div
          key={active}
          id="calm-exercise-panel"
          role="tabpanel"
          aria-labelledby={`calm-tab-${active}`}
          className="mt-6 border-t border-border pt-6"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {active === 'breathing' && <BreathingCircle onDone={(s, c) => recordSession('breathing', s, c)} />}
          {active === 'grounding' && <GroundingStepper onDone={(s, c) => recordSession('grounding', s, c)} />}
          {active === 'memory' && <MemoryMatch onDone={(s, c) => recordSession('memory', s, c)} />}
        </motion.div>
      </section>

      <section className="min-w-0 rounded-card border border-border bg-surface-2/50 p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-heading">{t('lineTitle')}</h2>
          {line?.reviewed && <Badge tone="success">✓</Badge>}
        </div>
        {line ? (
          <blockquote className="my-6 border-s-2 border-accent ps-5 text-xl font-medium leading-relaxed text-primary-strong">
            {line.body}
          </blockquote>
        ) : (
          <p className="mt-3 text-sm text-muted">—</p>
        )}
        {support.length > 1 && (
          <Button onClick={() => setLineIndex((i) => i + 1)} variant="ghost" className="mt-3 px-3 py-2 text-sm">
            {t('next')}
          </Button>
        )}
        {jokesOptIn && jokes.length > 0 && (
          <p className="mt-4 rounded-btn bg-surface-2 p-3 text-sm text-muted">{jokes[0].body}</p>
        )}
        <div className="mt-4 flex items-start justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium">{t('jokesToggle')}</p>
            <p className="mt-0.5 text-xs text-muted">{t('jokesHint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={jokesOptIn}
            aria-label={t('jokesToggle')}
            onClick={toggleJokes}
            className={`relative h-11 w-16 shrink-0 rounded-pill transition-colors duration-250 motion-reduce:transition-none ${
              jokesOptIn ? 'bg-primary' : 'bg-border'
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute start-1.5 top-1.5 h-8 w-8 rounded-pill bg-primary-foreground shadow-1 transition-transform duration-250 motion-reduce:transition-none ${
                jokesOptIn ? 'translate-x-[20px] rtl:-translate-x-[20px]' : ''
              }`}
            />
          </button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">{t('offlineNote')}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{t('reviewedNote')}</p>
      </section>

      </div>
      <section className="border-t border-border pt-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/navigator" className="btn btn-outline px-3 py-2">{t('clockLink')}</Link>
          <Link href="/health-system" className="btn btn-outline px-3 py-2">{t('gapLink')}</Link>
        </div>
      </section>
    </div>
  );
}