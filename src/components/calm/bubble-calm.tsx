'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { BUBBLE_GOAL } from '@/lib/calm';

const TONES = [
  'border-primary/40 bg-primary/10 text-primary',
  'border-accent/40 bg-accent/10 text-accent',
  'border-success/40 bg-success/10 text-success',
  'border-warning/40 bg-warning/10 text-warning',
];

interface Bubble {
  id: number;
  gen: number;
  x: number;
  y: number;
  size: number;
  tone: number;
  drift: number;
}

function makeBubble(id: number, gen: number): Bubble {
  return {
    id,
    gen,
    x: 8 + Math.random() * 74,
    y: 8 + Math.random() * 66,
    size: 44 + Math.round(Math.random() * 30),
    tone: Math.floor(Math.random() * TONES.length),
    drift: 3 + Math.random() * 3,
  };
}

function initialBubbles(): Bubble[] {
  return Array.from({ length: 6 }, (_, i) => makeBubble(i, 0));
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function BubbleCalm({ onDone }: { onDone: (seconds: number, completed: boolean) => void }) {
  const t = useTranslations('calm');
  const reduce = useReducedMotion();
  const [bubbles, setBubbles] = useState<Bubble[]>(initialBubbles);
  const [pops, setPops] = useState(0);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const startedAt = useRef<number | null>(null);
  const rippleId = useRef(0);
  const done = pops >= BUBBLE_GOAL;

  function pop(b: Bubble, now: number) {
    if (done) return;
    if (startedAt.current === null) startedAt.current = now;
    const next = pops + 1;
    setPops(next);
    const rid = ++rippleId.current;
    setRipples((r) => [...r, { id: rid, x: b.x, y: b.y, size: b.size }]);
    setTimeout(() => setRipples((r) => r.filter((x) => x.id !== rid)), 650);
    setBubbles((bs) => bs.map((x) => (x.id === b.id ? makeBubble(b.id, b.gen + 1) : x)));
    if (next >= BUBBLE_GOAL) {
      const secs = Math.max(1, Math.round((now - startedAt.current!) / 1000));
      onDone(secs, true);
    }
  }

  function reset() {
    setBubbles(initialBubbles());
    setPops(0);
    setRipples([]);
    startedAt.current = null;
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative h-72 w-full max-w-md overflow-hidden rounded-card border border-border bg-gradient-to-b from-surface-2/70 to-primary/5">
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-pill border-2 border-accent/50"
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: r.size, height: r.size }}
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: reduce ? 1 : 1.8 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
        {!done &&
          bubbles.map((b) => (
            <motion.button
              key={`${b.id}-${b.gen}`}
              type="button"
              onClick={(e) => pop(b, e.timeStamp)}
              aria-label={t('bubbleLabel', { n: b.id + 1 })}
              className={`absolute flex items-center justify-center rounded-pill border-2 ${TONES[b.tone]}`}
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.size, height: b.size }}
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              animate={
                reduce
                  ? { scale: 1, opacity: 1 }
                  : { scale: 1, opacity: 1, y: [0, -9, 0] }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : { scale: { duration: 0.3 }, opacity: { duration: 0.3 }, y: { duration: b.drift, repeat: Infinity, ease: 'easeInOut' } }
              }
              whileTap={reduce ? undefined : { scale: 0.85 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10 A5 5 0 0 1 12 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </motion.button>
          ))}
        {done && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-pill bg-success-soft text-2xl text-success">✓</span>
            <p className="text-lg font-bold">{t('done')}</p>
          </div>
        )}
      </div>
      <p className="text-sm text-muted" aria-live="polite">{t('popped', { n: pops, goal: BUBBLE_GOAL })}</p>
      <Button onClick={reset} variant="outline">{t('reset')}</Button>
    </div>
  );
}