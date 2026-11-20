'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { BridgeArc } from '@/components/logo';

export interface SidebarItem {
  href: string;
  label: string;
  icon: 'queue' | 'chart' | 'building';
}

const ICONS: Record<SidebarItem['icon'], string> = {
  queue: 'M4 6 H20 M4 12 H20 M4 18 H14',
  chart: 'M4 20 V10 M10 20 V4 M16 20 V13 M21 20 H3',
  building: 'M5 21 V5 L12 3 L19 5 V21 M9 9 H10 M14 9 H15 M9 13 H10 M14 13 H15 M10 21 V17 H14 V21',
};

export function PortalShell({
  items,
  homeLabel,
  children,
}: {
  items: SidebarItem[];
  homeLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6">
      <aside className="sticky top-24 hidden h-fit w-56 shrink-0 lg:block" aria-label="Portal">
        <nav className="card p-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex min-h-[44px] items-center gap-3 rounded-btn px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                      active ? 'text-primary-foreground' : 'text-muted hover:bg-surface-2 hover:text-foreground'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="portal-sidebar-pill"
                        className="absolute inset-0 rounded-btn bg-primary"
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d={ICONS[item.icon]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            <Link
              href="/"
              className="flex min-h-[44px] items-center gap-3 rounded-btn px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
            >
              <BridgeArc size={18} />
              {homeLabel}
            </Link>
          </div>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}