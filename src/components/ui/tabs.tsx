'use client';

import { motion, useReducedMotion } from 'motion/react';

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  layoutId,
  ariaLabel,
}: {
  tabs: { value: T; label: string; danger?: boolean }[];
  active: T;
  onChange: (v: T) => void;
  layoutId: string;
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-pill border border-border bg-surface-2 p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.value === active;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={`relative rounded-pill px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              selected
                ? tab.danger
                  ? 'text-white'
                  : 'text-primary-foreground'
                : 'text-muted hover:text-foreground'
            }`}
            style={{ minHeight: 40 }}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className={`absolute inset-0 rounded-pill ${tab.danger ? 'bg-danger' : 'bg-primary'}`}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}