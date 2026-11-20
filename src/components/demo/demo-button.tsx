'use client';

import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { useDemo } from '@/components/demo/demo-provider';

export function DemoButton() {
  const { start } = useDemo();
  const t = useTranslations('demo');
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <motion.button
        whileTap={reduce ? undefined : { scale: 0.97 }}
        onClick={start}
        className="btn btn-primary text-base"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8 5.5 V18.5 L19 12 Z" fill="currentColor" />
        </svg>
        {t('button')}
      </motion.button>
      <p className="text-sm text-muted">{t('hint')}</p>
    </div>
  );
}