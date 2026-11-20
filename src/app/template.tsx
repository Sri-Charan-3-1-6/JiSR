import type { ReactNode } from 'react';

// CSS-only fade: starts at first paint so LCP never waits for hydration.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="route-fade">{children}</div>;
}