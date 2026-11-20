'use client';

import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { DEMO_STEPS } from '@/lib/demo/story';
import { useDemo } from '@/components/demo/demo-provider';

export function DemoGuide() {
  const { active, step, next, back, reset } = useDemo();
  const t = useTranslations('demo');
  const reduce = useReducedMotion();
  if (!active) return null;
  const k = step + 1;
  const last = step === DEMO_STEPS.length - 1;
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 z-[60] px-4 bottom-[calc(56px+env(safe-area-inset-bottom)+0.75rem)] md:bottom-4"
    >
      <section
        role="region"
        aria-label={t('guideLabel')}
        className="card mx-auto max-w-xl border-primary/30 p-4 shadow-lg sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Badge tone="accent">{t('step', { k, n: DEMO_STEPS.length })}</Badge>
            <span className="flex items-center gap-1" aria-hidden="true">
              {DEMO_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-pill transition-all duration-250 ${
                    i === step ? 'w-4 bg-primary' : i < step ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </span>
          </div>
          <button onClick={reset} className="min-h-[44px] px-2 text-xs font-semibold text-muted underline-offset-2 hover:underline">
            {t('reset')}
          </button>
        </div>
        <div aria-live="polite">
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="mt-2 font-bold">{t(`s${k}title`)}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t(`s${k}body`)}</p>
          </motion.div>
        </div>
        <p className="mt-2 text-[11px] font-medium text-muted">{t('note')}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={back} disabled={step === 0} className="btn btn-outline flex-1 text-sm">
            {t('back')}
          </button>
          <motion.button
            whileTap={reduce ? undefined : { scale: 0.97 }}
            onClick={next}
            className="btn btn-primary flex-1 text-sm"
          >
            {last ? t('finish') : t('next')}
          </motion.button>
        </div>
      </section>
    </motion.div>
  );
}