'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Portalled to body so the route-transition stacking context can never
// trap or reposition this full-screen fixed overlay.
export default function EmergencyOverlay({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setHost(document.body);
  }, []);
  const shell = <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">{children}</div>;
  return host ? createPortal(shell, host) : shell;
}