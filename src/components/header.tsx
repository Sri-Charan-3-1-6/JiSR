'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PORTALS = [
  { href: '/resident', label: 'Resident' },
  { href: '/navigator', label: 'Navigator' },
  { href: '/health-system', label: 'Health System' },
  { href: '/employer', label: 'Employer' },
];

export function RoleSwitcher() {
  const pathname = usePathname();
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
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SyntheticBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 border border-amber-300">
      Prototype — synthetic data
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
          <SyntheticBadge />
        </div>
      </div>
    </header>
  );
}