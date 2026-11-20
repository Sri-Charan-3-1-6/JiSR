'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface CompareRow {
  group: string;
  current: number;
  simulated: number;
}

export function CompareChart({
  rows,
  currentLabel,
  simulatedLabel,
}: {
  rows: CompareRow[];
  currentLabel: string;
  simulatedLabel: string;
}) {
  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="group" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <YAxis
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            domain={[0, 1]}
          />
          <Tooltip
            formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--foreground)',
              fontSize: 13,
            }}
            cursor={{ fill: 'var(--surface-2)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
          <Bar dataKey="current" name={currentLabel} fill="var(--muted)" radius={[6, 6, 0, 0]} animationDuration={400} />
          <Bar dataKey="simulated" name={simulatedLabel} fill="var(--primary)" radius={[6, 6, 0, 0]} animationDuration={400} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}