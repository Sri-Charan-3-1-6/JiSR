'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribe = () => () => {};
const getHost = () => document.body;
const getServerHost = () => null;

// The portal escapes the route-transition stacking context.
export default function EmergencyOverlay({ children }: { children: ReactNode }) {
  const host = useSyncExternalStore(subscribe, getHost, getServerHost);
  const shell = <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">{children}</div>;
  return host ? createPortal(shell, host) : shell;
}