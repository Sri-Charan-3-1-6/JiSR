import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const LOCALES = ['en', 'ar', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get('jisr_locale')?.value ?? 'en';
  const locale: Locale = (LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : 'en';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});