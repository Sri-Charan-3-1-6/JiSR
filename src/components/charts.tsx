export interface CompareRow {
  group: string;
  current: number;
  simulated: number;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

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
    <div className="w-full" dir="ltr">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-pill bg-muted" aria-hidden="true" />
          {currentLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-pill bg-primary" aria-hidden="true" />
          {simulatedLabel}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((r, i) => (
          <div key={r.group}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground">{r.group}</span>
              <span className="tabular-nums text-muted">
                {pct(r.current)} → {pct(r.simulated)}
              </span>
            </div>
            <div className="mt-1 space-y-1">
              <div className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-2">
                <div
                  className="bar-grow h-full w-full origin-left rounded-pill bg-muted"
                  style={{ transform: `scaleX(${r.current})`, animationDelay: `${i * 60}ms` }}
                  title={`${currentLabel}: ${pct(r.current)}`}
                />
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-2">
                <div
                  className="bar-grow h-full w-full origin-left rounded-pill bg-primary"
                  style={{ transform: `scaleX(${r.simulated})`, animationDelay: `${i * 60 + 80}ms` }}
                  title={`${simulatedLabel}: ${pct(r.simulated)}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}