'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { GROUNDING_STEPS } from '@/lib/calm';

export function GroundingStepper({ onDone }: { onDone: (seconds: number, completed: boolean) => void }) {
  const t = useTranslations('calm');
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef<number | null>(null);

  const step = GROUNDING_STEPS[index];

  function next() {
    if (startedAt.current === null) startedAt.current = Date.now();
    if (index + 1 >= GROUNDING_STEPS.length) {
      setFinished(true);
      const secs = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      onDone(secs, true);
    } else {
      setIndex(index + 1);
    }
  }

  function reset() {
    setIndex(0);
    setFinished(false);
    startedAt.current = null;
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {finished ? (
        <p className="text-lg font-bold">{t('done')}</p>
      ) : (
        <motion.p
          key={step.key}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-lg font-bold"
          aria-live="polite"
        >
          {t(step.key, { count: step.count })}
        </motion.p>
      )}
      <div className="flex gap-1.5" aria-hidden="true">
        {GROUNDING_STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`h-1.5 w-6 rounded-pill ${i <= index && !finished ? 'bg-primary' : 'bg-border'}`}
          />
        ))}
      </div>
      {finished ? (
        <Button onClick={reset} variant="outline">{t('reset')}</Button>
      ) : (
        <Button onClick={next}>{index === 0 ? t('start') : t('next')}</Button>
      )}
    </div>
  );
}