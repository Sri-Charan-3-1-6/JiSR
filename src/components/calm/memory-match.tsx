'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { MEMORY_SYMBOLS } from '@/lib/calm';

const SYMBOL_PATHS: Record<string, string> = {
  sun: 'M12 7 A5 5 0 1 0 12 17 A5 5 0 1 0 12 7 M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M4.9 4.9 L6.3 6.3 M17.7 17.7 L19.1 19.1 M19.1 4.9 L17.7 6.3 M6.3 17.7 L4.9 19.1',
  moon: 'M19 13.5 A8 8 0 1 1 10.5 5 A6.5 6.5 0 0 0 19 13.5 Z',
  star: 'M12 3 L14.4 9.2 L21 9.7 L16 14 L17.6 20.5 L12 16.9 L6.4 20.5 L8 14 L3 9.7 L9.6 9.2 Z',
  leaf: 'M5 19 C5 9 11 4 20 4 C20 14 14 19 5 19 Z M5 19 C8 13 12 9 17 7',
  wave: 'M3 10 C6 6 9 6 12 10 C15 14 18 14 21 10 M3 16 C6 12 9 12 12 16 C15 20 18 20 21 16',
  hill: 'M3 18 L9 8 L13 13 L16 9 L21 18 Z',
};

function shuffled(): string[] {
  const deck = [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryMatch({ onDone }: { onDone: (seconds: number, completed: boolean) => void }) {
  const t = useTranslations('calm');
  const reduce = useReducedMotion();
  const [deck, setDeck] = useState<string[]>(shuffled);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const startedAt = useRef<number | null>(null);
  const lock = useRef(false);

  function flip(i: number) {
    if (lock.current || flipped.includes(i) || matched.has(i)) return;
    if (startedAt.current === null) startedAt.current = Date.now();
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      lock.current = true;
      const [a, b] = next;
      if (deck[a] === deck[b]) {
        const nm = new Set(matched);
        nm.add(a);
        nm.add(b);
        setMatched(nm);
        setFlipped([]);
        lock.current = false;
        if (nm.size === deck.length) {
          const secs = Math.max(1, Math.round((Date.now() - startedAt.current!) / 1000));
          onDone(secs, true);
        }
      } else {
        setTimeout(() => {
          setFlipped([]);
          lock.current = false;
        }, 700);
      }
    }
  }

  function reset() {
    setDeck(shuffled());
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    startedAt.current = null;
    lock.current = false;
  }

  const complete = matched.size === deck.length;

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="grid w-full max-w-xs grid-cols-4 gap-2">
        {deck.map((symbol, i) => {
          const open = flipped.includes(i) || matched.has(i);
          return (
            <button
              key={`${i}-${symbol}`}
              type="button"
              onClick={() => flip(i)}
              aria-label={open ? symbol : `card ${i + 1}`}
              aria-pressed={open}
              className="relative aspect-square"
              style={{ perspective: 400 }}
            >
              <motion.span
                className="absolute inset-0 block"
                animate={{ rotateY: open || reduce ? 0 : 180 }}
                initial={false}
                transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <span
                  className={`absolute inset-0 flex items-center justify-center rounded-btn border ${
                    matched.has(i) ? 'border-success/40 bg-success-soft' : 'border-border bg-surface-2'
                  }`}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d={SYMBOL_PATHS[symbol]} stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span
                  className="absolute inset-0 rounded-btn border border-border bg-primary/15"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  aria-hidden="true"
                />
              </motion.span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">
        {t('pairs', { n: matched.size / 2 })} · {t('moves', { n: moves })}
      </p>
      {complete && <p className="text-lg font-bold">{t('done')}</p>}
      <Button onClick={reset} variant="outline">{t('reset')}</Button>
    </div>
  );
}