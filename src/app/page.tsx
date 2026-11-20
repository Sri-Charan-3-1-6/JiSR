import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BridgeArc } from '@/components/logo';
import { SyntheticBadge } from '@/components/header';

const PORTAL_ICONS = {
  resident: 'M12 12 C14.5 12 16.5 10 16.5 7.5 C16.5 5 14.5 3 12 3 C9.5 3 7.5 5 7.5 7.5 C7.5 10 9.5 12 12 12 Z M4 21 C4 16.5 7.5 14 12 14 C16.5 14 20 16.5 20 21',
  navigator: 'M12 3 L20 6 V12 C20 17 16.5 20 12 21 C7.5 20 4 17 4 12 V6 Z M9 12 L11.5 14.5 L15.5 9.5',
  health: 'M4 20 V10 M10 20 V4 M16 20 V13 M21 20 H3',
} as const;

export default async function Home() {
  const t = await getTranslations('home');
  const portals = [
    { href: '/resident', title: t('residentTitle'), desc: t('residentDesc'), icon: PORTAL_ICONS.resident },
    { href: '/navigator', title: t('navigatorTitle'), desc: t('navigatorDesc'), icon: PORTAL_ICONS.navigator },
    { href: '/health-system', title: t('healthTitle'), desc: t('healthDesc'), icon: PORTAL_ICONS.health },
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section
        className="card relative overflow-hidden p-8 sm:p-12"
        style={{ background: 'var(--gradient-soft), var(--card)' }}
      >
        <div className="pointer-events-none absolute -end-10 -top-10 opacity-[0.08]" aria-hidden="true">
          <BridgeArc size={260} />
        </div>
        <div className="relative">
          <BridgeArc size={44} />
          <h1 className="mt-5 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{t('intro')}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SyntheticBadge />
            <p className="text-sm text-muted">{t('note')}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {portals.map((p) => (
          <Link key={p.href} href={p.href} className="card card-hover group block p-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-btn bg-primary/10 text-primary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={p.icon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="mt-4 font-bold text-primary-strong">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="transition-transform duration-250 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              >
                <path d="M3 8 H13 M9 4 L13 8 L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}