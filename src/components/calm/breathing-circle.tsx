'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { BREATHING_PHASES } from '@/lib/calm';

export function BreathingCircle({ onDone }: { onDone: (seconds: number, completed: boolean) => void }) {
  const t = useTranslations('calm');
  const reduce = useReducedMotion();
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const phase = BREATHING_PHASES[Math.floor(seconds / 4) % BREATHING_PHASES.length];
  const expanded = phase.key === 'inhale' || phase.key === 'hold';

  function stop() {
    setRunning(false);
    if (!doneRef.current && seconds > 0) {
      doneRef.current = true;
      onDone(seconds, seconds >= 16);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative flex h-48 w-48 items-center justify-center">
        <div className="absolute inset-0 rounded-pill border-2 border-border" aria-hidden="true" />
        {reduce ? (
          <div className="absolute inset-6 rounded-pill bg-primary/15" aria-hidden="true" />
        ) : (
          <motion.div
            className="absolute inset-6 rounded-pill bg-primary/25"
            animate={{ scale: running ? (expanded ? 1.35 : 1) : 1 }}
            transition={{ duration: 4, ease: 'easeInOut' }}
            aria-hidden="true"
          />
        )}
        <p className="relative text-lg font-bold" aria-live="polite">
          {running ? t(phase.key) : t('breathing')}
        </p>
      </div>
      {running && <p className="text-sm text-muted">{t('seconds', { n: seconds })}</p>}
      {running ? (
        <Button onClick={stop} variant="outline">{t('stop')}</Button>
      ) : (
        <Button onClick={() => { doneRef.current = false; setSeconds(0); setRunning(true); }}>
          {t('start')}
        </Button>
      )}
    </div>
  );
}