'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';

const PORTALS = [
  { href: '/resident', key: 'resident' },
  { href: '/navigator', key: 'navigator' },
  { href: '/health-system', key: 'healthSystem' },
  { href: '/employer', key: 'employer' },
] as const;

export function RoleSwitcher() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  return (
    <nav aria-label="Role switcher" className="flex gap-1 rounded-lg bg-white/10 p-1">
      {PORTALS.map((p) => {
        const active = pathname.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? 'bg-white text-teal-800' : 'text-teal-50 hover:bg-white/15'
            }`}
          >
            {t(p.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function SyntheticBadge() {
  const t = useTranslations('common');
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300">
      {t('syntheticBadge')}
    </span>
  );
}

export function Header() {
  return (
    <header className="bg-teal-800 text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight">JISR</span>
          <span className="hidden text-xs text-teal-200 sm:inline">bridge to wellbeing support</span>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <RoleSwitcher />
          <LanguageSwitcher />
          <SyntheticBadge />
        </div>
      </div>
    </header>
  );
}