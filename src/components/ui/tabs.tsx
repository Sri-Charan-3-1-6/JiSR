'use client';

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: { value: T; label: string; danger?: boolean }[];
  active: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
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
            className={`rounded-pill px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              selected
                ? tab.danger
                  ? 'bg-danger text-white'
                  : 'bg-primary text-primary-foreground'
                : 'text-muted hover:text-foreground'
            }`}
            style={{ minHeight: 40 }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}