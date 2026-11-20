export function BridgeArc({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="jisr-arc" x1="4" y1="40" x2="44" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <path
        d="M6 38 C6 18 18 8 24 8 C30 8 42 18 42 38"
        stroke="url(#jisr-arc)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path d="M4 38 H44" stroke="url(#jisr-arc)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M15 38 V27 M24 38 V20 M33 38 V27" stroke="url(#jisr-arc)" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}