'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

const OPTIONS = [
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'عربي' },
  { code: 'hi', label: 'हिन्दी' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('common');

  function choose(code: string) {
    document.cookie = `jisr_locale=${code}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label={t('language')}
      className="flex gap-0.5 rounded-pill border border-border bg-surface-2 p-1"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          onClick={() => choose(o.code)}
          aria-pressed={locale === o.code}
          className={`rounded-pill px-2.5 py-2 text-sm font-semibold transition-colors duration-150 ${
            locale === o.code
              ? 'bg-card text-primary-strong shadow-1'
              : 'text-muted hover:text-foreground'
          }`}
          style={{ minHeight: 36 }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}