'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { BridgeArc } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { useDemo } from '@/components/demo/demo-provider';

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
      className="grid min-w-0 grid-cols-4 gap-0.5 rounded-pill border border-border bg-surface-2 p-1 xl:flex"
    >
      {PORTALS.map((p) => {
        const active = pathname.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-h-9 items-center justify-center rounded-pill px-1 text-center text-xs font-semibold transition-colors duration-150 sm:px-4 sm:text-sm ${
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
  return <Badge tone="warning" className="whitespace-nowrap">{t('syntheticBadge')}</Badge>;
}

export function Header() {
  const t = useTranslations('common');
  const td = useTranslations('demo');
  const demo = useDemo();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6 xl:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="col-start-1 row-start-1 flex w-fit items-center gap-2.5" aria-label="JISR">
          <BridgeArc size={32} />
          <span className="flex flex-col leading-tight">
            <span className="text-xl font-bold tracking-[0.06em]">JISR</span>
            <span className="hidden text-[11px] font-medium text-muted sm:block">{t('tagline')}</span>
          </span>
        </Link>
        <div className="col-span-2 row-start-2 min-w-0 xl:col-span-1 xl:col-start-2 xl:row-start-1">
          <RoleSwitcher />
        </div>
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 xl:col-start-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="col-span-2 flex items-center justify-center gap-2 xl:col-span-3">
          {demo.active && <Badge tone="accent">{td('badge')}</Badge>}
          <SyntheticBadge />
        </div>
      </div>
    </header>
  );
}
