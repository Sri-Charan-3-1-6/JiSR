'use client';

import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

export function CountUp({
  value,
  format,
  className = '',
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  const fmt = format ?? ((n: number) => String(Math.round(n)));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = fmt(value);
      prev.current = value;
      return;
    }
    const from = prev.current;
    const controls = animate(from, value, {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = fmt(v);
      },
      onComplete: () => {
        prev.current = value;
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return (
    <span
      ref={ref}
      className={`tabular-nums inline-block count-up ${className}`}
      style={{ minWidth: `${fmt(value).length}ch` }}
    >
      {fmt(value)}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  alert = false,
  numericValue,
  format,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
  numericValue?: number;
  format?: (n: number) => string;
}) {
  return (
    <div className={`card flex h-full flex-col p-5 ${alert ? 'border-danger/50 bg-danger-soft/30' : ''}`}>
      <p className="text-xs font-medium leading-5 text-muted">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${alert ? 'text-danger' : ''}`}>
        {numericValue !== undefined ? (
          <CountUp value={numericValue} format={format} />
        ) : (
          value
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}