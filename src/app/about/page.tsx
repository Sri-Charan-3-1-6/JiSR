import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { SyntheticBadge } from '@/components/header';

const REQUIREMENTS = [
  {
    links: [
      { href: '/resident/screen/PHQ9', label: 'linkScreen' },
      { href: '/emergency', label: 'linkEmergency' },
    ],
  },
  {
    links: [
      { href: '/resident', label: 'linkResident' },
      { href: '/resident/result/demo-case', label: 'linkResult' },
    ],
  },
  {
    links: [
      { href: '/emergency', label: 'linkEmergency' },
      { href: '/navigator', label: 'linkNavigator' },
    ],
  },
  {
    links: [
      { href: '/resident/consent', label: 'linkConsent' },
      { href: '/health-system', label: 'linkHealth' },
    ],
  },
  {
    links: [
      { href: '/resident/summary', label: 'linkSummary' },
      { href: '/resident/wearable', label: 'linkWearable' },
    ],
  },
  {
    links: [
      { href: '/navigator', label: 'linkNavigator' },
      { href: '/health-system', label: 'linkHealth' },
      { href: '/employer', label: 'linkEmployer' },
    ],
  },
] as const;

const LIMITS = ['limit1', 'limit2', 'limit3', 'limit4', 'limit5', 'limit6', 'limit7'] as const;

export default async function AboutPage() {
  const t = await getTranslations('about');
  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
      <section className="surface-hero p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{t('challenge')}</Badge>
          <SyntheticBadge />
        </div>
        <h1 className="page-heading mt-5">{t('title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{t('intro')}</p>
        <p className="mt-3 rounded-btn border border-primary/25 bg-primary/5 p-3 text-sm leading-relaxed">
          {t('llmNote')}
        </p>
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-lg font-bold">{t('reqTitle')}</h2>
        <ol className="mt-4 space-y-4">
          {REQUIREMENTS.map((req, i) => (
            <li key={i} className="rounded-btn border border-border p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-primary/10 text-sm font-bold text-primary-strong">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold">{t(`req${i + 1}title`)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t(`req${i + 1}body`)}</p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {req.links.map((l) => (
                      <Link
                        key={l.href + l.label}
                        href={l.href}
                        className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {t(l.label)} →
                      </Link>
                    ))}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card border-warning/30 p-6 sm:p-8">
        <h2 className="text-lg font-bold">{t('limitsTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('limitsIntro')}</p>
        <ul className="mt-4 space-y-2.5">
          {LIMITS.map((key) => (
            <li key={key} className="flex gap-2.5 text-sm leading-relaxed">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-warning" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-sm text-muted">
        <Link href="/" className="font-semibold text-primary underline-offset-2 hover:underline">
          {t('demoNote')}
        </Link>
      </p>
    </div>
  );
}