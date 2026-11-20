'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';

const ICONS: Record<string, string> = {
  home: 'M4 11 L12 4 L20 11 M6 10 V20 H18 V10',
  consent: 'M12 3 L20 6 V12 C20 17 16.5 20 12 21 C7.5 20 4 17 4 12 V6 Z M9 12 L11.5 14.5 L15.5 9.5',
  summary: 'M7 3 H14 L18 7 V21 H7 Z M10 11 H15 M10 15 H15',
  wearable: 'M8 3 H16 L17 7 H7 Z M8 21 H16 L17 17 H7 Z M9 7 H15 V17 H9 Z',
};

export function BottomNav({
  items,
}: {
  items: { href: string; label: string; icon: keyof typeof ICONS }[];
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav
      aria-label="Resident"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors duration-150 ${
                  active ? 'text-primary' : 'text-muted'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute top-1 h-1 w-8 rounded-pill bg-primary"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d={ICONS[item.icon]}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}