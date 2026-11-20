import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SyntheticBadge } from '@/components/header';
import { DemoButton } from '@/components/demo/demo-button';

const PORTAL_ICONS = {
  resident: 'M12 12 C14.5 12 16.5 10 16.5 7.5 C16.5 5 14.5 3 12 3 C9.5 3 7.5 5 7.5 7.5 C7.5 10 9.5 12 12 12 Z M4 21 C4 16.5 7.5 14 12 14 C16.5 14 20 16.5 20 21',
  navigator: 'M12 3 L20 6 V12 C20 17 16.5 20 12 21 C7.5 20 4 17 4 12 V6 Z M9 12 L11.5 14.5 L15.5 9.5',
  health: 'M4 20 V10 M10 20 V4 M16 20 V13 M21 20 H3',
} as const;

export default async function Home() {
  const t = await getTranslations('home');
  const tc = await getTranslations('common');
  const tu = await getTranslations('ui');
  const portals = [
    { href: '/resident', title: t('residentTitle'), desc: t('residentDesc'), icon: PORTAL_ICONS.resident },
    { href: '/navigator', title: t('navigatorTitle'), desc: t('navigatorDesc'), icon: PORTAL_ICONS.navigator },
    { href: '/health-system', title: t('healthTitle'), desc: t('healthDesc'), icon: PORTAL_ICONS.health },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-10 sm:space-y-14">
      <section className="grid items-center gap-10 py-2 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-6">
        <div>
          <p className="eyebrow flex items-center gap-3">
            <span className="h-px w-8 bg-accent" aria-hidden="true" />
            {tu('heroEyebrow')}
          </p>
          <h1 className="display-title mt-6">
            {tu('heroStart')}
            <span className="mt-1 block text-primary">{tu('heroEnd')}</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-muted sm:text-base sm:leading-8">{t('intro')}</p>
          <Link href="/resident" className="btn btn-primary mt-7 gap-4 rounded-pill px-6">
            {tu('residentCta')}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="rtl:rotate-180">
              <path d="M4 12 H20 M14 6 L20 12 L14 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
        <div className="bridge-scene card-enter px-6 pb-7 pt-12 sm:px-8" style={{ animationDelay: '80ms' }}>
          <svg viewBox="0 0 480 330" className="mx-auto w-full max-w-md" fill="none" aria-hidden="true">
            <circle cx="338" cy="80" r="42" fill="var(--accent)" opacity="0.16" />
            <path d="M0 242 Q75 183 153 240 Q237 282 316 229 Q397 185 480 235 V330 H0Z" fill="var(--primary)" opacity="0.07" />
            <path d="M0 294 Q115 249 241 285 Q364 319 480 262 V330 H0Z" fill="var(--primary)" opacity="0.12" />
            <path d="M106 254 V205 C106 127 166 64 240 64 C314 64 374 127 374 205 V254" stroke="var(--primary)" strokeWidth="27" />
            <path d="M106 205 C106 127 166 64 240 64 C314 64 374 127 374 205" stroke="var(--card)" strokeWidth="1.5" opacity="0.45" />
            <path d="M84 254 H396" stroke="var(--primary)" strokeWidth="12" strokeLinecap="round" />
            <path d="M141 167 V247 M190 113 V247 M240 91 V247 M290 113 V247 M339 167 V247" stroke="var(--primary)" strokeWidth="2" opacity="0.45" />
            <path d="M49 242 V168 M49 200 L29 184 M49 186 L69 164 M422 244 V192 M422 218 L441 200" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <ellipse cx="48" cy="156" rx="31" ry="44" fill="var(--primary)" opacity="0.12" />
            <ellipse cx="424" cy="182" rx="24" ry="36" fill="var(--primary)" opacity="0.13" />
            <circle cx="214" cy="226" r="5" fill="var(--accent)" />
            <path d="M214 234 V247 M207 238 L214 234 L221 238" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="263" cy="226" r="5" fill="var(--primary)" />
            <path d="M263 234 V247 M256 238 L263 234 L270 238" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
            <path d="M168 308 Q240 287 312 308" stroke="var(--card)" strokeWidth="2" opacity="0.7" />
          </svg>
          <p className="mt-2 text-center text-sm font-semibold">{tu('pathTitle')}</p>
          <ol className="mt-5 grid grid-cols-3 gap-2 border-t border-primary/15 pt-5 text-center">
            {(['screen', 'understand', 'connect'] as const).map((key, i) => (
              <li key={key} className="min-w-0">
                <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-primary/20 text-xs font-medium text-primary" aria-hidden="true">{i + 1}</span>
                <span className="mt-2 block text-xs font-semibold text-muted">{tu(key)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-4">
        <SyntheticBadge />
        <p className="text-xs leading-relaxed text-muted sm:text-sm">{t('note')}</p>
      </div>

      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">{tu('portalEyebrow')}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{tu('portalTitle')}</h2>
          </div>
          <Link href="/about" className="text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{tc('aboutLink')}</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {portals.map((p, i) => (
            <Link key={p.href} href={p.href} className="card card-hover group flex flex-col p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d={p.icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="font-mono text-xs text-muted" aria-hidden="true">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold tracking-tight">{p.title}</h3>
              <p className="mb-6 mt-2 text-sm leading-6 text-muted">{p.desc}</p>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-auto text-primary transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1">
                <path d="M4 12 H20 M14 6 L20 12 L14 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>
      </section>
      <section className="surface-hero">
        <DemoButton />
      </section>
    </div>
  );
}
