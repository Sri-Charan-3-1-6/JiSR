'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ECHO_ROUNDS } from '@/lib/calm';

const TILES = [
  { tone: 'border-primary/40 bg-primary/10 text-primary', lit: 'bg-primary text-primary-foreground', path: 'M12 4 L20 18 L4 18 Z' },
  { tone: 'border-accent/40 bg-accent/10 text-accent', lit: 'bg-accent text-primary-foreground', path: 'M5 5 H19 V19 H5 Z' },
  { tone: 'border-success/40 bg-success/10 text-success', lit: 'bg-success text-primary-foreground', path: 'M12 4 A8 8 0 1 0 12 20 A8 8 0 1 0 12 4' },
  { tone: 'border-warning/40 bg-warning/10 text-warning', lit: 'bg-warning text-primary-foreground', path: 'M12 3 L14.4 9.2 L21 9.7 L16 14 L17.6 20.5 L12 16.9 L6.4 20.5 L8 14 L3 9.7 L9.6 9.2 Z' },
];

type Phase = 'idle' | 'watch' | 'repeat' | 'retry' | 'done';

function makeSequence(len: number): number[] {
  return Array.from({ length: len }, () => Math.floor(Math.random() * TILES.length));
}

export function PatternEcho({ onDone }: { onDone: (seconds: number, completed: boolean) => void }) {
  const t = useTranslations('calm');
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIdx, setInputIdx] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function schedule(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }
  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  useEffect(() => clearTimers, []);

  function playback(seq: number[]) {
    clearTimers();
    setPhase('watch');
    setInputIdx(0);
    setLit(null);
    seq.forEach((tile, i) => {
      schedule(() => setLit(tile), 600 + i * 850);
      schedule(() => setLit(null), 600 + i * 850 + 550);
    });
    schedule(() => setPhase('repeat'), 600 + seq.length * 850);
  }

  function start(now: number) {
    startedAt.current = now;
    setRound(0);
    const seq = makeSequence(ECHO_ROUNDS[0]);
    setSequence(seq);
    playback(seq);
  }

  function tap(tile: number, now: number) {
    if (phase !== 'repeat') return;
    setLit(tile);
    schedule(() => setLit(null), 250);
    if (sequence[inputIdx] !== tile) {
      // Gentle retry: same sequence replays, nothing is lost.
      setPhase('retry');
      schedule(() => playback(sequence), 1100);
      return;
    }
    const nextIdx = inputIdx + 1;
    setInputIdx(nextIdx);
    if (nextIdx < sequence.length) return;
    const nextRound = round + 1;
    if (nextRound >= ECHO_ROUNDS.length) {
      setPhase('done');
      const secs = Math.max(1, Math.round((now - (startedAt.current ?? now)) / 1000));
      onDone(secs, true);
      return;
    }
    setRound(nextRound);
    const seq = makeSequence(ECHO_ROUNDS[nextRound]);
    setSequence(seq);
    schedule(() => playback(seq), 800);
    setPhase('watch');
  }

  function reset() {
    clearTimers();
    setPhase('idle');
    setRound(0);
    setSequence([]);
    setInputIdx(0);
    setLit(null);
    startedAt.current = null;
  }

  const status =
    phase === 'watch' ? t('echoWatch')
    : phase === 'repeat' ? t('echoRepeat')
    : phase === 'retry' ? t('echoRetry')
    : phase === 'done' ? t('done')
    : t('echoHint');

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="grid w-full max-w-xs grid-cols-2 gap-3">
        {TILES.map((tile, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={(e) => tap(i, e.timeStamp)}
            disabled={phase !== 'repeat'}
            aria-label={t('echoTile', { n: i + 1 })}
            aria-pressed={lit === i}
            className={`flex aspect-square items-center justify-center rounded-card border-2 transition-colors duration-150 motion-reduce:transition-none disabled:cursor-default ${
              lit === i ? tile.lit : tile.tone
            } ${phase === 'repeat' ? 'cursor-pointer' : ''}`}
            animate={lit === i && !reduce ? { scale: 1.05 } : { scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={tile.path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        ))}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {phase !== 'idle' && phase !== 'done' && `${t('echoRound', { k: round + 1, n: ECHO_ROUNDS.length })} · `}
        {status}
      </p>
      {phase === 'idle' ? (
        <Button onClick={(e) => start(e.timeStamp)}>{t('start')}</Button>
      ) : (
        <Button onClick={reset} variant="outline">{t('reset')}</Button>
      )}
    </div>
  );
}