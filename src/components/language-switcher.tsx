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
    <div role="group" aria-label={t('language')} className="flex gap-1 rounded-lg bg-white/10 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          onClick={() => choose(o.code)}
          aria-pressed={locale === o.code}
          className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${
            locale === o.code ? 'bg-white text-teal-800' : 'text-teal-50 hover:bg-white/15'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}