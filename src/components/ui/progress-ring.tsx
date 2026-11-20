'use client';

import { useEffect, useId, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export function ProgressRing({
  value,
  max,
  size = 148,
  label,
  sublabel,
}: {
  value: number;
  max: number;
  size?: number;
  label: string;
  sublabel?: string;
}) {
  const reduce = useReducedMotion();
  const gradientId = useId();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, value / max));
  const [drawn, setDrawn] = useState(reduce ? frac : 0);

  useEffect(() => {
    if (reduce) return;
    let nextFrame = 0;
    const id = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => setDrawn(frac));
    });
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(nextFrame);
    };
  }, [frac, reduce]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}${sublabel ? ` — ${sublabel}` : ''}`}
    >
      <svg width={size} height={size} className="-rotate-90 rtl:rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (reduce ? frac : drawn))}
          className="ring-fill"
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold tabular-nums">{label}</span>
        {sublabel && <span className="mt-0.5 text-xs font-medium text-muted">{sublabel}</span>}
      </div>
    </div>
  );
}