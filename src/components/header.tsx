'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { BridgeArc } from '@/components/logo';
import { Badge } from '@/components/ui/badge';

const PORTALS = [
  { href: '/resident', key: 'resident' },
  { href: '/navigator', key: 'navigator' },
  { href: '/health-system', key: 'healthSystem' },
  { href: '/employer', key: 'employer' },
] as const;

export function RoleSwitcher() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const reduce = useReducedMotion();
  return (
    <nav
      aria-label="Role switcher"
      className="flex min-w-0 max-w-full gap-0.5 overflow-x-auto rounded-pill border border-border bg-surface-2 p-1"
    >
      {PORTALS.map((p) => {
        const active = pathname.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={active ? 'page' : undefined}
            className={`relative whitespace-nowrap rounded-pill px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
              active ? 'text-primary-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {active && (
              <motion.span
                layoutId="role-switcher-pill"
                className="absolute inset-0 rounded-pill bg-primary"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{t(p.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SyntheticBadge() {
  const t = useTranslations('common');
  return (
    <Badge tone="warning" className="whitespace-nowrap">
      {t('syntheticBadge')}
    </Badge>
  );
}

export function Header() {
  const t = useTranslations('common');
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="JISR">
          <BridgeArc size={30} />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight">JISR</span>
            <span className="hidden text-[11px] font-medium text-muted sm:block">{t('tagline')}</span>
          </span>
        </Link>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <RoleSwitcher />
          <LanguageSwitcher />
          <ThemeToggle />
          <span className="hidden md:inline-flex">
            <SyntheticBadge />
          </span>
        </div>
        <span className="md:hidden">
          <SyntheticBadge />
        </span>
      </div>
    </header>
  );
}