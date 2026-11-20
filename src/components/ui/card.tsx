'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  hover = false,
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  as?: 'div' | 'section' | 'li';
}) {
  const reduce = useReducedMotion();
  const M = motion[Tag];
  return (
    <M
      className={`card ${hover ? 'card-hover' : ''} ${className}`}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  );
}