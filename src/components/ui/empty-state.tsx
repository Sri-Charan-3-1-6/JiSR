'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="card flex flex-col items-center gap-4 p-8 text-center"
    >
      <svg width="64" height="48" viewBox="0 0 64 48" fill="none" aria-hidden="true">
        <path
          d="M8 40 C8 22 20 12 32 12 C44 12 56 22 56 40"
          stroke="var(--border)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M4 40 H60" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="32" cy="26" r="3" fill="var(--primary)" opacity="0.5" />
      </svg>
      <p className="text-sm text-muted">{title}</p>
      {action}
    </motion.div>
  );
}